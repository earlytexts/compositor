/**
 * The vscode-free core of the dictionary quick-fixes: turning a curation
 * decision about one surface into the new canonical text of its shard file.
 * The editor layer (commands/dictionaryDiagnostics.ts) reads the current shard,
 * calls one of these, and writes the result back; canonicalisation (sorting,
 * one entry per line, minimal micro-syntax) is the corpus's own
 * `shardDictionary`, so an entry added from the editor is byte-identical to one
 * `deno task fmt` would produce — it round-trips through corpus validation.
 *
 * These only *place* an entry; whether the result is coherent (its references
 * resolve, its readings are selectable) is the corpus validation's business,
 * reported live in the Problems panel after the write.
 */

import {
  type EntryValue,
  parseDictionary,
  parseEntry,
  shardDictionary,
  shardOf,
} from "@jsr/earlytexts__corpus";

/** The curation actions a squiggled surface offers, by its accounting status. */
export type EntryAction =
  | { kind: "modern" } // no entry → add `null` (a confirmed modern word)
  | { kind: "respell" } // no entry → add a cross-reference to modern spelling(s)
  | { kind: "lemma" } // no entry → add `=lemma` (a modern word, lemma stated)
  | { kind: "confirm" }; // `?` entry → drop the `?`, confirming it

export const actionsFor = (
  status: "unaccounted" | "unconfirmed",
): EntryAction[] =>
  status === "unconfirmed"
    ? [{ kind: "confirm" }]
    : [{ kind: "modern" }, { kind: "respell" }, { kind: "lemma" }];

/**
 * The new canonical text of a surface's shard after adding (or replacing) its
 * entry with `value` — `null` (modern word), `"spelling"` (a cross-reference),
 * `"=lemma"` (a modern word with a stated lemma), or an array (ambiguous). The
 * `value` grammar and the shard are the corpus's; a malformed value throws
 * (the caller has validated its own input). `shardText` is the shard's current
 * content, or "" / "{}" for a new shard.
 */
export const upsertEntryText = (
  shardText: string,
  surface: string,
  value: EntryValue,
): string => {
  const shard = shardOf(surface);
  const { dictionary } = parseDictionary(
    new Map([[shard, shardText.trim() === "" ? "{}" : shardText]]),
  );
  const entry = parseEntry(surface, value);
  if ("error" in entry) throw new Error(entry.error);
  dictionary[surface] = entry;
  return shardDictionary(dictionary).get(shard) ?? "{}\n";
};

/**
 * The new canonical text of a shard after confirming one surface's entry
 * (dropping its `?`). Throws if the surface has no entry in the shard.
 */
export const confirmEntryText = (
  shardText: string,
  surface: string,
): string => {
  const shard = shardOf(surface);
  const { dictionary } = parseDictionary(new Map([[shard, shardText]]));
  const entry = dictionary[surface];
  if (entry === undefined) {
    throw new Error(`no dictionary entry for "${surface}" to confirm`);
  }
  dictionary[surface] = { ...entry, confirmed: true };
  return shardDictionary(dictionary).get(shard) ?? "{}\n";
};
