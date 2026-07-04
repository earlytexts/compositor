/**
 * Whole-word, case-sensitive find/replace across every edition of the current
 * work — or, at the contributor's choice, every work by its author(s).
 * Triggered from the editor context menu on a .mit file: the selection (or the
 * word under the cursor) is the search term. Matching is whole-word only, so
 * replacing "vertue" with "virtue" leaves "vertuous" untouched, and
 * case-sensitive, so "Reason" and "reason" stay distinct.
 *
 * Only edition source files are touched (never author files or work stubs); the
 * watcher revalidates the affected files afterwards.
 */

import * as vscode from "vscode";
import type { Author, Catalog, Edition, Work } from "@earlytexts/corpus";
import { normalizePath } from "@earlytexts/corpus";
import type { CorpusModel } from "../corpusModel.ts";
import { editionPath } from "../corpusTree.ts";
import { replaceWholeWord } from "../wholeWord.ts";

/** The work (and edition) whose source file is `filePath`, if any. */
const findEdition = (
  catalog: Catalog,
  filePath: string,
): { work: Work; edition: Edition } | undefined => {
  const target = normalizePath(filePath);
  for (const author of catalog.authors) {
    for (const work of author.works) {
      for (const edition of work.editions) {
        if (editionPath(catalog, edition) === target) return { work, edition };
      }
    }
  }
  return undefined;
};

/** Every work by any of `slugs`, each once, in author order. */
const worksByAuthors = (catalog: Catalog, slugs: string[]): Work[] => {
  const seen = new Set<Work>();
  const works: Work[] = [];
  for (const slug of slugs) {
    const author: Author | undefined = catalog.byAuthor.get(slug);
    for (const work of author?.works ?? []) {
      if (seen.has(work)) continue;
      seen.add(work);
      works.push(work);
    }
  }
  return works;
};

/** The edition source files of `works`, deduplicated, in a stable order. */
const editionFiles = (catalog: Catalog, works: Work[]): string[] => {
  const paths = new Set<string>();
  for (const work of works) {
    for (const edition of work.editions) {
      const path = editionPath(catalog, edition);
      if (path !== undefined) paths.add(path);
    }
  }
  return [...paths];
};

export const replaceInScope = async (model: CorpusModel): Promise<void> => {
  const editor = vscode.window.activeTextEditor;
  const catalog = model.state?.catalog;
  if (editor === undefined || catalog === undefined) return;

  const found = findEdition(catalog, editor.document.uri.fsPath);
  if (found === undefined) {
    void vscode.window.showWarningMessage(
      "Compositor: the active file isn't a known edition — open an edition " +
        "of a work to replace words across it.",
    );
    return;
  }
  const { work, edition } = found;

  // The word: the selection, or (failing that) the word under the cursor.
  const range = editor.selection.isEmpty
    ? editor.document.getWordRangeAtPosition(editor.selection.active)
    : editor.selection;
  const search = range === undefined
    ? ""
    : editor.document.getText(range).trim();
  if (search === "") {
    void vscode.window.showWarningMessage(
      "Compositor: select a word (or place the cursor in one) to replace.",
    );
    return;
  }

  const replacement = await vscode.window.showInputBox({
    title: `Replace “${search}”`,
    prompt: "Whole-word, case-sensitive replacement across the chosen scope",
    value: search,
    valueSelection: [0, search.length],
    // Corpus-model reloads and editor refreshes fire in the background while
    // this command runs; without this the prompt is dismissed the moment one
    // of them steals focus, which reads as "Enter did nothing".
    ignoreFocusOut: true,
  });
  if (replacement === undefined || replacement === search) return;

  // Scope: this work, or every work by its author(s). The author option is
  // only worth offering when it reaches beyond this single work.
  const authorWorks = worksByAuthors(catalog, edition.authorSlugs);
  const workFiles = editionFiles(catalog, [work]);
  const authorFiles = editionFiles(catalog, authorWorks);
  const scopes: (vscode.QuickPickItem & { files: string[] })[] = [
    {
      label: "This work",
      description: `${work.breadcrumb} · ${plural(workFiles.length, "edition")}`,
      files: workFiles,
    },
  ];
  if (authorFiles.length > workFiles.length) {
    scopes.push({
      label: "This author",
      description:
        `${authorNames(catalog, edition.authorSlugs)} · ${
          plural(authorWorks.length, "work")
        }, ${plural(authorFiles.length, "edition")}`,
      files: authorFiles,
    });
  }
  const scope = scopes.length === 1
    ? scopes[0]
    : await vscode.window.showQuickPick(scopes, {
      title: `Replace “${search}” with “${replacement}” in…`,
      ignoreFocusOut: true,
    });
  if (scope === undefined) return;

  const confirmed = await vscode.window.showWarningMessage(
    `Replace every whole-word “${search}” with “${replacement}” across ${
      plural(scope.files.length, "file")
    }? This can be undone per file (⌘Z in each editor).`,
    { modal: true },
    "Replace",
  );
  if (confirmed !== "Replace") return;

  await vscode.window.withProgress(
    { location: vscode.ProgressLocation.Notification, title: "Replacing" },
    async () => {
      // Edit through a WorkspaceEdit (not raw disk writes): rewriting an open
      // file on disk makes VSCode auto-revert its editor, and that revert lands
      // asynchronously — dismissing whatever dialog the next invocation has
      // open. Editing in memory then saving avoids the external-change revert
      // (and gives per-file undo). getText() also respects unsaved edits.
      const edit = new vscode.WorkspaceEdit();
      const touched: vscode.TextDocument[] = [];
      let occurrences = 0;
      for (const path of scope.files) {
        let doc: vscode.TextDocument;
        try {
          doc = await vscode.workspace.openTextDocument(vscode.Uri.file(path));
        } catch {
          continue; // gone since the catalogue was built
        }
        const text = doc.getText();
        const { text: next, count } = replaceWholeWord(
          text,
          search,
          replacement,
        );
        if (count === 0) continue;
        edit.replace(
          doc.uri,
          new vscode.Range(doc.positionAt(0), doc.positionAt(text.length)),
          next,
        );
        touched.push(doc);
        occurrences += count;
      }
      if (occurrences > 0) {
        await vscode.workspace.applyEdit(edit);
        for (const doc of touched) await doc.save();
      }
      void vscode.window.showInformationMessage(
        occurrences === 0
          ? `Compositor: no whole-word “${search}” found in ${
            plural(scope.files.length, "file")
          }.`
          : `Compositor: replaced ${plural(occurrences, "occurrence")} of “${
            search
          }” with “${replacement}” across ${plural(touched.length, "file")}.`,
      );
    },
  );
};

const plural = (n: number, noun: string): string =>
  `${n} ${noun}${n === 1 ? "" : "s"}`;

/** "David Hume", or "Astell & Norris" for a co-authored work. */
const authorNames = (catalog: Catalog, slugs: string[]): string =>
  slugs
    .map((slug) => {
      const author = catalog.byAuthor.get(slug);
      return author === undefined
        ? slug
        : `${author.forename} ${author.surname}`.trim();
    })
    .join(" & ");
