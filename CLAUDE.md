# Early Text Compositor — Architectural Decisions

## Overview

The Early Text Compositor is a VSCode extension for contributing to the Early
Text Corpus. It activates when VSCode is opened in a clone of the corpus
(detected by `data/authors`; `compositor.corpusRoot` points at a subfolder if
needed) and provides a metadata-driven corpus browser, live corpus validation
in the Problems panel, scaffolding commands, and formatting/reference helpers.
Git/GitHub automation is deliberately out of scope for now — the user manages
their own clone, commits, and pushes (see TODO.md); the one exception is the
welcome view's Clone Corpus button, which hands off to VSCode's own git.clone.

## Key decisions

- **Standalone extension** with `extensionDependencies` on
  `earlytexts.vscode-markit` (which owns syntax highlighting, per-file live
  compile errors, formatting, and preview). The Compositor adds only the
  corpus layer, and suppresses its own copy of compile errors for open
  documents so the two never double-report.
- **Corpus logic is imported, never reimplemented.** `@earlytexts/corpus`
  (a `file:../corpus` dependency on the sibling checkout) exports the corpus's
  own catalogue build, metadata schema, path conventions, validation rules,
  and the `catalogue/` read/write pair as runtime-neutral logic (everything
  takes a `CorpusFs` port; the disk binding — `node:fs`-backed, shared with
  the corpus's own Node scripts — is `nodeCorpusFs`, re-exported from the main
  entry). esbuild bundles
  it (with `preserveSymlinks`), so contributors need nothing beyond VSCode.
  The corpus is a Node package with its own `node_modules`, so it carries its
  own `@earlytexts/markit` copy; while it's a `file:` link (not yet a published,
  hoistable npm dep) that copy would shadow ours and split markit into two
  Symbol-incompatible instances, so `esbuild.mjs` aliases `@earlytexts/markit`
  to this package's single copy (vitest does the same via `dedupe`). Once the
  corpus is published to npm and its markit hoists to one shared copy, the alias
  and `preserveSymlinks` become no-ops.
- **One compile pass per change.** `src/corpusModel.ts` compiles the corpus
  once, feeds the compiled files to the validation rules, and hands the same
  documents to `buildCatalogue` (its `precompiled` parameter) so the catalogue
  composes without recompiling. A watcher on `data/**` recompiles just the
  saved `.mit` file (~1s round trip); non-file events trigger a full reload
  (~20s, cold-start cost).
- **The compiled `catalogue/` masks the cold start.** At startup the model seeds
  the tree from `catalogue/` via the corpus's `loadCatalogue` (~0.5s) while the full
  compile runs; diagnostics always wait for the compile (serialised documents
  carry no source ranges). Every completed load writes `catalogue/` back
  (`writeCatalogue`, ~0.5s, chained so writes never interleave), so the cache — and
  the computer's dev input — stays fresh.
- **Clone Corpus** (welcome-view button / command) delegates to the built-in
  `git.clone` with the corpus URL; opening the clone activates the extension,
  and no separate build step is needed (the model builds in memory).
- **Build tooling**: esbuild + npm; `vsce package` for the .vsix; vitest for
  unit tests (scaffold templates are validated against the real corpus rule
  set via the corpus's in-memory test harness).

## Structure

- `src/extension.ts` — activation (corpus-root detection), wiring, commands
- `src/corpusModel.ts` — in-memory corpus: load/validate/catalogue + watcher
  + catalogue/ cache (seed + write-back)
- `src/corpusTree.ts` — Corpus Browser tree data provider
- `src/diagnostics.ts` — Problems-panel diagnostics + status bar
- `src/templates.ts` — pure scaffold file builders (formatted, schema-correct)
- `src/suggestions.ts` — pure markup-suggestion helpers (categories, wrap text)
- `src/hintOverrides.ts` — manual patches to the mined language lexicons
- `src/commands/` — scaffolds, fix formatting, insert borrowed reference,
  suggest markup

## Markup suggestions

`compositor.suggestMarkup` flags likely people, citations, and foreign text
(Latin/French/Greek/…) in the open edition so a contributor can cycle them
(F8, like any diagnostic) and mark each up with a quick fix — or ignore it.
The finding is the corpus's: `buildHints`/`scanSource` in `@earlytexts/corpus`
mine lexicons from the markup the corpus already carries (so suggestions
improve as markup accumulates) and scan a file's raw source. This extension is
only the editor surface — `src/commands/suggestMarkup.ts` owns the toggle
picker, a dedicated Information-severity diagnostic collection (kept apart from
validation, whose diagnostics share the "compositor" source, so the two never
tangle), and the quick-fix code-action provider. Hints are cached and rebuilt
only when the corpus model reloads; scanning is per-file and on-demand. Pure
rules (category ⇄ suggestion mapping, wrap delimiters) live in
`src/suggestions.ts` and are unit-tested; `test/suggestionsPipeline.test.ts`
runs the whole mine→scan→filter→wrap path (see `vitest.config.ts`: markit must
dedupe to one instance so its block `Symbol()`s compare equal across the
corpus/markit boundary — the esbuild bundle gets this from preserveSymlinks).

## Corpus layout (what the tree and scaffolds produce)

```
data/authors/<author>.mit            author metadata (no text)
data/works/<host>/<work>/index.mit   work stub: identity + canonical pointer
data/works/<host>/<work>/<year>.mit  a dated edition (1748, 1742a, 1739-40…)
```

`<host>` is the author slug, or a hyphen-joined joint slug for co-authored
works. A section heading `## <Author.Work.Edition>` borrows another edition's
text (collections are composed this way). Metadata lives in `[metadata]`
blocks inside the `.mit` files; the schema is `corpus/src/schema.ts`.

## Conventions

- TypeScript strict (no stricter than the corpus's `deno check`, whose sources
  this project typechecks); functional style: arrow functions, no classes.
- Imports use explicit `.ts` extensions (`allowImportingTsExtensions`).
- Dependencies stay limited to `@earlytexts/corpus` and `@earlytexts/markit`.
