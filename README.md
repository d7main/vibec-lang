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

## Architectural Features

* **Syntax-Free Transpilation:** Eliminates boilerplate code production by interpreting architectural intent rather than enforcing rigid formatting guidelines or syntax constraints.
* **Backend Autonomy:** Fully LLM-agnostic. Supports any OpenAI-compatible completions endpoint, including cloud infrastructure (Groq, OpenRouter) and offline processing environments (Ollama, LM Studio).
* **Native VS Code Integration:** Implements native asynchronous progress monitoring APIs to ensure UI responsiveness during the generation cycle.

---

## Configuration

The extension exposes variables within the VS Code settings namespace. Access these parameters via the Configuration Editor (`Ctrl + ,` / `Cmd + ,`) by searching for `vibeC`.

| Setting Option | Data Type | Default Value | Description |
| :--- | :--- | :--- | :--- |
| `vibeC.apiKey` | String | `""` | Authentication token for the selected LLM provider. |
| `vibeC.apiUrl` | String | `https://api.groq.com/openai/v1/chat/completions` | The full endpoint URL for the chat completions request. |
| `vibeC.modelName` | String | `llama-3.3-70b-versatile` | The target model identifier to handle the structural generation. |

> **Local Execution Tip:** For offline execution via Ollama, redirect the target URL to `http://localhost:11434/v1/chat/completions` and provide a placeholder value for the API key.

---
<img width="1155" height="668" alt="Snímek obrazovky 2026-05-26 172617" src="https://github.com/user-attachments/assets/7c5644d0-ee80-4618-87e6-365b76d4e1c9" />
## Installation & Deployment
>>>>>>> 8db49f748e30c332e6662384ed58a1febf4be1cc

### Prerequisites
* Node.js (v18 or higher recommended)
* Visual Studio Code

<<<<<<< HEAD
### Local Deployment
1. Clone the repository to your local environment:
   ```bash
   git clone [https://github.com/d7main/vibec-lang.git](https://github.com/d7main/vibec-lang.git)
=======
## Showcase & Demonstration

### 1. Extension Configuration Namespace
Access the dedicated configuration block via `Ctrl + ,` to manage API routing parameters, secure authorization keys, and change target model architectures dynamically.

<img width="1502" height="639" alt="Snímek obrazovky 2026-05-26 173718" src="https://github.com/user-attachments/assets/cdcbee52-ca69-400c-8e84-98edc54427b6" />

### 2. File Creation Pipeline
Initialize any `.vibe` target file using the native file system interface within the isolated Extension Development Host environment.
<img width="1523" height="220" alt="Snímek obrazovky 2026-05-26 173847" src="https://github.com/user-attachments/assets/21ebaefc-5e92-402e-88d9-3e922b6ec1a1" />


### 3. Intent-Driven Transpilation
Write high-level operational descriptions in plain natural language. The compilation process interprets structural intention and delivers compliant outputs immediately.

<img width="1525" height="297" alt="Snímek obrazovky 2026-05-26 173928" src="https://github.com/user-attachments/assets/cb73f0f8-0a3f-4425-8646-cbedd2598837" />



### Local Setup
1. Clone the repository:
   ```bash
  
   Access the root directory and install the development dependencies:
   ```bash
cd vibec-lang
npm install

   git clone [https://github.com/d7main/vibec-lang.git](https://github.com/d7main/vibec-lang.git)
>>>>>>> 8db49f748e30c332e6662384ed58a1febf4be1cc
