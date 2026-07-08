/**
 * The vscode-free core of the markup-suggestion feature: the category model a
 * contributor toggles, and the pure mapping from a scanner suggestion to the
 * markup that would wrap it. The corpus's `scanSource` finds the candidates
 * (people, citations, foreign text) in an edition's source; this decides how
 * they are grouped in the toggle picker and what each "mark this up" quick fix
 * writes. Kept apart from the vscode wiring (commands/suggestMarkup.ts) so the
 * rules are unit-testable without the editor API.
 */

import type { MarkupSuggestion } from "@jsr/earlytexts__corpus";

/** Display names for the language codes the corpus uses; anything unmapped
 * falls back to its uppercased code. */
export const LANGUAGE_NAMES: Record<string, string> = {
  la: "Latin",
  fr: "French",
  grc: "Ancient Greek",
  el: "Greek",
  gr: "Greek",
  it: "Italian",
  de: "German",
  es: "Spanish",
  he: "Hebrew",
};

export const languageLabel = (code: string): string =>
  LANGUAGE_NAMES[code] ?? code.toUpperCase();

/** A toggleable class of suggestion: the two name kinds, plus one per language
 * the corpus has marked up (so a new language appears automatically). */
export type Category =
  | { kind: "person" }
  | { kind: "citation" }
  | { kind: "language"; code: string };

/** The stable identity of a category (and of the suggestions it selects),
 * used as a Set key and to match a suggestion to its enabled category. */
export const categoryKey = (category: Category): string =>
  category.kind === "language" ? `language:${category.code}` : category.kind;

export const suggestionKey = (suggestion: MarkupSuggestion): string =>
  suggestion.type === "language"
    ? `language:${suggestion.lang ?? ""}`
    : suggestion.type;

export const categoryLabel = (category: Category): string =>
  category.kind === "person"
    ? "People"
    : category.kind === "citation"
    ? "Citations"
    : languageLabel(category.code);

/**
 * The categories on offer for a corpus, in a stable order: People, Citations,
 * then one per language, with the well-known codes (Latin, French, Greek)
 * first and any others after, alphabetically by label.
 */
export const categoriesFor = (languageCodes: Iterable<string>): Category[] => {
  const order = ["la", "fr", "grc"];
  const codes = [...new Set(languageCodes)].sort((a, b) => {
    const ia = order.indexOf(a);
    const ib = order.indexOf(b);
    if (ia !== -1 || ib !== -1) {
      return (ia === -1 ? Infinity : ia) - (ib === -1 ? Infinity : ib);
    }
    return languageLabel(a).localeCompare(languageLabel(b));
  });
  return [
    { kind: "person" },
    { kind: "citation" },
    ...codes.map((code): Category => ({ kind: "language", code })),
  ];
};

/** The delimiters that would wrap a suggestion's text as the markup it
 * proposes: `[p:…]` for people, `[…]` for citations, `$xx:…$` for a language.
 */
export const wrapper = (
  suggestion: MarkupSuggestion,
): { open: string; close: string } => {
  if (suggestion.type === "person") return { open: "[p:", close: "]" };
  if (suggestion.type === "citation") return { open: "[", close: "]" };
  const code = suggestion.lang;
  return { open: code === undefined ? "$" : `$${code}:`, close: "$" };
};

/** The replacement text a "mark this up" fix inserts over the match. */
export const wrapText = (suggestion: MarkupSuggestion): string => {
  const { open, close } = wrapper(suggestion);
  return `${open}${suggestion.text}${close}`;
};

/** The diagnostic message shown against a suggestion. */
export const suggestionMessage = (suggestion: MarkupSuggestion): string => {
  if (suggestion.type === "person") return "Possible name — mark up as a person?";
  if (suggestion.type === "citation") {
    return "Possible citation — mark up as a reference?";
  }
  const name = languageLabel(suggestion.lang ?? "");
  return `Possible ${name} — mark up as ${name}?`;
};

/** The quick-fix title for wrapping one suggestion. */
export const fixTitle = (suggestion: MarkupSuggestion): string => {
  const { open, close } = wrapper(suggestion);
  return `Mark up as ${
    suggestion.type === "person"
      ? "a person"
      : suggestion.type === "citation"
      ? "a citation"
      : languageLabel(suggestion.lang ?? "")
  } (${open}…${close})`;
};
