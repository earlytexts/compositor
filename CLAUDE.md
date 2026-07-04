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
  and the `dist/` read/write pair as runtime-neutral TypeScript (everything
  takes a `CorpusFs` port; the disk binding — `node:fs`-backed, shared with
  the corpus's own Deno scripts — is `@earlytexts/corpus/fs`). esbuild bundles
  it — with `preserveSymlinks`, since the corpus checkout has no node_modules
  — so contributors need nothing beyond VSCode (no Deno, no npm).
- **One compile pass per change.** `src/corpusModel.ts` compiles the corpus
  once, feeds the compiled files to the validation rules, and hands the same
  documents to `buildCatalog` (its `precompiled` parameter) so the catalogue
  composes without recompiling. A watcher on `data/**` recompiles just the
  saved `.mit` file (~1s round trip); non-file events trigger a full reload
  (~20s, cold-start cost).
- **The compiled `dist/` masks the cold start.** At startup the model seeds
  the tree from `dist/` via the corpus's `loadCatalog` (~0.5s) while the full
  compile runs; diagnostics always wait for the compile (serialised documents
  carry no source ranges). Every completed load writes `dist/` back
  (`writeDist`, ~0.5s, chained so writes never interleave), so the cache — and
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
  + dist/ cache (seed + write-back)
- `src/corpusTree.ts` — Corpus Browser tree data provider
- `src/diagnostics.ts` — Problems-panel diagnostics + status bar
- `src/templates.ts` — pure scaffold file builders (formatted, schema-correct)
- `src/commands/` — scaffolds, fix formatting, insert borrowed reference

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
