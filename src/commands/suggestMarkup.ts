/**
 * Markup suggestions: a toggleable overlay that flags likely people,
 * citations, and foreign text in the open edition, so a contributor can cycle
 * through them (F8, like any diagnostic) and mark each up with a quick fix —
 * or leave it. The finding is the corpus's (`scanSource` over the whole-corpus
 * lexicons `buildHints` mines); this module is the editor surface for it.
 *
 * How it hangs together:
 *  - Hints (the lexicons) are built once from the loaded catalogue and cached,
 *    rebuilt only when the corpus model reloads (a save) — so a newly marked-up
 *    name improves every later suggestion. Building is ~1–2s, so the first
 *    build shows progress.
 *  - Scanning is per-file and cheap (~tens of ms): the active editor's current
 *    text is compiled and scanned on demand — when categories are toggled, when
 *    the active editor changes, on edits (debounced), and after a rebuild.
 *  - Suggestions surface as Information diagnostics in their own collection
 *    (kept apart from validation, so toggling them never disturbs the Problems
 *    the corpus rules report), each offering a "mark up as …" quick fix plus a
 *    "mark up all N identical" fix for repeated names and citations.
 *
 * Off until asked for: the command opens a category picker; clearing all
 * categories (or "Clear Suggestions") takes the overlay back down.
 */

import * as vscode from "vscode";
import { compile } from "@jsr/earlytexts__markit";
import {
  buildHints,
  type Catalogue,
  type Hints,
  type MarkupSuggestion,
  scanSource,
} from "@jsr/earlytexts__corpus";
import type { CorpusModel } from "../corpusModel.ts";
import { hintOverrides } from "../hintOverrides.ts";
import {
  categoriesFor,
  type Category,
  categoryKey,
  categoryLabel,
  fixTitle,
  suggestionKey,
  suggestionMessage,
  wrapText,
} from "../suggestions.ts";

const SOURCE = "compositor-suggestions";
const RESCAN_DEBOUNCE_MS = 300;

const isMit = (document: vscode.TextDocument): boolean =>
  document.uri.scheme === "file" && document.uri.fsPath.endsWith(".mit");

const suggestionRange = (suggestion: MarkupSuggestion): vscode.Range =>
  new vscode.Range(
    suggestion.startLine,
    suggestion.startColumn,
    suggestion.endLine,
    suggestion.endColumn,
  );

export type SuggestionController = {
  /** Open the category picker and (re)scan, or take the overlay down. */
  configure: () => Promise<void>;
  /** Clear every suggestion and disable the overlay. */
  clear: () => void;
  /** The corpus reloaded: drop the cached hints and refresh what's shown. */
  onCorpusChanged: () => void;
  dispose: () => void;
};

