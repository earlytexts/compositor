/**
 * Pure text for the dictionary overlay: validating the words a contributor
 * types for a respelling/lemma, the squiggle message for an unaccounted
 * surface, and the quick-fix titles. surface/commands/dictionaryDiagnostics.ts
 * owns the prompts, squiggles, and code actions; the wording and the
 * input-validation rule are here, and tested.
 */

import { fold, isWord } from "@jsr/earlytexts__corpus";
import type { UnaccountedWord } from "./dictionaryScan.ts";
import type { EntryAction } from "./dictionaryEdits.ts";

/** The folded words of a contributor's entry input, or [] if any token is not
 * a word (letters and apostrophes). One word, or space-separated words for an
 * expansion (`'tis` → "it is"). */
export const entryWords = (input: string): string[] => {
  const tokens = input
    .trim()
    .split(/\s+/)
    .filter((t) => t !== "");
  return tokens.every((t) => isWord(fold(t))) && tokens.length > 0
    ? tokens.map(fold)
    : [];
};

/** The Problems-panel message for an unaccounted (unknown) or unconfirmed (`?`)
 * surface. */
export const unaccountedMessage = (
  word: Pick<UnaccountedWord, "status" | "display">,
): string =>
  word.status === "unaccounted"
    ? `“${word.display}” is not in the dictionary.`
    : `“${word.display}” has an unconfirmed dictionary entry.`;

/** The quick-fix title for a curation action on `surface`. */
export const entryActionTitle = (
  surface: string,
  kind: EntryAction["kind"],
): string => {
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
