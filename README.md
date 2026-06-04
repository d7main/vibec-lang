README.md
# vibeC

An unconventional, LLM-powered Domain Specific Language (DSL) and Visual Studio Code extension that transpiles natural language specifications and structural intentions directly into clean, compliant C code.

Unlike traditional compilers that rely on strict grammar parsing, vibeC utilizes an abstraction layer driven by Large Language Models, allowing developers to generate functional C modules from high-level behavioral descriptions.

## Architectural Features

* **Syntax-Free Transpilation:** Eliminates boilerplate code production by interpreting intent rather than enforcing rigid formatting guidelines.
* **Backend Autonomy:** Fully LLM-agnostic. Supports any OpenAI-compatible completions endpoint, including cloud-based infrastructure (Groq, OpenRouter) and offline processing environments (Ollama, LM Studio).
* **Native VS Code Integration:** Implements native progress monitoring APIs and structured asynchronous task processing to ensure UI responsiveness.

## Installation and Setup

### Prerequisites
* Node.js (v18 or higher recommended)
* Visual Studio Code

### Local Deployment
1. Clone the repository to your local environment:
   ```bash
   git clone [https://github.com/d7main/vibec-lang.git](https://github.com/d7main/vibec-lang.git)