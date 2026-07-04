/**
 * Insert a borrowed-child reference (`## <Author.Work.Edition>`) at the
 * cursor, picking the edition from the catalogue. Borrowed children splice
 * another edition's text in place — this is how collections (ETSS, FD, HE)
 * share text with the works they gather.
 */

import * as vscode from "vscode";
import type { Edition, Work } from "@earlytexts/corpus";
import type { CorpusModel } from "../corpusModel.ts";

export const insertBorrowedRef = async (
  model: CorpusModel,
): Promise<void> => {
  const editor = vscode.window.activeTextEditor;
  const catalog = model.state?.catalog;
  if (editor === undefined || catalog === undefined) return;

  // Works appear under each of their authors; collect each edition once.
  const seen = new Set<Work>();
  const items: (vscode.QuickPickItem & { edition: Edition })[] = [];
  for (const author of catalog.authors) {
    for (const work of author.works) {
      if (seen.has(work)) continue;
      seen.add(work);
      for (const edition of work.editions) {
        items.push({
          label: edition.document.id,
          description: edition.title,
          edition,
        });
      }
    }
  }

  const picked = await vscode.window.showQuickPick(items, {
    placeHolder: "Edition to borrow",
    matchOnDescription: true,
  });
  if (picked === undefined) return;

  await editor.insertSnippet(
    new vscode.SnippetString(`## <${picked.edition.document.id}>\n`),
    editor.selection.active.with({ character: 0 }),
  );
};
