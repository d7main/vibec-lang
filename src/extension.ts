import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs/promises';
import axios, { AxiosError } from 'axios';
import { VibeCSidebarProvider } from './vibeCSidebarProvider';

// ---------------------------------------------------------------------------
// Module state
// ---------------------------------------------------------------------------
let activeProjectWatcher: vscode.FileSystemWatcher | undefined;
let ignoreWatcher = false;

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
    'At the very end of your response, you MUST append a hidden, strictly structured JSON block enclosed in a unique custom tag pair: <vibe_meta> and </vibe_meta>. ' +
    'The JSON structure inside <vibe_meta> must look exactly like this: { "components": [ { "name": "SSD1306", "pin_name": "VCC", "target": "3V3" } ], "libraries": ["Adafruit SSD1306", "Adafruit GFX Library"] }. ' +
    'Output ONLY clean, compilable code followed by the <vibe_meta> block — no markdown wrappers, no explanations. ' +
    'CRITICAL: You must always output a valid <vibe_meta> JSON block at the very end of your response detailing every single physical wire connection and external libraries. Do not omit this tag under any circumstances.',

  'Arduino Uno/Nano (AVR)':
    'You are an Expert AVR Embedded Engineer and the vibeC compiler. ' +
    'Translate the user\'s high-level vibe instructions into fully-functional Arduino .ino code targeting the Arduino Uno/Nano (ATmega328P). ' +
    'Optimize for low memory (2 KB SRAM, 32 KB Flash). Avoid dynamic memory allocation where possible. ' +
    'At the very end of your response, you MUST append a hidden, strictly structured JSON block enclosed in a unique custom tag pair: <vibe_meta> and </vibe_meta>. ' +
    'The JSON structure inside <vibe_meta> must look exactly like this: { "components": [ { "name": "Button", "pin_name": "Data", "target": "GPIO 4" } ], "libraries": [] }. ' +
    'Output ONLY clean, compilable code followed by the <vibe_meta> block — no markdown wrappers, no explanations. ' +
    'CRITICAL: You must always output a valid <vibe_meta> JSON block at the very end of your response detailing every single physical wire connection and external libraries. Do not omit this tag under any circumstances.',

  'Standard C (Generic)':
    'You are the vibeC compiler. Translate the user\'s high-level vibe instructions ' +
    'into pure, valid, and fully-functional C source code. ' +
    'Output ONLY clean C code, no markdown wrappers, no explanations.',
};

