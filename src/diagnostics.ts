/**
 * Publishes the corpus validation rules to the Problems panel and summarises
 * them in the status bar. Compile errors in open documents are left to the
 * Markit language server (which reports them live as you type); the compositor
 * adds what the LSP cannot see — corpus-wide rules, and compile errors in
 * files that aren't open.
 */

import * as vscode from "vscode";
import type { Violation } from "@jsr/earlytexts__corpus";
import type { CorpusModel } from "./corpusModel.ts";

const COMPILE_RULE = "every file compiles without errors";

const toDiagnostic = (v: Violation): vscode.Diagnostic => {
  const line = (v.line ?? 1) - 1;
  const range = v.column !== undefined
    ? new vscode.Range(
      line,
      v.column - 1,
      (v.endLine ?? v.line ?? 1) - 1,
      (v.endColumn ?? v.column + 1) - 1,
    )
    : new vscode.Range(line, 0, line, 1000);
  const message = v.locus === undefined ? v.message : `${v.locus} ${v.message}`;
  const diagnostic = new vscode.Diagnostic(
    range,
    message,
    v.severity === "warning"
      ? vscode.DiagnosticSeverity.Warning
      : vscode.DiagnosticSeverity.Error,
  );
  diagnostic.source = "compositor";
  diagnostic.code = v.rule;
  return diagnostic;
};

export const registerDiagnostics = (
  model: CorpusModel,
  context: vscode.ExtensionContext,
): void => {
  const collection = vscode.languages.createDiagnosticCollection("compositor");
  const status = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Left,
    10,
  );
  status.name = "Compositor";
  status.command = "workbench.actions.view.problems";
  status.show();

  const openPaths = (): Set<string> =>
    new Set(
      vscode.workspace.textDocuments
        .filter((doc) => doc.uri.scheme === "file")
        .map((doc) => doc.uri.fsPath),
    );

  const update = (): void => {
    if (model.loading) {
      status.text = "$(sync~spin) Corpus";
      status.tooltip = "Compositor: reloading the corpus";
      return;
    }
    const state = model.state;
    if (state === undefined) {
      collection.clear();
      status.text = "$(circle-slash) Corpus";
      status.tooltip = "Compositor: the corpus failed to load";
      return;
    }
    const open = openPaths();
    const byFile = new Map<string, vscode.Diagnostic[]>();
    let shown = 0;
    for (const violation of state.violations) {
      const path = `${model.root}/data/${violation.path}`;
      // The Markit LSP already reports compile errors in open documents, live;
      // suppress the compositor's copy to avoid doubled squiggles.
      if (violation.rule === COMPILE_RULE && open.has(path)) continue;
      const list = byFile.get(path) ?? [];
      list.push(toDiagnostic(violation));
      byFile.set(path, list);
      shown++;
    }
    collection.clear();
    for (const [path, diagnostics] of byFile) {
      collection.set(vscode.Uri.file(path), diagnostics);
    }
    const total = state.violations.length;
    status.text = total === 0 ? "$(check) Corpus" : `$(error) Corpus: ${total}`;
    status.tooltip = total === 0
      ? "Compositor: the corpus is valid"
      : `Compositor: ${total} corpus violation(s)` +
        (shown < total ? " (some shown by the Markit extension)" : "");
  };

  context.subscriptions.push(
    collection,
    status,
    model.onDidChange(update),
    // Opening/closing a file hands its compile errors back and forth between
    // the LSP and this collection.
    vscode.workspace.onDidOpenTextDocument(update),
    vscode.workspace.onDidCloseTextDocument(update),
  );
  update();
};
