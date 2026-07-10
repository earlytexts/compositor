/**
 * The suggestion pipeline the controller runs, minus the editor: build the
 * lexicons from a catalogue, scan a source, keep the enabled categories, and
 * apply each fix. Proves the @jsr/earlytexts__corpus wiring resolves from the
 * compositor and that the category filter and wrap agree with the scanner.
 */

import { describe, expect, it } from "vitest";
import { compile } from "@jsr/earlytexts__markit";
import type { Catalogue } from "@jsr/earlytexts__corpus";
import { buildHints, scanSource } from "../src/lib/hints.ts";
import { suggestionKey, wrapText } from "../src/lib/suggestions.ts";
import { hintOverrides } from "../src/lib/hintOverrides.ts";

/** A one-author, one-edition catalogue over `body` (a `.mit` document body). */
const catalogueOf = (body: string): Catalogue => {
  const document = compile(`# Hume.Work.1748\n\n${body}\n`)[0];
  const edition = {
    authorSlugs: ["hume"],
    workSlug: "work",
    slug: "1748",
    title: "An Enquiry",
    breadcrumb: "Enquiry",
    imported: false,
    published: [1748],
    document,
  };
  const work = {
    authorSlugs: ["hume"],
    hostSlug: "hume",
    slug: "work",
    title: "An Enquiry",
    breadcrumb: "Enquiry",
    imported: false,
    firstPublished: 1748,
    canonicalSlug: "1748",
    standalone: true,
    dir: "works/hume/work",
    editions: [edition],
  };
  const author = {
    slug: "hume",
    forename: "David",
    surname: "Hume",
    works: [work],
  };
  return {
    authors: [author],
    byAuthor: new Map([["hume", author]]),
    sources: new WeakMap(),
  } as unknown as Catalogue;
};

/** Apply the enabled-category fixes to a fresh source, right-to-left so the
 * earlier ranges keep their offsets. */
const markUp = (
  source: string,
  enabled: Set<string>,
  hints: Catalogue,
): string => {
  const [doc] = compile(source);
  const suggestions = scanSource(source, doc, buildHints(hints, hintOverrides))
    .filter((s) => enabled.has(suggestionKey(s)))
    .sort((a, b) => b.startLine - a.startLine || b.startColumn - a.startColumn);
  const lines = source.split("\n");
  for (const s of suggestions) {
    // Single-line suggestions only in this fixture.
    const line = lines[s.startLine];
    lines[s.startLine] =
      line.slice(0, s.startColumn) + wrapText(s) + line.slice(s.endColumn);
  }
  return lines.join("\n");
};

describe("suggestion pipeline", () => {
  it("mines lexicons the compositor can act on", () => {
    // "Cicero" is a marked person elsewhere in the corpus; here the author
    // seed (David Hume) and a Latin span train the scanner.
    const catalogue = catalogueOf(
      "{#1}\nCicero wrote $la:quod erat in foro$ about nature.",
    );
    const hints = buildHints(catalogue, hintOverrides);
    expect(hints.languages.get("la")?.strong.has("quod")).toBe(true);
    expect([...hints.people.keys()]).toContain("hume");
  });

  it("marks up an enabled Latin cluster, leaving prose alone", () => {
    const catalogue = catalogueOf("{#1}\nHe said $la:quod foro$ once.");
    // Fresh source (no markup yet) with the same Latin used unmarked.
    const source = "# T\n\n{#1}\nHe said quod foro plainly.\n";
    const enabled = new Set(["language:la"]);
    expect(markUp(source, enabled, catalogue)).toContain("$la:quod foro$");
  });

  it("respects the enabled set: people off means no person markup", () => {
    const catalogue = catalogueOf("{#1}\nA line about $la:quod foro$ matters.");
    const source = "# T\n\n{#1}\nDavid Hume said quod foro here.\n";
    const langOnly = markUp(source, new Set(["language:la"]), catalogue);
    expect(langOnly).toContain("$la:quod foro$");
    expect(langOnly).not.toContain("[p:David Hume]");

    const withPeople = markUp(
      source,
      new Set(["language:la", "person"]),
      catalogue,
    );
    expect(withPeople).toContain("[p:David Hume]");
    expect(withPeople).toContain("$la:quod foro$");
  });
});
