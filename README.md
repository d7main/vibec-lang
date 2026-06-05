# vibeC (vibe-C)

The vibeC extension is a hardware-aware architecture generator and real-time project synchronization companion designed specifically for embedded systems development utilizing ESP32, Arduino, and the PlatformIO ecosystem within Visual Studio Code.

Unlike standard software-focused AI assistants, vibeC bridges natural language requirements with physical hardware constraints. It evaluates peripheral pin configurations, validates signal lines, maps hardware topologies, and actively manages dependencies across modular C++ codebases via an isolated background refactoring agent.

---

## Technical Architecture Overview

The system pipeline structures development into sequential verification and synchronization layers:

```text
                  [ .vibe Source Specification ]
                                │
                                ▼
            [ Hardware Configuration Map Verification ]
                                │
                                ▼
                   [ LLM Generation Pipeline ]
                                │
        ┌───────────────────────┴───────────────────────┐
        ▼                                               ▼
[ Single File Mode ]                        [ PlatformIO Native Mode ]
(Monolithic .ino / .c)                     (Modular OOP C++ Structure)
                                                        │
                                                        ▼
                                           [ Active FileSystemWatcher ]
                                                        │
                                                        ▼
                                           [ vibeC AI Agent Terminal ]
                                          (Isolated Project Refactoring)
## Core Capabilities

### 1. Interactive Hardware Configuration Map
* **Hardware-Aware Constraint Enforcement:** Evaluates physical pin assignments against target microcontroller architectures (e.g., ESP32-S3) directly within the custom sidebar interface.
* **Signal Mapping & Conflict Detection:** Automatically flags overlapping GPIO allocations and structural mismatches (such as mapping digital I2C lines to power rails or invalid hardware serial ports) before triggering code generation.

### 2. PlatformIO Native Architecture Generation
* **Object-Oriented Decoupling:** Generates structured, production-ready C++ directory layouts (`src/`, `include/`) instead of monolithic file formats.
* **Deterministic Configuration:** Encapsulates peripheral drivers and system state machines inside explicit class definitions, implementing rigorous `#pragma once` preprocessor directives and an optimized, pre-configured `platformio.ini` specification file.

### 3. Integrated vibeC AI Agent Terminal
* **Automated Project Synchronization:** Utilizes an asynchronous `FileSystemWatcher` module to monitor local repository modifications.
* **Contextual Dilation Engine:** When structural changes (such as variable renames, hardware pin updates, or method signature mutations) are detected in a single component, the terminal prompts for a unified codebase synchronization. It computes diff boundaries and automates internal adjustments across all interconnected header and source files.

---

## Installation & Environment Setup

### Prerequisites
* **Visual Studio Code** (Version 1.80.0 or higher)
* **PlatformIO IDE Extension** (Required for complete toolchain management and final firmware compilation)
* **Supported AI Inference Endpoint:** Configured API access key (Groq, OpenAI, or a local Ollama instance) defined in VS Code settings under `vibeC.inference.apiKey`.

### Project Initialization
1. Clone the repository into your local development environment.
2. Open the directory inside Visual Studio Code.
3. Construct a `.vibe` source file (e.g., `smarthome.vibe`) containing the high-level description of your target peripherals, sensors, and functional requirements.

---

## Operational Workflow

### Project Generation
1. Initialize the **vibeC Control Panel** from the VS Code Activity Bar.
2. Select the designated platform configuration from the **Target Platform** menu (e.g., `ESP32 (Arduino Framework)`).
3. Set the **Architecture Settings** layer to `PlatformIO Native (Professional OOP)`.
4. Configure peripheral nodes and confirm terminal connections inside the **Hardware Configuration Map**.
5. Execute the generation process by clicking **Compile System Architecture**.
6. The extension instantiates the full hardware abstraction layer, writing the modular code tree directly into the workspace root.

### Utilizing the Agent Terminal
1. Following a successful modular compilation, the **vibeC AI Agent Terminal** enters the `🟢 Idle (Monitoring)` state.
2. Open any generated source component, such as `include/TemperatureSensor.h` or `src/main.cpp`.
3. Manually alter a class property name, a hardware pin definition constant, or a method signature, then save the document (`Ctrl + S`).
4. The system executes a 1.5-second internal debounce routine to prevent premature triggers. Once stabilized, the terminal transitions to `🟡 PENDING SYNC`.
5. Click **Run Sync**. The terminal interface displays the background process execution stream (`Analyzing codebase diffs...`, `Writing updated header architectures...`) and non-destructively reconciles the remaining dependency graphs across the workspace.

---

## Technical Troubleshooting & Core Defenses

### 1. Compilation Markers / IntelliSense Header Invalidation
* **Issue:** Visual Studio Code displays `#include errors detected. Please update your includePath.` markers under hardware core headers like `<Arduino.h>`.
* **Root Cause:** When the workspace is instantiated in an isolated testing environment (`Extension Development Host`), or before the platform subsystem has indexed the folder layout, the Microsoft C/C++ engine lacks path pointers to the target microchip framework headers.
* **Resolution:** Ensure the directory containing the output `platformio.ini` file is opened directly as the primary workspace folder root. PlatformIO will initialize its native build system loop, construct the hidden `.pio` dependency cache, and update `.vscode/c_cpp_properties.json`, resolving the IntelliSense path hierarchy.

### 2. Synchronization Concurrency Lock (Feedback Prevention)
* **Issue:** Automated file writes initiated by an AI modification cycle could trigger a secondary file update event, creating an infinite processing loop.
* **Defensive Strategy:** The architecture contains a dedicated state lock (`ignoreWatcher`). When the AI Agent performs standard workspace disk access, file listeners are temporarily deactivated. The lock automatically re-engages once file system input/output operations resolve completely.

### 3. Agent Terminal Interface Displays "DISABLED"
* **Issue:** The synchronization interface is grayed out, preventing manual execution triggers.
* **Root Cause:** The system is operating under the `Single File (.ino / .c)` configuration matrix.
* **Resolution:** Multi-file variable propagation requires a modular workspace structure. Switch the **Architecture Settings** selector to `PlatformIO Native (Professional OOP)` and recompile the project specification to reinitialize the active tracking routines.

---

## License Summary

This software architecture is distributed under the MIT License. Review the formal `LICENSE` document located in the repository root directory for comprehensive conditions regarding redistribution and commercial utilization.
