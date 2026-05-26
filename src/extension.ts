import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs/promises';
import axios, { AxiosError } from 'axios';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const EXTENSION_ID = 'vibeC';
const CONFIG_SECTION = 'vibeC';

const DEFAULTS = {
  apiUrl: 'https://api.groq.com/openai/v1/chat/completions',
  modelName: 'llama-3.3-70b-versatile',
} as const;

const SYSTEM_PROMPT =
  'You are the vibeC compiler. Translate the user\'s high-level vibe instructions ' +
  'into pure, valid, and fully-functional C source code. ' +
  'Output ONLY clean C code, no markdown wrappers, no explanations.';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Resolved extension configuration. */
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
 * Reads and validates the extension settings.
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
      await vscode.commands.executeCommand('workbench.action.openSettings', `${CONFIG_SECTION}.apiKey`);
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
 * the raw generated C code string.
 */
async function requestCompletion(
  source: string,
  config: VibeCConfig,
): Promise<string> {
  const response = await axios.post<ChatCompletionResponse>(
    config.apiUrl,
    {
      model: config.modelName,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
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
 * their output (e.g. ```c ... ```).
 */
function stripMarkdownFences(code: string): string {
  return code
    .replace(/^```c?\n?/i, '')
    .replace(/\n?```$/i, '')
    .trim();
}

/**
 * Writes `content` to a `.c` file next to the original `.vibe` file and
 * opens it in a side-by-side editor column.
 *
 * @returns The base name of the created file (e.g. `main.c`).
 */
async function writeAndOpenCFile(vibeFilePath: string, content: string): Promise<string> {
  const dir = path.dirname(vibeFilePath);
  const baseName = path.basename(vibeFilePath, '.vibe');
  const cFileName = `${baseName}.c`;
  const cFilePath = path.join(dir, cFileName);

  await fs.writeFile(cFilePath, content, 'utf-8');

  const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(cFilePath));
  await vscode.window.showTextDocument(doc, vscode.ViewColumn.Beside);

  return cFileName;
}

// ---------------------------------------------------------------------------
// Error handling
// ---------------------------------------------------------------------------

/**
 * Presents a user-friendly error message extracted from an Axios error or
 * a generic Error.
 */
function handleCompilationError(error: unknown): void {
  if (axios.isAxiosError(error)) {
    const axiosErr = error as AxiosError<ApiErrorBody>;
    const status = axiosErr.response?.status;
    const detail = axiosErr.response?.data?.error?.message ?? axiosErr.message;
    vscode.window.showErrorMessage(
      `${EXTENSION_ID}: API request failed (${status ?? 'network error'}): ${detail}`,
    );
  } else if (error instanceof Error) {
    vscode.window.showErrorMessage(`${EXTENSION_ID}: ${error.message}`);
  } else {
    vscode.window.showErrorMessage(`${EXTENSION_ID}: An unexpected error occurred.`);
  }
}

// ---------------------------------------------------------------------------
// Command: vibec.compile
// ---------------------------------------------------------------------------

async function compileVibeFile(): Promise<void> {
  // --- Validate active editor ------------------------------------------------
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    vscode.window.showWarningMessage(`${EXTENSION_ID}: No active editor found. Please open a .vibe file.`);
    return;
  }

  const filePath = editor.document.uri.fsPath;
  if (!filePath.endsWith('.vibe')) {
    vscode.window.showWarningMessage(`${EXTENSION_ID}: The current file is not a .vibe file.`);
    return;
  }

  // --- Validate workspace ----------------------------------------------------
  if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
    vscode.window.showWarningMessage(
      `${EXTENSION_ID}: No workspace folder is open. Please open a folder before compiling.`,
    );
    return;
  }

  // --- Read source -----------------------------------------------------------
  const vibeSource = editor.document.getText();
  if (!vibeSource.trim()) {
    vscode.window.showWarningMessage(`${EXTENSION_ID}: The .vibe file is empty. Write some vibes first!`);
    return;
  }

  // --- Resolve configuration -------------------------------------------------
  const config = await resolveConfig();
  if (!config) {
    return; // User was already notified inside resolveConfig()
  }

  // --- Compile with progress -------------------------------------------------
  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: `${EXTENSION_ID}`,
      cancellable: false,
    },
    async (progress) => {
      progress.report({ message: 'Compiling your vibe…' });

      try {
        const rawCode = await requestCompletion(vibeSource, config);

        if (!rawCode.trim()) {
          vscode.window.showErrorMessage(
            `${EXTENSION_ID}: Received an empty response from the API. Please try again.`,
          );
          return;
        }

        progress.report({ message: 'Writing output file…' });

        const cleanCode = stripMarkdownFences(rawCode);
        const outputName = await writeAndOpenCFile(filePath, cleanCode);

        vscode.window.showInformationMessage(`${EXTENSION_ID}: Successfully compiled → ${outputName}`);
      } catch (error: unknown) {
        handleCompilationError(error);
      }
    },
  );
}

// ---------------------------------------------------------------------------
// Activation / Deactivation
// ---------------------------------------------------------------------------

export function activate(context: vscode.ExtensionContext): void {
  const compileCommand = vscode.commands.registerCommand('vibec.compile', compileVibeFile);
  context.subscriptions.push(compileCommand);
}

export function deactivate(): void {
  // Nothing to dispose — all disposables are tracked via context.subscriptions.
}
