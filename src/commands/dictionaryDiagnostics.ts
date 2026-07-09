/**
 * The "unaccounted word" overlay: while it is on, every surface the dictionary
 * does not yet account for is squiggled in the open editions — a warning for an
 * unknown surface (no entry), a hint for an unconfirmed (`?`) one — so a
 * contributor can walk them (F8) and curate each with a quick fix.
 *
 * The finding is dictionaryScan.ts's (the corpus's `accountTokens` rule located
 * back in the source); this module is its editor surface. It is off by default
 * and gated behind the `compositor.flagUnaccountedWords` setting, because until
 * the register is backfilled almost every word is unaccounted — the overlay is
 * a curation tool, not an everyday distraction. Turning the setting on (or the
 * toggle command) lights it up; turning it off takes it back down.
 *
 * Lifecycle mirrors the markup-suggestion overlay (commands/suggestMarkup.ts):
 * the active edition is compiled and scanned on demand — when the setting
 * flips, the active editor changes, on edits (debounced), and whenever the
 * corpus model reloads (a save may have added a dictionary entry). The
 * dictionary itself comes from the loaded catalogue.
 */

import * as vscode from "vscode";
import { compile } from "@jsr/earlytexts__markit";
import { fold, isWord, shardOf } from "@jsr/earlytexts__corpus";
import { scanUnaccounted, type UnaccountedWord } from "../dictionaryScan.ts";
import {
  actionsFor,
  confirmEntryText,
  type EntryAction,
  upsertEntryText,
} from "../dictionaryEdits.ts";
import type { CorpusModel } from "../corpusModel.ts";

const SOURCE = "compositor-dictionary";
const SETTING = "flagUnaccountedWords";
const ENTRY_COMMAND = "compositor.dictionaryEntry";
const RESCAN_DEBOUNCE_MS = 300;

const isMit = (document: vscode.TextDocument): boolean =>
  document.uri.scheme === "file" && document.uri.fsPath.endsWith(".mit");

const enabled = (): boolean =>
  vscode.workspace.getConfiguration("compositor").get<boolean>(SETTING, false);

const wordRange = (word: UnaccountedWord): vscode.Range =>
  new vscode.Range(word.line, word.startColumn, word.line, word.endColumn);

const message = (word: UnaccountedWord): string =>
  word.status === "unaccounted"
    ? `“${word.display}” is not in the dictionary.`
    : `“${word.display}” has an unconfirmed dictionary entry.`;

const actionTitle = (surface: string, kind: EntryAction["kind"]): string => {
  switch (kind) {
    case "modern":
      return `Add “${surface}” to the dictionary (modern word)`;
    case "respell":
      return `Add “${surface}” as a respelling…`;
    case "lemma":
      return `Add “${surface}” with a lemma…`;
    case "confirm":
      return `Confirm the dictionary entry for “${surface}”`;
  }
};

/** Ask for the modern spelling (respell) or lemma of a surface, folded to the
 * register's key form. One word, or space-separated words for an expansion
 * (`'tis` → "it is"). undefined when cancelled. */
const promptWords = async (
  surface: string,
  kind: "respell" | "lemma",
): Promise<string | undefined> => {
  const input = await vscode.window.showInputBox({
    title:
      kind === "respell"
        ? `Modern spelling of “${surface}”`
        : `Lemma (citation form) of “${surface}”`,
    placeHolder:
      kind === "respell"
        ? "e.g. virtue — or space-separate an expansion (it is)"
        : "e.g. increase",
    validateInput: (value) =>
      wordsOf(value).length > 0
        ? undefined
        : "Enter one or more words (letters and apostrophes only).",
  });
  if (input === undefined) return undefined;
  const words = wordsOf(input);
  return words.length === 0 ? undefined : words.join(" ");
};

/** The folded words of an input string, or [] if any token is not a word. */
const wordsOf = (input: string): string[] => {
  const tokens = input
    .trim()
    .split(/\s+/)
    .filter((t) => t !== "");
  return tokens.every((t) => isWord(fold(t))) && tokens.length > 0
    ? tokens.map(fold)
    : [];
};

export type DictionaryController = {
  /** The scanned words of a document, for the code-action provider. */
  wordsOf: (document: vscode.TextDocument) => UnaccountedWord[];
  /** The corpus reloaded (or a shard was saved): re-scan what's shown. */
  onCorpusChanged: () => void;
  dispose: () => void;
};

