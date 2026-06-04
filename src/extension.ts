import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs/promises';
import axios, { AxiosError } from 'axios';
import { VibeCSidebarProvider } from './vibeCSidebarProvider';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const EXTENSION_ID = 'vibeC';
const CONFIG_SECTION = 'vibeC';

const DEFAULTS = {
  apiUrl: 'https://api.groq.com/openai/v1/chat/completions',
  modelName: 'llama-3.3-70b-versatile',
} as const;

// ---------------------------------------------------------------------------
// Target-platform definitions
// ---------------------------------------------------------------------------

type TargetPlatform =
  | 'ESP32 (Arduino Framework)'
  | 'Arduino Uno/Nano (AVR)'
  | 'Standard C (Generic)';

const VALID_PLATFORMS: ReadonlySet<string> = new Set<TargetPlatform>([
  'ESP32 (Arduino Framework)',
  'Arduino Uno/Nano (AVR)',
  'Standard C (Generic)',
]);

const SYSTEM_PROMPTS: Record<TargetPlatform, string> = {
  'ESP32 (Arduino Framework)':
    'You are an Expert ESP32 Embedded Engineer and the vibeC compiler. ' +
    'Translate the user\'s high-level vibe instructions into fully-functional Arduino-compliant C++ code targeting the ESP32 (Arduino framework). ' +
    'Use ESP32-specific libraries (Wi-Fi, BLE, etc.) when the instructions require networking or Bluetooth functionality. ' +
    'Include a pinout reference map as a comment block at the top of the file. ' +
    'Output ONLY clean, compilable code — no markdown wrappers, no explanations.',

  'Arduino Uno/Nano (AVR)':
    'You are an Expert AVR Embedded Engineer and the vibeC compiler. ' +
    'Translate the user\'s high-level vibe instructions into fully-functional Arduino .ino code targeting the Arduino Uno/Nano (ATmega328P). ' +
    'Optimize for low memory (2 KB SRAM, 32 KB Flash). Avoid dynamic memory allocation where possible. ' +
    'Include a pinout reference map as a comment block at the top of the file. ' +
    'Output ONLY clean, compilable code — no markdown wrappers, no explanations.',

  'Standard C (Generic)':
    'You are the vibeC compiler. Translate the user\'s high-level vibe instructions ' +
    'into pure, valid, and fully-functional C source code. ' +
    'Output ONLY clean C code, no markdown wrappers, no explanations.',
};

/** Returns the output file extension for the given platform. */
function outputExtension(platform: TargetPlatform): string {
  switch (platform) {
    case 'ESP32 (Arduino Framework)':
    case 'Arduino Uno/Nano (AVR)':
      return '.ino';
    case 'Standard C (Generic)':
    default:
      return '.c';
  }
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Resolved API-credential configuration (read from VS Code settings). */
interface VibeCConfig {
  apiKey: string;
  apiUrl: string;
  modelName: string;
}

/** Shape of the relevant portion of an OpenAI-compatible chat response. */
interface ChatCompletionResponse {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
}

/** Shape of an OpenAI-compatible error body. */
interface ApiErrorBody {
  error?: {
    message?: string;
  };
}

// ---------------------------------------------------------------------------
// Configuration helpers
// ---------------------------------------------------------------------------

/**
 * Reads and validates the extension's API settings.
 * Returns the resolved config, or `undefined` if the API key is missing
 * (after showing an actionable error to the user).
 */
async function resolveConfig(): Promise<VibeCConfig | undefined> {
  const cfg = vscode.workspace.getConfiguration(CONFIG_SECTION);

  const apiKey = cfg.get<string>('apiKey', '').trim();
  const apiUrl = cfg.get<string>('apiUrl', DEFAULTS.apiUrl).trim();
  const modelName = cfg.get<string>('modelName', DEFAULTS.modelName).trim();

  if (!apiKey) {
    const action = 'Open Settings';
    const choice = await vscode.window.showErrorMessage(
      `${EXTENSION_ID}: API Key is missing. Please configure it in your VS Code settings.`,
      action,
    );
    if (choice === action) {
      await vscode.commands.executeCommand(
        'workbench.action.openSettings',
        `${CONFIG_SECTION}.apiKey`,
      );
    }
    return undefined;
  }

  return { apiKey, apiUrl, modelName };
}

// ---------------------------------------------------------------------------
// Compilation pipeline
// ---------------------------------------------------------------------------

/**
 * Sends the `.vibe` source to the configured LLM endpoint and returns
 * the raw generated code string.
 */
async function requestCompletion(
  source: string,
  config: VibeCConfig,
  platform: TargetPlatform,
): Promise<string> {
  const response = await axios.post<ChatCompletionResponse>(
    config.apiUrl,
    {
      model: config.modelName,
      messages: [
        { role: 'system', content: SYSTEM_PROMPTS[platform] },
        { role: 'user', content: source },
      ],
    },
    {
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
      },
      timeout: 120_000,
    },
  );

  return response.data?.choices?.[0]?.message?.content ?? '';
}

/**
 * Strips accidental markdown code fences that models sometimes wrap around
 * their output (e.g. ```c … ```, ```cpp … ```, ```ino … ```).
 */
function stripMarkdownFences(code: string): string {
  return code
    .replace(/^```(?:c|cpp|ino)?\n?/i, '')
    .replace(/\n?```$/i, '')
    .trim();
}

/**
 * Writes the compiled output next to the original `.vibe` file and opens it
 * in a side-by-side editor column.
 *
 * @returns The base name of the created file (e.g. `main.ino`).
 */