const MODULAR_SYSTEM_PROMPTS: Record<TargetPlatform, string> = {
  'ESP32 (Arduino Framework)':
    'You are an Expert ESP32 Embedded Engineer and the vibeC compiler. ' +
    'Translate the user\'s high-level vibe instructions into fully-functional, production-ready, object-oriented C++ code targeting the ESP32 (Arduino framework). ' +
    'You MUST split the solution into clean modular files following PlatformIO conventions. ' +
    'Return ALL files inside a <vibe_files> tag block, using the delimiter format "--- FILE: <path> ---" before each file. ' +
    'The structure must include at minimum: src/main.cpp, and for each logical component a header in include/ and implementation in src/. ' +
    'Example structure:\n' +
    '<vibe_files>\n--- FILE: src/main.cpp ---\n[code]\n--- FILE: include/Display.h ---\n[code]\n--- FILE: src/Display.cpp ---\n[code]\n</vibe_files>\n\n' +
    'Use ESP32-specific libraries (Wi-Fi, BLE, etc.) when the instructions require networking or Bluetooth functionality. ' +
    'After the </vibe_files> closing tag, you MUST append a hidden JSON block enclosed in <vibe_meta> and </vibe_meta>. ' +
    'The JSON structure inside <vibe_meta> must look exactly like this: { "components": [ { "name": "SSD1306", "pin_name": "VCC", "target": "3V3" } ], "libraries": ["Adafruit SSD1306", "Adafruit GFX Library"] }. ' +
    'Output ONLY the <vibe_files> block followed by the <vibe_meta> block — no markdown wrappers, no explanations. ' +
    'CRITICAL: You must always output a valid <vibe_meta> JSON block at the very end of your response detailing every single physical wire connection and external libraries. Do not omit this tag under any circumstances.',

  'Arduino Uno/Nano (AVR)':
    'You are an Expert AVR Embedded Engineer and the vibeC compiler. ' +
    'Translate the user\'s high-level vibe instructions into fully-functional, production-ready, object-oriented C++ code targeting the Arduino Uno/Nano (ATmega328P). ' +
    'Optimize for low memory (2 KB SRAM, 32 KB Flash). Avoid dynamic memory allocation where possible. ' +
    'You MUST split the solution into clean modular files following PlatformIO conventions. ' +
    'Return ALL files inside a <vibe_files> tag block, using the delimiter format "--- FILE: <path> ---" before each file. ' +
    'The structure must include at minimum: src/main.cpp, and for each logical component a header in include/ and implementation in src/. ' +
    'Example structure:\n' +
    '<vibe_files>\n--- FILE: src/main.cpp ---\n[code]\n--- FILE: include/Sensor.h ---\n[code]\n--- FILE: src/Sensor.cpp ---\n[code]\n</vibe_files>\n\n' +
    'After the </vibe_files> closing tag, you MUST append a hidden JSON block enclosed in <vibe_meta> and </vibe_meta>. ' +
    'The JSON structure inside <vibe_meta> must look exactly like this: { "components": [ { "name": "Button", "pin_name": "Data", "target": "GPIO 4" } ], "libraries": [] }. ' +
    'Output ONLY the <vibe_files> block followed by the <vibe_meta> block — no markdown wrappers, no explanations. ' +
    'CRITICAL: You must always output a valid <vibe_meta> JSON block at the very end of your response detailing every single physical wire connection and external libraries. Do not omit this tag under any circumstances.',

  'Standard C (Generic)':
    'You are the vibeC compiler. Translate the user\'s high-level vibe instructions ' +
    'into pure, valid, and fully-functional C source code. ' +
    'Output ONLY clean C code, no markdown wrappers, no explanations.',
};

