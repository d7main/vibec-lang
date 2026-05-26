<img width="1155" height="668" alt="Snímek obrazovky 2026-05-26 172617" src="https://github.com/user-attachments/assets/7c5644d0-ee80-4618-87e6-365b76d4e1c9" />
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

## Installation & Deployment

### Prerequisites
* Node.js (v18 or higher recommended)
* Visual Studio Code

### Local Setup
1. Clone the repository:
   ```bash
   git clone [https://github.com/d7main/vibec-lang.git](https://github.com/d7main/vibec-lang.git)