async function writeAndOpenOutputFile(
  vibeFilePath: string,
  content: string,
  platform: TargetPlatform,
): Promise<string> {
  const dir = path.dirname(vibeFilePath);
  const baseName = path.basename(vibeFilePath, '.vibe');
  const ext = outputExtension(platform);
  const outFileName = `${baseName}${ext}`;
  const outFilePath = path.join(dir, outFileName);

  await fs.writeFile(outFilePath, content, 'utf-8');

  const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(outFilePath));
  await vscode.window.showTextDocument(doc, vscode.ViewColumn.Beside);

  return outFileName;
}

// ---------------------------------------------------------------------------
// Error handling
// ---------------------------------------------------------------------------

/**
 * Extracts a user-friendly error message from an Axios error or generic Error,
 * shows it in a VS Code notification, and returns the message string.
 */
function handleCompilationError(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const axiosErr = error as AxiosError<ApiErrorBody>;
    const status = axiosErr.response?.status;
    const detail = axiosErr.response?.data?.error?.message ?? axiosErr.message;
    const msg = `API request failed (${status ?? 'network error'}): ${detail}`;
    vscode.window.showErrorMessage(`${EXTENSION_ID}: ${msg}`);
    return msg;
  } else if (error instanceof Error) {
    vscode.window.showErrorMessage(`${EXTENSION_ID}: ${error.message}`);
    return error.message;
  } else {
    const msg = 'An unexpected error occurred.';
    vscode.window.showErrorMessage(`${EXTENSION_ID}: ${msg}`);
    return msg;
  }
}

// ---------------------------------------------------------------------------
// Main compile handler
// ---------------------------------------------------------------------------

/**
 * Core compilation flow — validates state, calls the LLM, writes output.
 * Status updates are pushed back into the sidebar webview in real-time.
 *
 * @param platformArg  Platform string passed from the sidebar (or command palette).
 * @param sidebar      The sidebar provider, used to push status updates.
 */
async function compileVibeFile(
  platformArg: string,
  sidebar: VibeCSidebarProvider,
): Promise<void> {
  // Normalise the platform, falling back to Standard C if something unexpected arrives
  const platform: TargetPlatform = VALID_PLATFORMS.has(platformArg)
    ? (platformArg as TargetPlatform)
    : 'Standard C (Generic)';

  // --- Validate active editor ------------------------------------------------
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    const msg = 'No active editor found. Please open a .vibe file.';
    vscode.window.showWarningMessage(`${EXTENSION_ID}: ${msg}`);
    sidebar.sendStatus('error', msg);
    return;
  }

  const filePath = editor.document.uri.fsPath;
  if (!filePath.endsWith('.vibe')) {
    const msg = 'The current file is not a .vibe file.';
    vscode.window.showWarningMessage(`${EXTENSION_ID}: ${msg}`);
    sidebar.sendStatus('error', msg);
    return;
  }

  // --- Validate workspace ----------------------------------------------------
  if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
    const msg = 'No workspace folder is open. Please open a folder before compiling.';
    vscode.window.showWarningMessage(`${EXTENSION_ID}: ${msg}`);
    sidebar.sendStatus('error', msg);
    return;
  }

  // --- Read source -----------------------------------------------------------
  const vibeSource = editor.document.getText();
  if (!vibeSource.trim()) {
    const msg = 'The .vibe file is empty. Write some vibes first!';
    vscode.window.showWarningMessage(`${EXTENSION_ID}: ${msg}`);
    sidebar.sendStatus('error', msg);
    return;
  }

  // --- Resolve API configuration ---------------------------------------------
  const config = await resolveConfig();
  if (!config) {
    sidebar.sendStatus('error', 'API Key is not configured.');
    return;
  }

  // --- Compile with progress -------------------------------------------------
  sidebar.sendStatus('compiling', `Compiling with ${platform}…`);

  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: `${EXTENSION_ID}`,
      cancellable: false,
    },
    async (progress) => {
      progress.report({ message: `Compiling with ${platform}…` });

      try {
        const rawCode = await requestCompletion(vibeSource, config, platform);

        if (!rawCode.trim()) {
          const msg = 'Received an empty response from the API. Please try again.';
          vscode.window.showErrorMessage(`${EXTENSION_ID}: ${msg}`);
          sidebar.sendStatus('error', msg);
          return;
        }

        progress.report({ message: 'Writing output file…' });

        const cleanCode = stripMarkdownFences(rawCode);
        const outputName = await writeAndOpenOutputFile(filePath, cleanCode, platform);

        const msg = `Compiled → ${outputName}`;
        vscode.window.showInformationMessage(
          `${EXTENSION_ID}: ${msg} [${platform}]`,
        );
        sidebar.sendStatus('success', msg);
      } catch (error: unknown) {
        const msg = handleCompilationError(error);
        sidebar.sendStatus('error', msg);
      }
    },
  );
}

// ---------------------------------------------------------------------------
// Activation / Deactivation
// ---------------------------------------------------------------------------

export function activate(context: vscode.ExtensionContext): void {
  // 1. Create and register the sidebar webview provider
  const sidebarProvider = new VibeCSidebarProvider(context.extensionUri);

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      VibeCSidebarProvider.viewType,
      sidebarProvider,
    ),
  );

  // 2. Register the compile command.
  //    When invoked from the sidebar, `platformArg` is the selected string.
  //    When invoked from the command palette (no arg), use the sidebar's current selection.
  context.subscriptions.push(
    vscode.commands.registerCommand(
      'vibec.compile',
      (platformArg?: string) => {
        const platform = platformArg ?? sidebarProvider.getSelectedPlatform();
        return compileVibeFile(platform, sidebarProvider);
      },
    ),
  );
}

export function deactivate(): void {
  // Nothing to dispose — all disposables are tracked via context.subscriptions.
}