export const createSuggestionController = (
  getModel: () => CorpusModel | undefined,
  context: vscode.ExtensionContext,
): SuggestionController => {
  const collection = vscode.languages.createDiagnosticCollection(SOURCE);
  /** Category keys currently shown; empty means the overlay is off. */
  const enabled = new Set<string>();
  /** The last scan of each open document, for the code-action provider. */
  const scanned = new Map<string, MarkupSuggestion[]>();
  /** Cached lexicons, and the catalogue identity they were built from. */
  let hints: Hints | undefined;
  let hintsFrom: Catalogue | undefined;

  /** Build (or reuse) the hints for the loaded corpus, showing progress on the
   * first, slow build. Undefined until a corpus has loaded. */
  const ensureHints = async (): Promise<Hints | undefined> => {
    const catalogue = getModel()?.state?.catalogue;
    if (catalogue === undefined) return undefined;
    if (hints !== undefined && hintsFrom === catalogue) return hints;
    hints = await vscode.window.withProgress(
      { location: vscode.ProgressLocation.Window, title: "Indexing corpus markup…" },
      () => Promise.resolve(buildHints(catalogue, hintOverrides)),
    );
    hintsFrom = catalogue;
    return hints;
  };

  /** Scan one document with the current hints and publish its diagnostics. */
  const scan = (document: vscode.TextDocument, active: Hints): void => {
    const [doc] = compile(document.getText());
    const suggestions = scanSource(document.getText(), doc, active)
      .filter((s) => enabled.has(suggestionKey(s)));
    scanned.set(document.uri.fsPath, suggestions);
    collection.set(
      document.uri,
      suggestions.map((s) => {
        const diagnostic = new vscode.Diagnostic(
          suggestionRange(s),
          suggestionMessage(s),
          vscode.DiagnosticSeverity.Information,
        );
        // A source distinct from the validation diagnostics (also "compositor")
        // so the code-action provider never mistakes one for the other.
        diagnostic.source = SOURCE;
        diagnostic.code = suggestionKey(s);
        return diagnostic;
      }),
    );
  };

  /** Re-scan the active editor if the overlay is on and it's an edition. */
  const rescanActive = async (): Promise<void> => {
    if (enabled.size === 0) return;
    const editor = vscode.window.activeTextEditor;
    if (editor === undefined || !isMit(editor.document)) return;
    const active = await ensureHints();
    if (active !== undefined) scan(editor.document, active);
  };

  /** Forget a document's suggestions and clear its squiggles. */
  const drop = (document: vscode.TextDocument): void => {
    if (!scanned.has(document.uri.fsPath)) return;
    scanned.delete(document.uri.fsPath);
    collection.delete(document.uri);
  };

  const clear = (): void => {
    enabled.clear();
    scanned.clear();
    collection.clear();
  };

  const configure = async (): Promise<void> => {
    const active = await ensureHints();
    if (active === undefined) {
      void vscode.window.showWarningMessage(
        "Compositor: the corpus is still loading — try again in a moment.",
      );
      return;
    }
    const categories = categoriesFor(active.languages.keys());
    const items: (vscode.QuickPickItem & { category: Category })[] = categories
      .map((category) => ({
        label: categoryLabel(category),
        picked: enabled.has(categoryKey(category)),
        category,
      }));
    const picked = await vscode.window.showQuickPick(items, {
      title: "Suggest markup in this edition",
      placeHolder: "Choose what to flag (Esc to keep the current selection)",
      canPickMany: true,
    });
    if (picked === undefined) return; // cancelled: leave the overlay as it was

    enabled.clear();
    for (const item of picked) enabled.add(categoryKey(item.category));
    if (enabled.size === 0) {
      clear();
      return;
    }
    // Categories changed: re-scan everything already on screen, plus the
    // active editor, against the new selection.
    for (const document of vscode.workspace.textDocuments) {
      if (scanned.has(document.uri.fsPath)) scan(document, active);
    }
    await rescanActive();
  };

  // Re-scan on edits to a shown (or active) edition, debounced per document.
  const timers = new Map<string, ReturnType<typeof setTimeout>>();
  const onEdit = (document: vscode.TextDocument): void => {
    if (enabled.size === 0 || !isMit(document)) return;
    const isActive = vscode.window.activeTextEditor?.document === document;
    if (!isActive && !scanned.has(document.uri.fsPath)) return;
    const key = document.uri.fsPath;
    clearTimeout(timers.get(key));
    timers.set(
      key,
      setTimeout(() => {
        timers.delete(key);
        void ensureHints().then((active) => {
          if (active !== undefined) scan(document, active);
        });
      }, RESCAN_DEBOUNCE_MS),
    );
  };

  const provider = vscode.languages.registerCodeActionsProvider(
    { scheme: "file", pattern: "**/*.mit" },
    {
      provideCodeActions: (document, _range, ctx) => {
        const suggestions = scanned.get(document.uri.fsPath) ?? [];
        const actions: vscode.CodeAction[] = [];
        for (const diagnostic of ctx.diagnostics) {
          if (diagnostic.source !== SOURCE) continue;
          const suggestion = suggestions.find((s) =>
            suggestionRange(s).isEqual(diagnostic.range)
          );
          if (suggestion === undefined) continue;

          const one = new vscode.CodeAction(
            fixTitle(suggestion),
            vscode.CodeActionKind.QuickFix,
          );
          one.diagnostics = [diagnostic];
          one.edit = new vscode.WorkspaceEdit();
          one.edit.replace(document.uri, diagnostic.range, wrapText(suggestion));
          actions.push(one);

          // Repeated names/citations: offer to mark every identical match at
          // once (same kind and same text — languages vary too much to batch).
          if (suggestion.type !== "language") {
            const twins = suggestions.filter((s) =>
              suggestionKey(s) === suggestionKey(suggestion) &&
              s.text === suggestion.text
            );
            if (twins.length > 1) {
              const all = new vscode.CodeAction(
                `Mark up all ${twins.length} “${suggestion.text}” in this file`,
                vscode.CodeActionKind.QuickFix,
              );
              all.diagnostics = [diagnostic];
              all.edit = new vscode.WorkspaceEdit();
              for (const twin of twins) {
                all.edit.replace(document.uri, suggestionRange(twin), wrapText(twin));
              }
              actions.push(all);
            }
          }
        }
        return actions;
      },
    },
    { providedCodeActionKinds: [vscode.CodeActionKind.QuickFix] },
  );

  context.subscriptions.push(
    collection,
    provider,
    vscode.window.onDidChangeActiveTextEditor(() => void rescanActive()),
    vscode.workspace.onDidChangeTextDocument((e) => onEdit(e.document)),
    vscode.workspace.onDidCloseTextDocument(drop),
    { dispose: () => timers.forEach(clearTimeout) },
  );

  return {
    configure,
    clear,
    onCorpusChanged: () => {
      hints = undefined;
      hintsFrom = undefined;
      void rescanActive();
    },
    dispose: () => collection.dispose(),
  };
};