export const createDictionaryController = (
  getModel: () => CorpusModel | undefined,
  context: vscode.ExtensionContext,
): DictionaryController => {
  const collection = vscode.languages.createDiagnosticCollection(SOURCE);
  /** The last scan of each open document, keyed by path. */
  const scanned = new Map<string, UnaccountedWord[]>();

  /** Scan one document and publish its diagnostics (or clear them, when the
   * overlay is off or the corpus has no dictionary yet). */
  const scan = (document: vscode.TextDocument): void => {
    const dictionary = getModel()?.state?.catalogue.dictionary;
    if (!enabled() || dictionary === undefined || !isMit(document)) {
      drop(document);
      return;
    }
    const source = document.getText();
    const [doc] = compile(source);
    const words = scanUnaccounted(source, doc, dictionary);
    scanned.set(document.uri.fsPath, words);
    collection.set(
      document.uri,
      words.map((word) => {
        const diagnostic = new vscode.Diagnostic(
          wordRange(word),
          message(word),
          word.status === "unaccounted"
            ? vscode.DiagnosticSeverity.Warning
            : vscode.DiagnosticSeverity.Hint,
        );
        diagnostic.source = SOURCE;
        diagnostic.code = word.surface;
        return diagnostic;
      }),
    );
  };

  /** Forget a document's findings and clear its squiggles. */
  const drop = (document: vscode.TextDocument): void => {
    if (!scanned.has(document.uri.fsPath)) return;
    scanned.delete(document.uri.fsPath);
    collection.delete(document.uri);
  };

  /** Re-scan every open edition (or clear everything when off). */
  const refresh = (): void => {
    if (!enabled()) {
      scanned.clear();
      collection.clear();
      return;
    }
    for (const document of vscode.workspace.textDocuments) {
      if (isMit(document)) scan(document);
    }
  };

  // Re-scan on edits to an open edition, debounced per document.
  const timers = new Map<string, ReturnType<typeof setTimeout>>();
  const onEdit = (document: vscode.TextDocument): void => {
    if (!enabled() || !isMit(document)) return;
    const key = document.uri.fsPath;
    clearTimeout(timers.get(key));
    timers.set(
      key,
      setTimeout(() => {
        timers.delete(key);
        scan(document);
      }, RESCAN_DEBOUNCE_MS),
    );
  };

  /** Write a curation decision to the surface's shard file (creating it if
   * needed); the corpus watcher reloads and the squiggle clears on re-scan. A
   * respelling/lemma prompts for the target; a malformed value is reported and
   * nothing is written. */
  const runEntry = async (
    surface: string,
    kind: EntryAction["kind"],
  ): Promise<void> => {
    const model = getModel();
    if (model === undefined) return;
    const shardUri = vscode.Uri.file(
      `${model.root}/data/dictionary/${shardOf(surface)}`,
    );
    let current = "";
    try {
      current = new TextDecoder().decode(
        await vscode.workspace.fs.readFile(shardUri),
      );
    } catch {
      // no shard yet — a fresh one is written below
    }
    let next: string;
    try {
      if (kind === "confirm") next = confirmEntryText(current, surface);
      else if (kind === "modern")
        next = upsertEntryText(current, surface, null);
      else {
        const target = await promptWords(surface, kind);
        if (target === undefined) return; // cancelled
        next = upsertEntryText(
          current,
          surface,
          kind === "respell" ? target : `=${target}`,
        );
      }
    } catch (error) {
      void vscode.window.showErrorMessage(
        `Compositor: ${error instanceof Error ? error.message : String(error)}`,
      );
      return;
    }
    await vscode.workspace.fs.writeFile(
      shardUri,
      new TextEncoder().encode(next),
    );
  };

  const provider = vscode.languages.registerCodeActionsProvider(
    { scheme: "file", pattern: "**/*.mit" },
    {
      provideCodeActions: (document, _range, ctx) => {
        const words = scanned.get(document.uri.fsPath) ?? [];
        const actions: vscode.CodeAction[] = [];
        for (const diagnostic of ctx.diagnostics) {
          if (diagnostic.source !== SOURCE) continue;
          const word = words.find((w) =>
            wordRange(w).isEqual(diagnostic.range),
          );
          if (word === undefined) continue;
          for (const { kind } of actionsFor(word.status)) {
            const fix = new vscode.CodeAction(
              actionTitle(word.surface, kind),
              vscode.CodeActionKind.QuickFix,
            );
            fix.diagnostics = [diagnostic];
            fix.command = {
              command: ENTRY_COMMAND,
              title: fix.title,
              arguments: [word.surface, kind],
            };
            actions.push(fix);
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
    vscode.commands.registerCommand(ENTRY_COMMAND, runEntry),
    vscode.commands.registerCommand("compositor.toggleUnaccountedWords", () =>
      vscode.workspace
        .getConfiguration("compositor")
        .update(SETTING, !enabled(), vscode.ConfigurationTarget.Workspace),
    ),
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration(`compositor.${SETTING}`)) refresh();
    }),
    vscode.window.onDidChangeActiveTextEditor((editor) => {
      if (editor !== undefined) scan(editor.document);
    }),
    vscode.workspace.onDidChangeTextDocument((e) => onEdit(e.document)),
    vscode.workspace.onDidCloseTextDocument(drop),
    { dispose: () => timers.forEach(clearTimeout) },
  );
  refresh();

  return {
    wordsOf: (document) => scanned.get(document.uri.fsPath) ?? [],
    onCorpusChanged: refresh,
    dispose: () => collection.dispose(),
  };
};
