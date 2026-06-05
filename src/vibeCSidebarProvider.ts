import * as vscode from 'vscode';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type StatusState = 'idle' | 'compiling' | 'success' | 'error';

/** Messages sent FROM the webview TO the extension. */
export interface SidebarMessage {
  type: 'compile' | 'platformChanged' | 'copyCode' | 'codeStructureChanged' | 'generateDocs' | 'triggerAgentSync';
  platform?: string;
  codeStructure?: string;
}

// ---------------------------------------------------------------------------
// VibeCSidebarProvider
// ---------------------------------------------------------------------------

export class VibeCSidebarProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'vibeC.sidebarView';

  private _view?: vscode.WebviewView;
  private _selectedPlatform = 'ESP32 (Arduino Framework)';
  private _lastCompiledCode = '';
  private _selectedCodeStructure = 'single';
  private _lastProjectDir = '';

  public onAgentSync?: () => void;

  constructor(private readonly _extensionUri: vscode.Uri) {}

  /** Returns the platform currently selected in the sidebar dropdown. */
  public getSelectedPlatform(): string {
    return this._selectedPlatform;
  }

  /** Push a status update into the sidebar UI. */
  public sendStatus(state: StatusState, message: string): void {
    this._view?.webview.postMessage({ type: 'status', state, message });
  }

  /** Push a hardware map update into the sidebar UI. */
  public sendHardwareMap(mapJson: any): void {
    this._view?.webview.postMessage({ type: 'updateHardwareMap', data: mapJson, platform: this._selectedPlatform });
  }

  /** Stores the last compiled code so it can be copied to the clipboard later. */
  public setLastCompiledCode(code: string): void {
    this._lastCompiledCode = code;
  }

  /** Returns the last compiled code. */
  public getLastCompiledCode(): string {
    return this._lastCompiledCode;
  }

  /** Returns the code structure mode currently selected in the sidebar. */
  public getSelectedCodeStructure(): string {
    return this._selectedCodeStructure;
  }

  /** Returns the directory path of the last compiled project. */
  public getLastProjectDir(): string {
    return this._lastProjectDir;
  }

  /** Stores the last project directory for documentation generation. */
  public setLastProjectDir(dir: string): void {
    this._lastProjectDir = dir;
  }

  /** Push an agent state change to the sidebar UI. */
  public postAgentState(state: string, details?: string): void {
    this._view?.webview.postMessage({ type: 'agentStateChanged', state, details });
  }

  /** Append log text to the sidebar UI's agent console. */
  public postAgentLog(message: string): void {
    this._view?.webview.postMessage({ type: 'agentLogAppend', message });
  }

  // -------------------------------------------------------------------------
  // WebviewViewProvider implementation
  // -------------------------------------------------------------------------

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken,
  ): void {
    this._view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this._extensionUri],
    };

    webviewView.webview.html = this._getHtml(webviewView.webview);

    // Listen for messages coming from the webview JS
    webviewView.webview.onDidReceiveMessage((data: SidebarMessage) => {
      switch (data.type) {
        case 'compile':
          if (data.platform) {
            this._selectedPlatform = data.platform;
          }
          vscode.commands.executeCommand('vibec.compile', this._selectedPlatform);
          break;

        case 'platformChanged':
          if (data.platform) {
            this._selectedPlatform = data.platform;
          }
          break;

        case 'copyCode':
          if (this._lastCompiledCode) {
            vscode.env.clipboard.writeText(this._lastCompiledCode);
            vscode.window.showInformationMessage('Code copied to clipboard!');
          } else {
            vscode.window.showWarningMessage('No generated code available to copy.');
          }
          break;

        case 'codeStructureChanged':
          if (data.codeStructure) {
            this._selectedCodeStructure = data.codeStructure;
          }
          break;

        case 'generateDocs':
          vscode.commands.executeCommand('vibec.generateDocs');
          break;

        case 'triggerAgentSync':
          if (this.onAgentSync) {
            this.onAgentSync();
          }
          break;
      }
    });

    // Post initial agent state if we have an active project
    if (this._lastProjectDir) {
      setTimeout(() => {
        this.postAgentState('idle');
      }, 100);
    } else {
      setTimeout(() => {
        this.postAgentState('disabled');
      }, 100);
    }
  }

  // -------------------------------------------------------------------------
  // HTML generation
  // -------------------------------------------------------------------------

  private _getHtml(_webview: vscode.Webview): string {
    const nonce = getNonce();

    return /* html */ `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy"
        content="default-src 'none'; style-src 'nonce-${nonce}'; script-src 'nonce-${nonce}';">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style nonce="${nonce}">
    /* ── Reset ────────────────────────────────────────────────────────── */
    *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }

    body {
      font-family: var(--vscode-font-family, system-ui, sans-serif);
      font-size: var(--vscode-font-size, 13px);
      color: var(--vscode-foreground);
      background: var(--vscode-sideBar-background);
      line-height: 1.4;
      padding: 12px 16px;
    }

    /* ── Header ───────────────────────────────────────────────────────── */
    .header {
      padding-bottom: 12px;
      margin-bottom: 16px;
      border-bottom: 1px solid var(--vscode-panel-border, var(--vscode-widget-border, rgba(128,128,128,.25)));
    }
    .header-title {
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      color: var(--vscode-sideBarSectionHeader-foreground);
    }

    /* ── Sections ─────────────────────────────────────────────────────── */
    .section { margin-bottom: 16px; }
    .section-label {
      font-size: 11px;
      font-weight: normal;
      color: var(--vscode-foreground);
      margin-bottom: 6px;
      display: block;
    }

    /* ── Platform select ──────────────────────────────────────────────── */
    .platform-select {
      width: 100%;
      padding: 4px;
      font-family: var(--vscode-font-family, system-ui);
      font-size: var(--vscode-font-size, 13px);
      color: var(--vscode-dropdown-foreground);
      background: var(--vscode-dropdown-background);
      border: 1px solid var(--vscode-dropdown-border);
      border-radius: 2px;
      outline: none;
      cursor: pointer;
      appearance: auto;
    }
    .platform-select:focus {
      border-color: var(--vscode-focusBorder);
    }

    /* ── Platform info ────────────────────────────────────────────────── */
    .platform-info {
      margin-top: 6px;
      font-size: 12px;
      color: var(--vscode-descriptionForeground);
    }

    /* ── Compile button ───────────────────────────────────────────────── */
    .compile-btn {
      width: 100%;
      padding: 4px 8px;
      font-family: var(--vscode-font-family, system-ui);
      font-size: var(--vscode-font-size, 13px);
      font-weight: normal;
      color: var(--vscode-button-foreground);
      background: var(--vscode-button-background);
      border: 1px solid transparent;
      border-radius: 2px;
      cursor: pointer;
      display: block;
      text-align: center;
      transition: background-color .1s;
      margin-bottom: 8px;
    }
    .compile-btn:hover:not(:disabled) {
      background: var(--vscode-button-hoverBackground);
    }
    .compile-btn:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }

    /* ── Secondary button ─────────────────────────────────────────────── */
    .secondary-btn {
      width: 100%;
      padding: 4px 8px;
      font-family: var(--vscode-font-family, system-ui);
      font-size: var(--vscode-font-size, 13px);
      font-weight: normal;
      color: var(--vscode-button-secondaryForeground);
      background: var(--vscode-button-secondaryBackground);
      border: 1px solid transparent;
      border-radius: 2px;
      cursor: pointer;
      display: block;
      text-align: center;
      transition: background-color .1s;
    }
    .secondary-btn:hover:not(:disabled) {
      background: var(--vscode-button-secondaryHoverBackground);
    }

    /* ── Hardware Map Components ──────────────────────────────────────── */
    .hw-container {
      margin-top: 6px;
    }
    .hw-placeholder {
      font-size: 12px;
      color: var(--vscode-descriptionForeground);
      padding: 4px 0;
    }
    .hardware-card {
      background: var(--vscode-welcomePage-tile-background);
      border: 1px solid var(--vscode-widget-border, rgba(128,128,128,.25));
      border-radius: 4px;
      margin-bottom: 12px;
      padding: 8px 10px;
      transition: border-color 0.3s;
    }
    .hardware-card.completed {
      border-color: var(--vscode-testing-iconPassedColor, #73c991);
    }
    .hardware-card-header {
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      color: var(--vscode-sideBarSectionHeader-foreground);
      margin-bottom: 8px;
      padding-bottom: 4px;
      border-bottom: 1px solid var(--vscode-widget-border, rgba(128,128,128,.25));
    }
    .hw-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 3px 0;
      transition: opacity 0.2s;
    }
    .hw-row.checked {
      opacity: 0.4;
      text-decoration: line-through;
    }
    .hw-row label {
      display: flex;
      align-items: center;
      gap: 6px;
      cursor: pointer;
      white-space: nowrap;
    }
    .connector-line {
      flex-grow: 1;
      border-bottom: 1px dotted var(--vscode-widget-border, rgba(128,128,128,.5));
      margin: 0 8px;
      opacity: 0.5;
      height: 1px;
    }
    .hw-row input[type="checkbox"] {
      cursor: pointer;
    }
    .wire-name {
      font-size: 12px;
      color: var(--vscode-foreground);
    }
    .badge {
      padding: 1px 5px;
      border-radius: 2px;
      font-size: 10px;
      font-family: var(--vscode-editor-font-family, monospace);
      font-weight: 600;
      text-transform: uppercase;
    }
    .badge-gnd {
      background: var(--vscode-badge-background);
      color: var(--vscode-badge-foreground);
    }
    .badge-power {
      background: var(--vscode-inputValidation-warningBackground, rgba(204,102,51,0.2));
      border: 1px solid var(--vscode-inputValidation-warningBorder, #cc6633);
      color: var(--vscode-foreground);
    }
    .badge-signal {
      background: var(--vscode-inputValidation-infoBackground, rgba(55,148,255,0.2));
      border: 1px solid var(--vscode-inputValidation-infoBorder, #3794ff);
      color: var(--vscode-foreground);
    }
    .warning-badge {
      font-size: 10px;
      font-weight: 600;
      color: var(--vscode-errorForeground);
      margin-left: 6px;
      white-space: nowrap;
    }

    /* ── Divider ──────────────────────────────────────────────────────── */
    .divider {
      height: 1px;
      background: var(--vscode-panel-border, var(--vscode-widget-border, rgba(128,128,128,.25)));
      margin: 16px 0;
    }

    /* ── Status bar ───────────────────────────────────────────────────── */
    .status-bar {
      font-size: 12px;
      display: flex;
      align-items: flex-start;
      gap: 6px;
      min-height: 20px;
      color: var(--vscode-descriptionForeground);
    }
    .status-bar.idle {
      color: var(--vscode-descriptionForeground);
    }
    .status-bar.compiling {
      color: var(--vscode-foreground);
    }
    .status-bar.success {
      color: var(--vscode-foreground);
    }
    .status-bar.error {
      color: var(--vscode-errorForeground);
    }

    /* ── Icons (simulated via text/emoji for enterprise look) ─────────── */
    .status-icon {
      font-family: var(--vscode-font-family);
      font-size: 12px;
      line-height: 1.4;
    }
    .status-bar.compiling .status-icon::before { content: "↻"; display: inline-block; animation: spin 2s linear infinite; }
    .status-bar.success .status-icon::before { content: "✓"; }
    .status-bar.error .status-icon::before { content: "⚠"; }
    .status-bar.idle .status-icon::before { content: "•"; }

    @keyframes spin { 100% { transform: rotate(360deg); } }

    /* ── vibeC AI Agent Terminal ───────────────────────────────────────── */
    .agent-box {
      background: var(--vscode-welcomePage-tile-background, rgba(128,128,128,0.08));
      border: 1px solid var(--vscode-widget-border, rgba(128,128,128,.25));
      border-radius: 6px;
      padding: 10px;
      margin-bottom: 12px;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .agent-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .agent-status-container {
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .status-badge {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      display: inline-block;
      transition: background-color 0.3s, box-shadow 0.3s;
    }
    .status-badge.idle {
      background-color: var(--vscode-testing-iconPassedColor, #4ec9b0);
      box-shadow: 0 0 4px var(--vscode-testing-iconPassedColor, #4ec9b0);
    }
    .status-badge.pending_sync {
      background-color: var(--vscode-inputValidation-warningBorder, #cca700);
      box-shadow: 0 0 6px var(--vscode-inputValidation-warningBorder, #cca700);
      animation: pulse-amber 1.2s infinite ease-in-out;
    }
    .status-badge.syncing {
      background-color: var(--vscode-progressBar-background, #0e7090);
      box-shadow: 0 0 6px var(--vscode-progressBar-background, #0e7090);
      animation: pulse-syncing 0.8s infinite ease-in-out;
    }
    .status-badge.disabled {
      background-color: var(--vscode-descriptionForeground, #808080);
      box-shadow: none;
    }
    
    @keyframes pulse-amber {
      0% {
        opacity: 0.4;
        box-shadow: 0 0 2px rgba(204, 167, 0, 0.4);
      }
      50% {
        opacity: 1;
        box-shadow: 0 0 8px rgba(204, 167, 0, 0.9);
      }
      100% {
        opacity: 0.4;
        box-shadow: 0 0 2px rgba(204, 167, 0, 0.4);
      }
    }
    @keyframes pulse-syncing {
      0% {
        opacity: 0.5;
        transform: scale(0.9);
      }
      50% {
        opacity: 1;
        transform: scale(1.15);
      }
      100% {
        opacity: 0.5;
        transform: scale(0.9);
      }
    }

    .agent-status-text {
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--vscode-descriptionForeground);
    }

    .agent-log {
      background: var(--vscode-textCodeBlock-background, #1e1e1e);
      border: 1px solid var(--vscode-widget-border, rgba(128,128,128,.15));
      border-radius: 4px;
      height: 100px;
      overflow-y: auto;
      font-family: var(--vscode-editor-font-family, 'Courier New', Courier, monospace);
      font-size: 10.5px;
      color: #b5cea8;
      padding: 6px;
      white-space: pre-wrap;
      word-break: break-all;
    }

    .agent-log .log-entry {
      margin-bottom: 4px;
      line-height: 1.3;
      border-left: 2px solid rgba(181, 206, 168, 0.3);
      padding-left: 4px;
    }
    .agent-log .log-entry.info {
      color: #9cdcfe;
      border-left-color: rgba(156, 220, 254, 0.3);
    }
    .agent-log .log-entry.warn {
      color: #ce9178;
      border-left-color: rgba(206, 145, 120, 0.3);
    }
    .agent-log .log-entry.error {
      color: #f48771;
      border-left-color: rgba(244, 135, 113, 0.5);
    }
    
    .agent-sync-btn {
      width: 100%;
      padding: 5px 10px;
      font-family: var(--vscode-font-family, system-ui);
      font-size: var(--vscode-font-size, 13px);
      font-weight: 600;
      color: var(--vscode-button-foreground);
      background: var(--vscode-button-background);
      border: 1px solid transparent;
      border-radius: 3px;
      cursor: pointer;
      display: block;
      text-align: center;
      transition: background-color .15s, opacity 0.15s, transform 0.1s;
    }
    .agent-sync-btn:hover:not(:disabled) {
      background: var(--vscode-button-hoverBackground);
      transform: translateY(-1px);
    }
    .agent-sync-btn:active:not(:disabled) {
      transform: translateY(0);
    }
    .agent-sync-btn:disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }
    .agent-sync-btn.pending {
      background: linear-gradient(135deg, #cca700, #b58b00);
      color: #ffffff;
      animation: pulse-button 1.5s infinite;
    }
    @keyframes pulse-button {
      0% { box-shadow: 0 0 0 0 rgba(204, 167, 0, 0.7); }
      70% { box-shadow: 0 0 0 6px rgba(204, 167, 0, 0); }
      100% { box-shadow: 0 0 0 0 rgba(204, 167, 0, 0); }
    }
  </style>
</head>
<body>
  <!-- Header -->
  <div class="header">
    <div class="header-title">EMBEDDED TARGET CONFIGURATION</div>
  </div>

  <!-- Target platform -->
  <div class="section">
    <label class="section-label" for="platformSelect">Target Platform</label>
    <select id="platformSelect" class="platform-select">
      <option value="ESP32 (Arduino Framework)">ESP32 (Arduino Framework)</option>
      <option value="Arduino Uno/Nano (AVR)">Arduino Uno/Nano (AVR)</option>
      <option value="Standard C (Generic)">Standard C (Generic)</option>
    </select>
    <div id="platformInfo" class="platform-info"></div>
  </div>

  <!-- Architecture Settings -->
  <div class="section">
    <label class="section-label" for="codeStructureSelect">ARCHITECTURE SETTINGS</label>
    <select id="codeStructureSelect" class="platform-select">
      <option value="single">Single File (.ino / .c)</option>
      <option value="modular">Modular C++ (Production Split)</option>
      <option value="pio_native">PlatformIO Native (Professional OOP)</option>
    </select>
  </div>

  <!-- Compile -->
  <div class="section">
    <button id="compileBtn" class="compile-btn">Compile System Architecture</button>
    <button id="copyBtn" class="secondary-btn">Copy Generated Code</button>
    <button id="generateDocsBtn" class="secondary-btn" style="margin-top: 8px;">📄 Generate Tech Spec</button>
  </div>

  <div class="divider"></div>

  <!-- Hardware Map -->
  <div class="section">
    <div class="section-label">HARDWARE CONFIGURATION MAP</div>
    <div id="hardwareMapContainer" class="hw-container">
      <div class="hw-placeholder">No active hardware map. Compile a .vibe file to map peripherals.</div>
    </div>
  </div>

  <div class="divider"></div>

  <!-- vibeC AI Agent Terminal -->
  <div class="section">
    <div class="section-label">vibeC AI Agent Terminal</div>
    <div class="agent-box">
      <div class="agent-header">
        <div class="agent-status-container">
          <span class="status-badge disabled" id="agentStatusBadge"></span>
          <span id="agentStatus" class="agent-status-text">Disabled</span>
        </div>
      </div>
      <div id="agentLog" class="agent-log"></div>
      <button id="agentSyncBtn" class="agent-sync-btn" disabled>Sync Project</button>
    </div>
  </div>

  <div class="divider"></div>

  <!-- Status -->
  <div class="section">
    <label class="section-label">Status</label>
    <div id="statusBar" class="status-bar idle">
      <span class="status-icon"></span>
      <span id="statusText">Ready</span>
    </div>
  </div>

  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();

    const platformSelect = document.getElementById('platformSelect');
    const platformInfo   = document.getElementById('platformInfo');
    const compileBtn     = document.getElementById('compileBtn');
    const copyBtn        = document.getElementById('copyBtn');
    const statusBar      = document.getElementById('statusBar');
    const statusText     = document.getElementById('statusText');
    const hwContainer    = document.getElementById('hardwareMapContainer');
    const codeStructureSelect = document.getElementById('codeStructureSelect');
    const generateDocsBtn = document.getElementById('generateDocsBtn');

    const agentSyncBtn   = document.getElementById('agentSyncBtn');
    const agentStatusBadge = document.getElementById('agentStatusBadge');
    const agentStatus      = document.getElementById('agentStatus');
    const agentLog         = document.getElementById('agentLog');

    const INFO = {
      'ESP32 (Arduino Framework)':
        'ESP32 · Wi-Fi / BLE · Arduino C++ · Output: .ino',
      'Arduino Uno/Nano (AVR)':
        'ATmega328P · 2 KB SRAM · Low-memory optimized · Output: .ino',
      'Standard C (Generic)':
        'Generic C · Cross-platform · Standard libraries · Output: .c',
    };

    function updateInfo() {
      platformInfo.textContent = INFO[platformSelect.value] || '';
    }
    updateInfo();

    function getBadgeClass(pin) {
      const p = pin.toUpperCase();
      if (p === 'GND' || p === 'GROUND') return 'badge-gnd';
      if (p.includes('3V3') || p.includes('5V') || p.includes('VCC') || p.includes('VIN')) return 'badge-power';
      return 'badge-signal';
    }

    function toggleCheck(cb) {
      const row = cb.parentElement.parentElement;
      if (cb.checked) {
        row.classList.add('checked');
      } else {
        row.classList.remove('checked');
      }

      const card = row.parentElement;
      const allCbs = card.querySelectorAll('input[type="checkbox"]');
      let allChecked = true;
      for (let i = 0; i < allCbs.length; i++) {
        if (!allCbs[i].checked) {
          allChecked = false;
          break;
        }
      }
      if (allChecked) {
        card.classList.add('completed');
      } else {
        card.classList.remove('completed');
      }
    }

    function renderHardwareMap(data, platform) {
      if (!data || !data.components || data.components.length === 0) {
        hwContainer.innerHTML = '<div class="hw-placeholder">No active hardware map. Compile a .vibe file to map peripherals.</div>';
        return;
      }

      // Group components by name
      const devices = {};
      const pinUsageCount = {};

      data.components.forEach(comp => {
        const devName = comp.name || 'General';
        if (!devices[devName]) devices[devName] = [];
        devices[devName].push(comp);

        // Count pin usage for conflict detection (ignoring power/gnd)
        const p = (comp.target || '').toUpperCase();
        if (p && p !== 'GND' && p !== 'GROUND' && !p.includes('3V3') && !p.includes('5V') && !p.includes('VCC') && !p.includes('VIN')) {
          pinUsageCount[p] = (pinUsageCount[p] || 0) + 1;
        }
      });

      const isEsp32 = platform && platform.includes('ESP32');
      const strappingRegex = /^(GPIO\\s*(0|1|3|5|12|15)|TX0?|RX0?)$/i;

      let html = '';
      for (const [dev, wires] of Object.entries(devices)) {
        html += '<div class="hardware-card">';
        html += '<div class="hardware-card-header">' + escapeHtml(dev) + '</div>';
        for (const wire of wires) {
          const pinRaw = wire.target || '';
          const pinUpper = pinRaw.toUpperCase();
          const badgeCls = getBadgeClass(pinRaw);
          
          let warning = '';
          if (pinUsageCount[pinUpper] > 1) {
            warning = '<span class="warning-badge">⚠️ CONFLICT!</span>';
          } else if (isEsp32 && strappingRegex.test(pinUpper)) {
            warning = '<span class="warning-badge">⚠️ STRAPPING PIN!</span>';
          }

          html += '<div class="hw-row">';
          html += '<label><input type="checkbox" onchange="toggleCheck(this)">';
          html += '<span class="wire-name">' + escapeHtml(wire.pin_name || 'Pin') + '</span></label>';
          html += '<div class="connector-line"></div>';
          if (warning) html += warning + ' ';
          html += '<span class="badge ' + badgeCls + '">' + escapeHtml(pinRaw) + '</span>';
          html += '</div>';
        }
        html += '</div>';
      }

      hwContainer.innerHTML = html;
    }

    function escapeHtml(text) {
      const el = document.createElement('span');
      el.textContent = text;
      return el.innerHTML;
    }

    platformSelect.addEventListener('change', function () {
      updateInfo();
      vscode.postMessage({ type: 'platformChanged', platform: platformSelect.value });
    });

    compileBtn.addEventListener('click', function () {
      vscode.postMessage({ type: 'compile', platform: platformSelect.value });
    });

    copyBtn.addEventListener('click', function () {
      vscode.postMessage({ type: 'copyCode' });
    });

    codeStructureSelect.addEventListener('change', function () {
      vscode.postMessage({ type: 'codeStructureChanged', codeStructure: codeStructureSelect.value });
    });

    generateDocsBtn.addEventListener('click', function () {
      vscode.postMessage({ type: 'generateDocs' });
    });

    agentSyncBtn.addEventListener('click', function () {
      vscode.postMessage({ type: 'triggerAgentSync' });
    });

    window.addEventListener('message', function (event) {
      var data = event.data;

      if (data.type === 'updateHardwareMap') {
        renderHardwareMap(data.data, data.platform);
        return;
      }

      if (data.type === 'agentStateChanged') {
        agentStatusBadge.className = 'status-badge ' + data.state;
        
        if (data.state === 'idle') {
          agentStatus.textContent = 'Idle';
          agentSyncBtn.disabled = false;
          agentSyncBtn.textContent = 'Sync Project';
          agentSyncBtn.classList.remove('pending');
        } else if (data.state === 'pending_sync') {
          agentStatus.textContent = 'Pending Sync (' + (data.details || 'modified') + ')';
          agentSyncBtn.disabled = false;
          agentSyncBtn.textContent = 'Run Sync';
          agentSyncBtn.classList.add('pending');
        } else if (data.state === 'syncing') {
          agentStatus.textContent = 'Syncing...';
          agentSyncBtn.disabled = true;
          agentSyncBtn.textContent = 'Syncing...';
          agentSyncBtn.classList.remove('pending');
          agentLog.innerHTML = '<div class="log-entry info">=== Starting Project Sync ===</div>';
        } else if (data.state === 'disabled') {
          agentStatus.textContent = 'Disabled';
          agentSyncBtn.disabled = true;
          agentSyncBtn.textContent = 'Sync Project';
          agentSyncBtn.classList.remove('pending');
        }
        return;
      }

      if (data.type === 'agentLogAppend') {
        var entry = document.createElement('div');
        entry.className = 'log-entry';
        
        var lowerMsg = data.message.toLowerCase();
        if (lowerMsg.includes('error') || lowerMsg.includes('fail')) {
          entry.classList.add('error');
        } else if (lowerMsg.includes('warning') || lowerMsg.includes('warn')) {
          entry.classList.add('warn');
        } else if (lowerMsg.includes('start') || lowerMsg.includes('complete') || lowerMsg.includes('success')) {
          entry.classList.add('info');
        }
        
        entry.textContent = data.message;
        agentLog.appendChild(entry);
        agentLog.scrollTop = agentLog.scrollHeight;
        return;
      }

      if (data.type !== 'status') { return; }

      statusBar.className = 'status-bar ' + data.state;

      if (data.state === 'compiling') {
        statusText.textContent = data.message;
        compileBtn.disabled = true;
        compileBtn.textContent = 'Compiling...';
      } else {
        statusText.textContent = data.message;
        compileBtn.disabled = false;
        compileBtn.textContent = 'Compile System Architecture';
      }
    });
  </script>
</body>
</html>`;
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getNonce(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let nonce = '';
  for (let i = 0; i < 32; i++) {
    nonce += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return nonce;
}
