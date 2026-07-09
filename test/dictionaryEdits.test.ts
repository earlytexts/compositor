/**
 * The dictionary quick-fix core: placing a curation decision into a shard's
 * canonical text. The corpus owns the format and validation, so these cases
 * check the placement round-trips — sorted, minimal, and byte-identical to what
 * the corpus's own fmt would write.
 */

import { expect, test } from "vitest";
import {
  actionsFor,
  confirmEntryText,
  upsertEntryText,
} from "../src/dictionaryEdits.ts";

test("adds a modern word to an existing shard, keeping keys sorted", () => {
  const before = '{\n  "apple": null\n}\n';
  expect(upsertEntryText(before, "and", null)).toBe(
    '{\n  "and": null,\n  "apple": null\n}\n',
  );
});

test("seeds a new (empty) shard", () => {
  expect(upsertEntryText("", "wombat", null)).toBe('{\n  "wombat": null\n}\n');
  expect(upsertEntryText("{}", "wombat", null)).toBe(
    '{\n  "wombat": null\n}\n',
  );
});

test("adds a respelling as a cross-reference", () => {
  expect(upsertEntryText("", "vertue", "virtue")).toBe(
    '{\n  "vertue": "virtue"\n}\n',
  );
});

test("adds a modern word with a stated lemma", () => {
  expect(upsertEntryText("", "increases", "=increase")).toBe(
    '{\n  "increases": "=increase"\n}\n',
  );
});

test("replaces an existing entry rather than duplicating it", () => {
  const before = '{\n  "lay": null\n}\n';
  expect(upsertEntryText(before, "lay", [null, "=lie"])).toBe(
    '{\n  "lay": [null, "=lie"]\n}\n',
  );
});

test("rejects a malformed value", () => {
  expect(() => upsertEntryText("", "x", "=not a lemma")).toThrow();
});

test("confirming drops the `?` and keeps the reading", () => {
  const before = '{\n  "compleat": "?complete"\n}\n';
  expect(confirmEntryText(before, "compleat")).toBe(
    '{\n  "compleat": "complete"\n}\n',
  );
});

test("confirming an absent entry throws", () => {
  expect(() => confirmEntryText("{}", "ghost")).toThrow();
});

test("offers add actions for an unknown surface, confirm for an unconfirmed one", () => {
  expect(actionsFor("unaccounted").map((a) => a.kind)).toEqual([
    "modern",
    "respell",
    "lemma",
  ]);
  expect(actionsFor("unconfirmed").map((a) => a.kind)).toEqual(["confirm"]);
});
