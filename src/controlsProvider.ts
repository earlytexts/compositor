import * as vscode from "vscode";

export class ControlsProvider implements vscode.WebviewViewProvider {
  public static readonly viewId = "compositor.controls";

  private view?: vscode.WebviewView;

  private _onDidSearch = new vscode.EventEmitter<string>();
  readonly onDidSearch = this._onDidSearch.event;

  resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ) {
    this.view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
    };

    webviewView.webview.onDidReceiveMessage((message) => {
      if (message.command === "showPreview") {
        vscode.commands.executeCommand("markit.showPreview");
      } else if (message.command === "search") {
        this._onDidSearch.fire(message.query);
      }
    });

    this.update();
  }

  update() {
    if (!this.view) {
      return;
    }

    const editor = vscode.window.activeTextEditor;
    const isMit =
      editor !== undefined && editor.document.fileName.endsWith(".mit");

    this.view.webview.html = this.getHtml(isMit);
  }

  private getHtml(isMit: boolean): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy"
    content="default-src 'none'; script-src 'unsafe-inline';">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body {
      padding: 10px;
      font-family: var(--vscode-font-family);
      font-size: var(--vscode-font-size);
      color: var(--vscode-foreground);
    }
    input {
      display: block;
      width: 100%;
      box-sizing: border-box;
      padding: 4px 8px;
      margin: 4px 0 8px;
      border: 1px solid var(--vscode-input-border);
      border-radius: 2px;
      background: var(--vscode-input-background);
      color: var(--vscode-input-foreground);
      font-size: var(--vscode-font-size);
      outline: none;
    }
    input:focus {
      border-color: var(--vscode-focusBorder);
    }
    input::placeholder {
      color: var(--vscode-input-placeholderForeground);
    }
    button {
      display: block;
      width: 100%;
      padding: 6px 14px;
      margin: 4px 0;
      border: none;
      border-radius: 2px;
      color: var(--vscode-button-foreground);
      background: var(--vscode-button-background);
      cursor: pointer;
      font-size: var(--vscode-font-size);
    }
    button:hover:not(:disabled) {
      background: var(--vscode-button-hoverBackground);
    }
    button:disabled {
      opacity: 0.5;
      cursor: default;
    }
  </style>
</head>
<body>
  <input id="searchInput" type="text" placeholder="Filter authors and texts…" />
  <button id="previewBtn" ${isMit ? "" : "disabled"}>Open Preview to the Side</button>
  <script>
    const vscode = acquireVsCodeApi();
    let debounceTimer;
    document.getElementById("searchInput").addEventListener("input", (e) => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        vscode.postMessage({ command: "search", query: e.target.value });
      }, 200);
    });
    document.getElementById("previewBtn").addEventListener("click", () => {
      vscode.postMessage({ command: "showPreview" });
    });
  </script>
</body>
</html>`;
  }
}
