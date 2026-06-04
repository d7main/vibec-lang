import * as vscode from 'vscode';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type StatusState = 'idle' | 'compiling' | 'success' | 'error';

/** Messages sent FROM the webview TO the extension. */
export interface SidebarMessage {
  type: 'compile' | 'platformChanged';
  platform?: string;
}

// ---------------------------------------------------------------------------
// VibeCSidebarProvider
// ---------------------------------------------------------------------------

export class VibeCSidebarProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'vibeC.sidebarView';

  private _view?: vscode.WebviewView;
  private _selectedPlatform = 'ESP32 (Arduino Framework)';

  constructor(private readonly _extensionUri: vscode.Uri) {}

  /** Returns the platform currently selected in the sidebar dropdown. */
  public getSelectedPlatform(): string {
    return this._selectedPlatform;
  }

  /** Push a status update into the sidebar UI. */
  public sendStatus(state: StatusState, message: string): void {
    this._view?.webview.postMessage({ type: 'status', state, message });
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
      }
    });
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
    }
    .compile-btn:hover:not(:disabled) {
      background: var(--vscode-button-hoverBackground);
    }
    .compile-btn:disabled {
      opacity: 0.6;
      cursor: not-allowed;
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

  <!-- Compile -->
  <div class="section">
    <button id="compileBtn" class="compile-btn">Compile System Architecture</button>
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
    const statusBar      = document.getElementById('statusBar');
    const statusText     = document.getElementById('statusText');

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

    platformSelect.addEventListener('change', function () {
      updateInfo();
      vscode.postMessage({ type: 'platformChanged', platform: platformSelect.value });
    });

    compileBtn.addEventListener('click', function () {
      vscode.postMessage({ type: 'compile', platform: platformSelect.value });
    });

    window.addEventListener('message', function (event) {
      var data = event.data;
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
