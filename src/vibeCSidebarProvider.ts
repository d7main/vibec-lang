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
      background: transparent;
      line-height: 1.45;
    }

    /* ── Layout ───────────────────────────────────────────────────────── */
    .container { padding: 14px 16px 20px; }

    .header {
      display: flex;
      align-items: center;
      gap: 8px;
      padding-bottom: 14px;
      margin-bottom: 18px;
      border-bottom: 1px solid var(--vscode-panel-border,
                                    var(--vscode-widget-border, rgba(128,128,128,.25)));
    }
    .header-icon { font-size: 18px; line-height: 1; }
    .header-title {
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: .8px;
      color: var(--vscode-foreground);
    }

    /* ── Sections ─────────────────────────────────────────────────────── */
    .section { margin-bottom: 20px; }
    .section-label {
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: .8px;
      color: var(--vscode-descriptionForeground);
      margin-bottom: 8px;
    }

    /* ── Platform select ──────────────────────────────────────────────── */
    .platform-select {
      width: 100%;
      padding: 6px 8px;
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

    /* ── Platform info chip ───────────────────────────────────────────── */
    .platform-info {
      margin-top: 8px;
      padding: 8px 10px;
      font-size: 11px;
      line-height: 1.55;
      color: var(--vscode-descriptionForeground);
      background: var(--vscode-textBlockQuote-background, rgba(128,128,128,.08));
      border-left: 3px solid var(--vscode-textBlockQuote-border,
                                  var(--vscode-focusBorder));
      border-radius: 0 3px 3px 0;
    }
    .output-badge {
      display: inline-block;
      padding: 1px 5px;
      font-size: 10px;
      font-weight: 700;
      font-family: var(--vscode-editor-font-family, monospace);
      color: var(--vscode-badge-foreground);
      background: var(--vscode-badge-background);
      border-radius: 3px;
      vertical-align: middle;
    }

    /* ── Compile button ───────────────────────────────────────────────── */
    .compile-btn {
      width: 100%;
      padding: 8px 14px;
      font-family: var(--vscode-font-family, system-ui);
      font-size: 13px;
      font-weight: 600;
      color: var(--vscode-button-foreground);
      background: var(--vscode-button-background);
      border: none;
      border-radius: 2px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      transition: background-color .15s ease, transform .08s ease;
      user-select: none;
    }
    .compile-btn:hover:not(:disabled) {
      background: var(--vscode-button-hoverBackground);
    }
    .compile-btn:active:not(:disabled) {
      transform: scale(.98);
    }
    .compile-btn:disabled {
      opacity: .55;
      cursor: not-allowed;
    }

    /* ── Divider ──────────────────────────────────────────────────────── */
    .divider {
      height: 1px;
      background: var(--vscode-panel-border,
                      var(--vscode-widget-border, rgba(128,128,128,.25)));
      margin: 18px 0;
    }

    /* ── Status bar ───────────────────────────────────────────────────── */
    .status-bar {
      padding: 8px 10px;
      font-size: 12px;
      border-radius: 3px;
      display: flex;
      align-items: center;
      gap: 8px;
      min-height: 32px;
      transition: background-color .2s ease, color .2s ease;
    }
    .status-bar.idle {
      color: var(--vscode-descriptionForeground);
    }
    .status-bar.compiling {
      color: var(--vscode-charts-blue, #3794ff);
      background: var(--vscode-textBlockQuote-background, rgba(55,148,255,.08));
    }
    .status-bar.success {
      color: var(--vscode-charts-green, #89d185);
      background: var(--vscode-textBlockQuote-background, rgba(137,209,133,.08));
    }
    .status-bar.error {
      color: var(--vscode-errorForeground, #f48771);
      background: var(--vscode-inputValidation-errorBackground, rgba(244,135,113,.08));
    }

    /* ── Spinner ──────────────────────────────────────────────────────── */
    .spinner {
      display: inline-block;
      width: 14px; height: 14px;
      border: 2px solid transparent;
      border-top-color: currentColor;
      border-radius: 50%;
      animation: spin .75s linear infinite;
      flex-shrink: 0;
    }
    @keyframes spin { to { transform: rotate(360deg); } }

    .status-dot {
      display: inline-block;
      width: 8px; height: 8px;
      border-radius: 50%;
      background: currentColor;
      flex-shrink: 0;
    }
  </style>
</head>
<body>
  <div class="container">

    <!-- Header -->
    <div class="header">
      <span class="header-icon">⚡</span>
      <span class="header-title">vibeC Compiler</span>
    </div>

    <!-- Target platform -->
    <div class="section">
      <div class="section-label">Target Platform</div>
      <select id="platformSelect" class="platform-select">
        <option value="ESP32 (Arduino Framework)">ESP32 (Arduino Framework)</option>
        <option value="Arduino Uno/Nano (AVR)">Arduino Uno/Nano (AVR)</option>
        <option value="Standard C (Generic)">Standard C (Generic)</option>
      </select>
      <div id="platformInfo" class="platform-info"></div>
    </div>

    <!-- Compile -->
    <div class="section">
      <button id="compileBtn" class="compile-btn">⚡ Compile Active File</button>
    </div>

    <div class="divider"></div>

    <!-- Status -->
    <div class="section">
      <div class="section-label">Status</div>
      <div id="statusBar" class="status-bar idle">
        <span class="status-dot"></span>
        <span id="statusText">Ready</span>
      </div>
    </div>

  </div>

  <script nonce="${nonce}">
    // Acquire the VS Code API handle (one-time call)
    const vscode = acquireVsCodeApi();

    const platformSelect = document.getElementById('platformSelect');
    const platformInfo   = document.getElementById('platformInfo');
    const compileBtn     = document.getElementById('compileBtn');
    const statusBar      = document.getElementById('statusBar');

    // ── Platform descriptions ─────────────────────────────────────────
    const INFO = {
      'ESP32 (Arduino Framework)':
        'ESP32 · Wi-Fi / BLE · Arduino C++ · Output: <span class="output-badge">.ino</span>',
      'Arduino Uno/Nano (AVR)':
        'ATmega328P · 2 KB SRAM · Low-memory optimized · Output: <span class="output-badge">.ino</span>',
      'Standard C (Generic)':
        'Generic C · Cross-platform · Standard libraries · Output: <span class="output-badge">.c</span>',
    };

    function updateInfo() {
      platformInfo.innerHTML = INFO[platformSelect.value] || '';
    }
    updateInfo();

    // ── Events → extension ────────────────────────────────────────────
    platformSelect.addEventListener('change', function () {
      updateInfo();
      vscode.postMessage({ type: 'platformChanged', platform: platformSelect.value });
    });

    compileBtn.addEventListener('click', function () {
      vscode.postMessage({ type: 'compile', platform: platformSelect.value });
    });

    // ── Events ← extension ────────────────────────────────────────────
    function escapeHtml(text) {
      var el = document.createElement('span');
      el.textContent = text;
      return el.innerHTML;
    }

    window.addEventListener('message', function (event) {
      var data = event.data;
      if (data.type !== 'status') { return; }

      statusBar.className = 'status-bar ' + data.state;

      if (data.state === 'compiling') {
        statusBar.innerHTML =
          '<span class="spinner"></span>' +
          '<span>' + escapeHtml(data.message) + '</span>';
        compileBtn.disabled = true;
        compileBtn.textContent = '⏳ Compiling…';
      } else {
        statusBar.innerHTML =
          '<span class="status-dot"></span>' +
          '<span>' + escapeHtml(data.message) + '</span>';
        compileBtn.disabled = false;
        compileBtn.textContent = '⚡ Compile Active File';
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
