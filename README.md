<<<<<<< HEAD
README.md
# vibeC

An unconventional, LLM-powered Domain Specific Language (DSL) and Visual Studio Code extension that transpiles natural language specifications and structural intentions directly into clean, compliant C code.

Unlike traditional compilers that rely on strict grammar parsing, vibeC utilizes an abstraction layer driven by Large Language Models, allowing developers to generate functional C modules from high-level behavioral descriptions.

## Architectural Features

* **Syntax-Free Transpilation:** Eliminates boilerplate code production by interpreting intent rather than enforcing rigid formatting guidelines.
* **Backend Autonomy:** Fully LLM-agnostic. Supports any OpenAI-compatible completions endpoint, including cloud-based infrastructure (Groq, OpenRouter) and offline processing environments (Ollama, LM Studio).
* **Native VS Code Integration:** Implements native progress monitoring APIs and structured asynchronous task processing to ensure UI responsiveness.

## Installation and Setup
=======

<p align="center">
  <img src="https://img.shields.io/github/v/release/d7main/vibec-lang?style=flat-square&color=66ffff" alt="Release Version">
  <img src="https://img.shields.io/github/license/d7main/vibec-lang?style=flat-square&color=66ffff" alt="License">
  <img src="https://img.shields.io/badge/platform-VS%20Code-007acc?style=flat-square" alt="Platform">
</p>

<h1 align="center">vibeC</h1>

<p align="center">
  <strong>An unconventional, AI-driven Domain Specific Language (DSL) and Visual Studio Code extension that transpiles natural language specifications into clean, compliant C code.</strong>
</p>

---

> Traditional compilers rely on strict grammar parsing. vibeC shifts the paradigm by utilizing an abstraction layer driven by Large Language Models, allowing developers to generate functional, production-ready C modules from high-level behavioral descriptions and pure intentions.

---

---

## Technical Features

### 1. Hardware Pin Validation Rules
The extension incorporates real-time electrical layout validation directly inside the webview rendering layer:
- **Conflict Detection:** If multiple distinct components claim the same physical hardware pin (excluding common power references like `VCC`, `GND`, `3V3`, `5V`), the UI flags the pin with a high-priority warning: `⚠️ CONFLICT!`.
- **Strapping Pin Guard:** When compiling targeting the ESP32 platform, the rendering engine verifies the output pin assignments against known hardware strapping pins (`GPIO 0`, `GPIO 1`, `GPIO 3`, `GPIO 5`, `GPIO 12`, `GPIO 15`). If a component uses a strapping pin, the UI raises a warning badge: `⚠️ STRAPPING PIN!`, protecting developers from boot-sequence failures.

### 2. PlatformIO Environment Injection
vibeC automatically configures a functional developer environment:
- **Target Platform Injection:** Depending on the selected target, the compiler generates a fully structured `platformio.ini` in the project root:
  - **ESP32:** Configures `platform = espressif32`, `board = esp32dev`, and `framework = arduino`.
  - **AVR:** Configures `platform = atmelavr`, `board = uno`, and `framework = arduino`.
- **Dependency Integration:** The external library requirements parsed from the model's `<vibe_meta>` block are translated directly into the configuration as separate, clean lines inside the `lib_deps` setting block.

### 3. Concurrency & Synchronization State Locks
To ensure operational stability and prevent recursion loops, the extension implements locks at both the backend and frontend:
- **ignoreWatcher Lock:** An internal boolean flag `ignoreWatcher` is managed within the extension scope. During automated file writes by the synchronization agent, `ignoreWatcher` is set to `true`. This instructs the active `FileSystemWatcher` to ignore the filesystem writes, eliminating infinite-loop refactoring cascades. Once files are written, `ignoreWatcher` is restored to `false` within a `finally` safety block.
- **UI Interaction Lock:** When the terminal is in a `syncing` state, all compilation and refactoring controls (including `#compileBtn` and `#agentSyncBtn`) are disabled, ensuring execution runs to completion before a new request is initialized.

---

## Technical Configuration Namespace

The extension settings namespace resides under `vibeC` configuration properties:

| Configuration Parameter | Data Type | Default Value | Description |
| :--- | :--- | :--- | :--- |
| `vibeC.apiKey` | String | `""` | Bearer authentication token for authorization with the completions provider. |
| `vibeC.apiUrl` | String | `https://api.groq.com/openai/v1/chat/completions` | Fully qualified URL routing requests to the target completions API. |
| `vibeC.modelName` | String | `llama-3.3-70b-versatile` | The target model identifier passed inside the request body payload. |

---

## Troubleshooting

| Incident / Symptom | Root Cause | Remediation Procedure |
| :--- | :--- | :--- |
| **IntelliSense errors** (undefined headers or syntax highlighting markers) in VS Code editor. | VS Code IntelliSense is referencing the global workspace folder instead of the generated project directory subfolders. | Run the PlatformIO Rebuild IntelliSense Index command, or open the generated project subdirectory directly as the workspace root. |
| **File watcher infinite loops** (sync loop executes repeatedly after write lock releases). | The `ignoreWatcher` concurrency lock is not engaged, causing filesystem writes from the refactoring routine to trigger the watcher. | Ensure that `ignoreWatcher` is set to `true` immediately before filesystem writes in `runProjectSync` and returned to `false` in a `finally` block. |
| **API Connection Timeout / Post Failures.** | High latency or connection drop-offs on the completions endpoint (timeout set to 120,000ms). | Verify network routing, validate configuration values for `apiUrl` and `apiKey`, and check the service status of the completions provider. |
| **Missing/Malformed Hardware Configuration Map.** | The LLM failed to output a structurally correct `<vibe_meta>` JSON block or omitted the closing tag entirely. | Recompile the `.vibe` source. Ensure the specification file clearly requests hardware integrations, prompting the LLM to output peripheral details. |
