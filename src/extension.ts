import * as vscode from "vscode";
import { CorpusTreeProvider } from "./corpusTreeProvider.js";
import { ControlsProvider } from "./controlsProvider.js";

export function activate(context: vscode.ExtensionContext) {
  const config = vscode.workspace.getConfiguration("compositor");
  const corpusPath = config.get<string>("corpusPath", "");

  const treeProvider = new CorpusTreeProvider(corpusPath);

  const treeView = vscode.window.createTreeView("compositor.corpusBrowser", {
    treeDataProvider: treeProvider,
    showCollapseAll: true,
  });
  context.subscriptions.push(treeView);

  const controlsProvider = new ControlsProvider();
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      ControlsProvider.viewId,
      controlsProvider
    )
  );

  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor(() => {
      controlsProvider.update();
    })
  );

  context.subscriptions.push(
    controlsProvider.onDidSearch((query) => {
      treeProvider.setFilter(query);
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("compositor.refreshCorpus", () => {
      treeProvider.refresh();
    })
  );

  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration("compositor.corpusPath")) {
        const newPath = vscode.workspace
          .getConfiguration("compositor")
          .get<string>("corpusPath", "");
        treeProvider.setCorpusPath(newPath);
      }
    })
  );
}

export function deactivate() {}
