/**
 * The vscode-free suggestion rules: how scanner suggestions map to toggle
 * categories and to the markup a quick fix writes.
 */

import { describe, expect, it } from "vitest";
import type { MarkupSuggestion } from "@earlytexts/corpus";
import {
  categoriesFor,
  categoryKey,
  categoryLabel,
  fixTitle,
  languageLabel,
  suggestionKey,
  suggestionMessage,
  wrapText,
} from "../src/suggestions.ts";

const at = (
  type: MarkupSuggestion["type"],
  text: string,
  lang?: string,
): MarkupSuggestion => ({
  type,
  ...(lang === undefined ? {} : { lang }),
  text,
  startLine: 0,
  startColumn: 0,
  endLine: 0,
  endColumn: text.length,
});

describe("categoriesFor", () => {
  it("lists People and Citations first, then known languages in order", () => {
    const categories = categoriesFor(["grc", "de", "la", "fr"]);
    expect(categories.map(categoryLabel)).toEqual([
      "People",
      "Citations",
      "Latin",
      "French",
      "Ancient Greek",
      "German",
    ]);
  });

  it("sorts unknown language codes after the known ones, by label", () => {
    const categories = categoriesFor(["es", "it", "la"]);
    expect(categories.map(categoryLabel)).toEqual([
      "People",
      "Citations",
      "Latin",
      "Italian",
      "Spanish",
    ]);
  });

  it("dedupes repeated codes", () => {
    expect(categoriesFor(["la", "la"])).toHaveLength(3);
  });
});

describe("category / suggestion keys", () => {
  it("agree so an enabled category selects its suggestions", () => {
    expect(categoryKey({ kind: "person" })).toBe(suggestionKey(at("person", "X")));
    expect(categoryKey({ kind: "language", code: "la" }))
      .toBe(suggestionKey(at("language", "quod", "la")));
  });

  it("separate one language from another", () => {
    expect(suggestionKey(at("language", "quod", "la")))
      .not.toBe(suggestionKey(at("language", "chose", "fr")));
  });
});

describe("wrapText", () => {
  it("wraps a person in [p:…]", () => {
    expect(wrapText(at("person", "Hobbes"))).toBe("[p:Hobbes]");
  });
  it("wraps a citation in […]", () => {
    expect(wrapText(at("citation", "Sect. IV."))).toBe("[Sect. IV.]");
  });
  it("wraps a language in $xx:…$", () => {
    expect(wrapText(at("language", "in foro", "la"))).toBe("$la:in foro$");
    expect(wrapText(at("language", "λόγος", "grc"))).toBe("$grc:λόγος$");
  });
  it("keeps any inline markup inside the match intact", () => {
    expect(wrapText(at("language", "fo//12//ro humano", "la")))
      .toBe("$la:fo//12//ro humano$");
  });
});

describe("labels", () => {
  it("names known languages and uppercases the rest", () => {
    expect(languageLabel("grc")).toBe("Ancient Greek");
    expect(languageLabel("cy")).toBe("CY");
  });
  it("phrases messages and fix titles per type", () => {
    expect(suggestionMessage(at("person", "Hobbes"))).toMatch(/name/);
    expect(suggestionMessage(at("language", "quod", "la"))).toMatch(/Latin/);
    expect(fixTitle(at("citation", "X"))).toBe("Mark up as a citation ([…])");
    expect(fixTitle(at("language", "quod", "la")))
      .toBe("Mark up as Latin ($la:…$)");
  });
});