const PIO_NATIVE_SYSTEM_PROMPTS: Record<TargetPlatform, string> = {
  'ESP32 (Arduino Framework)':
    `You are an elite embedded systems architect specializing in industrial-grade ESP32/Arduino C++ development within the PlatformIO ecosystem.
CRITICAL INSTRUCTION: You must split the entire solution into clean, production-ready, object-oriented modules (header and source pairs) and separate them using strict file delimiters inside a single <vibe_files> block. 

DO NOT use general markdown code fences (like \`\`\`) around the files. Use ONLY the explicit file delimiters.

Follow this EXACT output structure and generate ALL referenced files (main, engine headers, engine source):

<vibe_files>
--- FILE: src/main.cpp ---
#include <Arduino.h>
#include "AppEngine.h"

AppEngine engine;

void setup() {
    engine.begin();
}

void loop() {
    engine.update();
}
--- FILE: include/AppEngine.h ---
#pragma once
#include <Arduino.h>

class AppEngine {
public:
    AppEngine();
    void begin();
    void update();
};
--- FILE: src/AppEngine.cpp ---
#include "AppEngine.h"

AppEngine::AppEngine() {}
void AppEngine::begin() {
    Serial.begin(115200);
}
void AppEngine::update() {
    // core systems loop
}
</vibe_files>

CRITICAL: You must always output a valid <vibe_meta> JSON block at the very end of your response detailing every single physical wire connection and external libraries. Do not omit this tag under any circumstances.`,

  'Arduino Uno/Nano (AVR)':
    `You are an elite embedded systems architect specializing in industrial-grade ESP32/Arduino C++ development within the PlatformIO ecosystem.
CRITICAL INSTRUCTION: You must split the entire solution into clean, production-ready, object-oriented modules (header and source pairs) and separate them using strict file delimiters inside a single <vibe_files> block. 

DO NOT use general markdown code fences (like \`\`\`) around the files. Use ONLY the explicit file delimiters.

Follow this EXACT output structure and generate ALL referenced files (main, engine headers, engine source):

<vibe_files>
--- FILE: src/main.cpp ---
#include <Arduino.h>
#include "AppEngine.h"

AppEngine engine;

void setup() {
    engine.begin();
}

void loop() {
    engine.update();
}
--- FILE: include/AppEngine.h ---
#pragma once
#include <Arduino.h>

class AppEngine {
public:
    AppEngine();
    void begin();
    void update();
};
--- FILE: src/AppEngine.cpp ---
#include "AppEngine.h"

AppEngine::AppEngine() {}
void AppEngine::begin() {
    Serial.begin(115200);
}
void AppEngine::update() {
    // core systems loop
}
</vibe_files>

CRITICAL: You must always output a valid <vibe_meta> JSON block at the very end of your response detailing every single physical wire connection and external libraries. Do not omit this tag under any circumstances.`,

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
  codeStructure: string = 'single',
): Promise<string> {
  let systemPrompt = SYSTEM_PROMPTS[platform];
  if (platform !== 'Standard C (Generic)') {
    if (codeStructure === 'modular') {
      systemPrompt = MODULAR_SYSTEM_PROMPTS[platform];
    } else if (codeStructure === 'pio_native') {
      systemPrompt = PIO_NATIVE_SYSTEM_PROMPTS[platform];
    }
  }

  const response = await axios.post<ChatCompletionResponse>(
    config.apiUrl,
    {
      model: config.modelName,
      messages: [
        { role: 'system', content: systemPrompt },
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
 * Safely extracts the <vibe_meta> block from the LLM response, stripping
 * inner markdown fences and parsing the JSON. It returns the cleaned code
 * with the meta block entirely removed.
 */
function extractHardwareMetadata(llmResponse: string): { metadata: any; cleanedCode: string } {
  let metadata: any = { components: [], libraries: [] };
  let cleanedCode = llmResponse;

  const metaRegex = /<vibe_meta>([\s\S]*?)<\/vibe_meta>/i;
  const match = cleanedCode.match(metaRegex);
  if (match) {
    let rawJson = match[1].trim();
    // Strip possible markdown around JSON
    rawJson = rawJson
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim();
    try {
      metadata = JSON.parse(rawJson);
    } catch (e) {
      console.error('Failed to parse vibe_meta JSON', e);
    }
    // Remove the entire block from the code
    cleanedCode = cleanedCode.replace(metaRegex, '').trim();
  }

  return { metadata, cleanedCode };
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
 * Parses the LLM response for modular multi-file output enclosed in
 * <vibe_files> tags with `--- FILE: <path> ---` delimiters.
 *
 * @returns An array of file descriptors, or `null` if no modular block was found.
 */
function parseVibeFiles(
  raw: string,
): Array<{ relativePath: string; content: string }> | null {
  const wrapperMatch = raw.match(/<vibe_files>([\s\S]*?)<\/vibe_files>/i);
  if (!wrapperMatch) {
    return null;
  }

  const body = wrapperMatch[1];
  const fileRegex = /---\s*FILE:\s*(.+?)\s*---\n((?:[\s\S](?!---\s*FILE:))*)/gi;
  const files: Array<{ relativePath: string; content: string }> = [];

  let match: RegExpExecArray | null;
  while ((match = fileRegex.exec(body)) !== null) {
    let content = match[2].trim();
    // Strip accidental markdown code fences around individual file contents
    content = content
      .replace(/^```(?:c|cpp|ino)?\s*\n?/i, '')
      .replace(/\n?\s*```$/i, '')
      .trim();

    files.push({
      relativePath: match[1].trim(),
      content: content,
    });
  }

  return files.length > 0 ? files : null;
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
  metadata?: { libraries?: string[] }
): Promise<string> {
  const dir = path.dirname(vibeFilePath);
  const baseName = path.basename(vibeFilePath, '.vibe');
  const ext = outputExtension(platform);
  const outFileName = `${baseName}${ext}`;
  const outFilePath = path.join(dir, outFileName);

  await fs.writeFile(outFilePath, content, 'utf-8');

  // Generate platformio.ini
  if (platform !== 'Standard C (Generic)') {
    const pioFile = path.join(dir, 'platformio.ini');
    let pioContent = '';
    
    if (platform === 'ESP32 (Arduino Framework)') {
      pioContent += '[env:esp32dev]\nplatform = espressif32\nboard = esp32dev\nframework = arduino\n';
    } else if (platform === 'Arduino Uno/Nano (AVR)') {
      pioContent += '[env:uno]\nplatform = atmelavr\nboard = uno\nframework = arduino\n';
    }

    if (metadata && metadata.libraries && metadata.libraries.length > 0) {
      pioContent += 'lib_deps =\n';
      for (const lib of metadata.libraries) {
        pioContent += `  ${lib}\n`;
      }
    }

    await fs.writeFile(pioFile, pioContent, 'utf-8');
  }

  const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(outFilePath));
  await vscode.window.showTextDocument(doc, vscode.ViewColumn.Beside);

  return outFileName;
}

/**
 * Creates a PlatformIO-compatible project folder from parsed modular files.
 * The project folder is named after the `.vibe` file and placed beside it.
 *
 * @returns The absolute path to the created project directory.
 */
async function writeModularProject(
  vibeFilePath: string,
  files: Array<{ relativePath: string; content: string }>,
  platform: TargetPlatform,
  metadata?: { libraries?: string[] },
): Promise<string> {
  const dir = path.dirname(vibeFilePath);
  const baseName = path.basename(vibeFilePath, '.vibe');
  const projectDir = path.join(dir, baseName);

  // Create project root
  await fs.mkdir(projectDir, { recursive: true });

  // Write each module file into its correct subdirectory
  for (const file of files) {
    const filePath = path.join(projectDir, file.relativePath);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, file.content, 'utf-8');
  }

  // Generate platformio.ini in the project root
  if (platform !== 'Standard C (Generic)') {
    let pioContent = '';

    if (platform === 'ESP32 (Arduino Framework)') {
      pioContent += '[env:esp32dev]\nplatform = espressif32\nboard = esp32dev\nframework = arduino\n';
    } else if (platform === 'Arduino Uno/Nano (AVR)') {
      pioContent += '[env:uno]\nplatform = atmelavr\nboard = uno\nframework = arduino\n';
    }

    if (metadata && metadata.libraries && metadata.libraries.length > 0) {
      pioContent += 'lib_deps =\n';
      for (const lib of metadata.libraries) {
        pioContent += `  ${lib}\n`;
      }
    }

    await fs.writeFile(path.join(projectDir, 'platformio.ini'), pioContent, 'utf-8');
  }

  // Open the main entry file in a side-by-side editor
  const mainFile = files.find((f) => f.relativePath.includes('main.cpp'));
  if (mainFile) {
    const doc = await vscode.workspace.openTextDocument(
      vscode.Uri.file(path.join(projectDir, mainFile.relativePath)),
    );
    await vscode.window.showTextDocument(doc, vscode.ViewColumn.Beside);
  }

  return projectDir;
}

/**
 * Sends compiled code and vibe source to the LLM to generate a professional
 * SPECIFICATION.md engineering document, then writes it to the project root.
 */
async function generateSpecification(
  vibeSource: string,
  compiledCode: string,
  config: VibeCConfig,
  projectDir: string,
): Promise<void> {
  const specPrompt =
    'You are a senior embedded systems documentation engineer. ' +
    'Analyze the following generated hardware architecture and code, and produce a professional, comprehensive engineering document in Markdown format. ' +
    'The document MUST include the following sections:\n' +
    '1. **System Architecture Overview** — High-level description of the system, its purpose, and design rationale.\n' +
    '2. **Hardware Pinout Wiring Matrix** — A clean Markdown table mapping every component pin to its target MCU pin, including voltage levels and signal type.\n' +
    '3. **API/Function Reference** — Doxygen-style documentation for every class, method, and significant function in the codebase.\n' +
    '4. **Dependencies and Library Requirements** — List all external libraries, their versions (if known), and what they provide.\n\n' +
    'Output ONLY the Markdown document content. Do NOT wrap it in code fences.';

  const userContent =
    '## Original Vibe Source\n```\n' + vibeSource + '\n```\n\n' +
    '## Generated Code\n```cpp\n' + compiledCode + '\n```';

  const response = await axios.post<ChatCompletionResponse>(
    config.apiUrl,
    {
      model: config.modelName,
      messages: [
        { role: 'system', content: specPrompt },
        { role: 'user', content: userContent },
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

  let specContent = response.data?.choices?.[0]?.message?.content ?? '';
  specContent = stripMarkdownFences(specContent);

  if (!specContent.trim()) {
    vscode.window.showErrorMessage(`${EXTENSION_ID}: Failed to generate specification — empty response.`);
    return;
  }

  const specPath = path.join(projectDir, 'SPECIFICATION.md');
  await fs.mkdir(path.dirname(specPath), { recursive: true });
  await fs.writeFile(specPath, specContent, 'utf-8');

  vscode.window.showInformationMessage('System specification document generated successfully!');

  // Open the spec file in a side-by-side editor
  const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(specPath));
  await vscode.window.showTextDocument(doc, vscode.ViewColumn.Beside);
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

/**
 * Recursively retrieves all .cpp and .h files within the project directory.
 */
async function getProjectCodeFiles(dir: string): Promise<Array<{ relativePath: string; content: string }>> {
  const files: Array<{ relativePath: string; content: string }> = [];
  async function walk(currentDir: string) {
    const entries = await fs.readdir(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        await walk(fullPath);
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        if (ext === '.cpp' || ext === '.h') {
          const relPath = path.relative(dir, fullPath).replace(/\\/g, '/');
          const content = await fs.readFile(fullPath, 'utf-8');
          files.push({ relativePath: relPath, content });
        }
      }
    }
  }
  await walk(dir);
  return files;
}

/**
 * Runs the project-wide synchronization via the LLM refactoring agent.
 */
async function runProjectSync(projectDir: string, sidebar: VibeCSidebarProvider): Promise<void> {
  const config = await resolveConfig();
  if (!config) {
    vscode.window.showErrorMessage(`${EXTENSION_ID}: API Key is not configured for synchronization.`);
    sidebar.postAgentState('disabled');
    return;
  }

  sidebar.postAgentState('syncing');

  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: "vibeC Agent",
      cancellable: false,
    },
    async (progress) => {
      progress.report({ message: "Gathering project files..." });
      sidebar.postAgentLog("Gathering project files...");
      try {
        const codeFiles = await getProjectCodeFiles(projectDir);
        if (codeFiles.length === 0) {
          vscode.window.showWarningMessage(`${EXTENSION_ID}: No code files found in the project to synchronize.`);
          sidebar.postAgentLog("Warning: No code files found in the project to synchronize.");
          return;
        }

        // Prepare LLM prompt with the current files
        let userContent = "Here are the current files in the project:\n\n";
        for (const file of codeFiles) {
          userContent += `--- FILE: ${file.relativePath} ---\n${file.content}\n\n`;
        }
        userContent += "Please analyze the codebase, identify any references that need to be synchronized, and output the updated files enclosed in <vibe_files> tags using the delimiter format '--- FILE: <path> ---'.";

        progress.report({ message: "Analyzing changes and synchronizing..." });
        sidebar.postAgentLog("Analyzing codebase diffs...");
        
        const systemPrompt = 
          "You are an automated refactoring agent. The user modified one of the files in the project directory. " +
          "Analyze the change, locate any broken references, variable mismatches, or altered function signatures in the OTHER files, " +
          "and output the updated content for those affected files only, wrapped inside <vibe_files> tags.";

        const response = await axios.post<ChatCompletionResponse>(
          config.apiUrl,
          {
            model: config.modelName,
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: userContent },
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

        const rawResponse = response.data?.choices?.[0]?.message?.content ?? '';
        if (!rawResponse.trim()) {
          vscode.window.showWarningMessage(`${EXTENSION_ID}: Received empty response from sync agent.`);
          sidebar.postAgentLog("Error: Received empty response from sync agent.");
          return;
        }

        progress.report({ message: "Writing updates..." });
        sidebar.postAgentLog("Writing updated header architectures...");

        const parsedFiles = parseVibeFiles(rawResponse);
        if (parsedFiles && parsedFiles.length > 0) {
          ignoreWatcher = true;
          try {
            for (const file of parsedFiles) {
              const filePath = path.join(projectDir, file.relativePath);
              await fs.mkdir(path.dirname(filePath), { recursive: true });
              await fs.writeFile(filePath, file.content, 'utf-8');
              sidebar.postAgentLog(`Successfully updated: ${file.relativePath}`);
            }
          } finally {
            ignoreWatcher = false;
          }
          vscode.window.showInformationMessage("Project fully synchronized by vibeC Agent!");
          sidebar.postAgentLog("Success: Project fully synchronized by vibeC Agent.");
        } else {
          vscode.window.showInformationMessage("vibeC Agent: Codebase is already synchronized. No changes needed.");
          sidebar.postAgentLog("Info: Codebase is already synchronized. No changes needed.");
        }
      } catch (error: unknown) {
        const errMsg = handleCompilationError(error);
        sidebar.postAgentLog(`Error: ${errMsg}`);
      } finally {
        sidebar.postAgentState('idle');
      }
    }
  );
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
  codeStructure: string = 'single',
): Promise<void> {
  // Dispose of any active watcher before compilation starts
  if (activeProjectWatcher) {
    activeProjectWatcher.dispose();
    activeProjectWatcher = undefined;
  }

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
        // Choose prompt set based on code structure mode
        const isModular = (codeStructure === 'modular' || codeStructure === 'pio_native') && platform !== 'Standard C (Generic)';
        const rawCode = await requestCompletion(vibeSource, config, platform, codeStructure);

        if (!rawCode.trim()) {
          const msg = 'Received an empty response from the API. Please try again.';
          vscode.window.showErrorMessage(`${EXTENSION_ID}: ${msg}`);
          sidebar.sendStatus('error', msg);
          return;
        }

        progress.report({ message: 'Writing output file…' });

        // --- Extract hardware map JSON ---------------------------------------
        let hardwareMapJson: any = { components: [], libraries: [] };
        let codeWithoutMeta = rawCode;

        if (platform !== 'Standard C (Generic)') {
          const extracted = extractHardwareMetadata(rawCode);
          hardwareMapJson = extracted.metadata;
          codeWithoutMeta = extracted.cleanedCode;
        }

        let cleanCode = stripMarkdownFences(codeWithoutMeta);

        sidebar.sendHardwareMap(hardwareMapJson);
        sidebar.setLastCompiledCode(cleanCode);

        // --- Modular or single-file output -----------------------------------
        if (isModular) {
          const parsedFiles = parseVibeFiles(cleanCode);
          if (parsedFiles && parsedFiles.length > 0) {
            // Strip the <vibe_files> wrapper for the stored "clean code"
            const codeWithoutWrapper = cleanCode
              .replace(/<vibe_files>[\s\S]*?<\/vibe_files>/i, '')
              .trim();
            sidebar.setLastCompiledCode(codeWithoutWrapper || cleanCode);

            const projectDir = await writeModularProject(
              filePath, parsedFiles, platform, hardwareMapJson,
            );
            sidebar.setLastProjectDir(projectDir);

            // Set up a new filesystem watcher for project synchronization
            const pattern = new vscode.RelativePattern(projectDir, '**/*.{cpp,h,ini}');
            activeProjectWatcher = vscode.workspace.createFileSystemWatcher(pattern);

            let debounceTimer: NodeJS.Timeout | undefined;
            activeProjectWatcher.onDidChange((uri) => {
              if (ignoreWatcher) {
                return;
              }
              if (debounceTimer) {
                clearTimeout(debounceTimer);
              }
              debounceTimer = setTimeout(() => {
                const fileName = path.basename(uri.fsPath);
                sidebar.postAgentState('pending_sync', fileName);
              }, 1500);
            });

            const folderName = path.basename(projectDir);
            const msg = `Compiled → ${folderName}/ (${parsedFiles.length} modules)`;
            vscode.window.showInformationMessage(
              `${EXTENSION_ID}: ${msg} [${platform}]`,
            );
            sidebar.sendStatus('success', msg);
            sidebar.postAgentState('idle');
          } else {
            // Fallback: modular parse failed, write as single file
            const outputName = await writeAndOpenOutputFile(
              filePath, cleanCode, platform, hardwareMapJson,
            );
            sidebar.setLastProjectDir(path.dirname(filePath));

            const msg = `Compiled → ${outputName} (modular parse failed, single-file fallback)`;
            vscode.window.showInformationMessage(
              `${EXTENSION_ID}: ${msg} [${platform}]`,
            );
            sidebar.sendStatus('success', msg);
            sidebar.postAgentState('disabled');
          }
        } else {
          const outputName = await writeAndOpenOutputFile(
            filePath, cleanCode, platform, hardwareMapJson,
          );
          sidebar.setLastProjectDir(path.dirname(filePath));

          const msg = `Compiled → ${outputName}`;
          vscode.window.showInformationMessage(
            `${EXTENSION_ID}: ${msg} [${platform}]`,
          );
          sidebar.sendStatus('success', msg);
          sidebar.postAgentState('disabled');
        }
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

  sidebarProvider.onAgentSync = () => {
    const projectDir = sidebarProvider.getLastProjectDir();
    if (projectDir) {
      runProjectSync(projectDir, sidebarProvider);
    } else {
      vscode.window.showWarningMessage('vibeC Agent: No active project directory found. Please compile a .vibe file first.');
    }
  };

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
        const codeStructure = sidebarProvider.getSelectedCodeStructure();
        return compileVibeFile(platform, sidebarProvider, codeStructure);
      },
    ),
  );

  // 3. Register the generate-docs command.
  context.subscriptions.push(
    vscode.commands.registerCommand('vibec.generateDocs', async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showWarningMessage(
          `${EXTENSION_ID}: No active editor found. Please open a .vibe file.`,
        );
        return;
      }

      const config = await resolveConfig();
      if (!config) {
        return;
      }

      const vibeSource = editor.document.getText();
      const compiledCode = sidebarProvider.getLastCompiledCode();
      if (!compiledCode) {
        vscode.window.showWarningMessage(
          `${EXTENSION_ID}: No compiled code available. Compile a .vibe file first.`,
        );
        return;
      }

      const projectDir = sidebarProvider.getLastProjectDir();
      if (!projectDir) {
        vscode.window.showWarningMessage(
          `${EXTENSION_ID}: No project directory available. Compile a .vibe file first.`,
        );
        return;
      }


      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: `${EXTENSION_ID}`,
          cancellable: false,
        },
        async (progress) => {
          progress.report({ message: 'Generating system specification…' });
          try {
            await generateSpecification(
              vibeSource,
              compiledCode,
              config,
              projectDir,
            );
          } catch (error: unknown) {
            handleCompilationError(error);
          }
        },
      );
    }),
  );
}

export function deactivate(): void {
  if (activeProjectWatcher) {
    activeProjectWatcher.dispose();
  }
}
