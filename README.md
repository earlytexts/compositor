# The Early Text Compositor

The _Early Text Compositor_ is a VSCode extension for contributing to the
[Early Text Corpus](https://github.com/earlytexts/corpus), a collection of
diplomatic digital editions of texts from the hand press era, stored in
[Markit](https://github.com/earlytexts/markit) — a human-friendly markup
language designed for early text preservation.

The extension activates when VSCode is opened in a clone of the corpus (it
looks for `data/authors`; if the corpus is a subfolder of the workspace, point
`compositor.corpusRoot` at it). Git stays in the contributor's hands — the
extension reads and writes the working tree, nothing more.

It sits on top of the [Markit language extension](https://github.com/earlytexts/markit)
(declared as an extension dependency), which provides syntax highlighting,
live compile errors, formatting, and preview for individual `.mit` files. The
Compositor adds the corpus layer:

- **Corpus Browser** — an activity-bar tree of authors → works → editions,
  labelled from metadata (names, titles, years; the canonical edition is
  starred). Clicking an author or edition opens its file; works expand to
  their editions, with the metadata stub on the context menu.
- **Validation** — the corpus's full rule set (the same rules `deno task
  validate` runs) published to the Problems panel, with a status-bar summary
  and a badge on the tree. Saving a file revalidates in about a second; the
  initial load compiles the whole corpus and takes ~20s.
- **Scaffolding** — New Author, New Work (with its first edition), and New
  Edition commands that prompt for the required metadata and write canonical,
  already-formatted files.
- **Fix Formatting** — the one-click equivalent of the corpus's
  `deno task fix`, applying the Markit formatter to every file.
- **Insert Borrowed Section Reference** — pick an edition from the catalogue
  and insert a `## <Author.Work.Edition>` placeholder at the cursor.

All corpus logic (catalogue building, validation rules, path conventions) is
bundled from the corpus repository itself via the `@earlytexts/corpus`
package, so the rules cannot drift from the corpus's own — and contributors
need nothing installed beyond VSCode.

## Development

Corpus logic comes from the published `@earlytexts/corpus` JSR package,
installed through JSR's npm compatibility layer under its registry name
`@jsr/earlytexts__corpus` (the committed `.npmrc` maps the `@jsr` scope to
`npm.jsr.io`), so a plain `npm install` is all that's needed — no sibling
checkouts required.

```sh
npm install
npm run compile   # bundle to dist/ (npm run watch for development)
npm run check     # typecheck
npm test          # unit tests (scaffold templates against the real rule set)
npm run package   # build the .vsix
```

To try it: open this folder in VSCode, press F5, and open the corpus folder
in the Extension Development Host.

## Architecture

### Key decisions

- **Standalone extension** with `extensionDependencies` on
  `earlytexts.markit-language` (which owns syntax highlighting, per-file live
  compile errors, formatting, and preview). The Compositor adds only the
  corpus layer, and suppresses its own copy of compile errors for open
  documents so the two never double-report.
- **Corpus logic is imported, never reimplemented.** `@jsr/earlytexts__corpus`
  (the published JSR package via its npm compatibility layer) exports the
  corpus's own catalogue build, metadata schema, path conventions, validation
  rules, and the `catalogue/` read/write pair as runtime-neutral logic
  (everything takes a `CorpusFs` port; the disk binding — `node:fs`-backed,
  shared with the corpus's own scripts — is `nodeCorpusFs`, re-exported from the
  main entry). esbuild bundles it into `dist/extension.cjs`, so contributors
  need nothing beyond VSCode and a plain `npm install`. Because the corpus
  declares its markit dependency under the same real registry name this
  extension uses (`@jsr/earlytexts__markit` — the reason we import the `@jsr`
  names directly rather than aliasing them back to `@earlytexts/*`), npm hoists
  one shared markit copy that both resolve to — which matters because markit
  tags blocks with `Symbol()`s that only compare equal within one instance, so
  the two halves of the suggestion pipeline must share it. (No esbuild alias or
  `preserveSymlinks` is needed for this any more; a single hoisted copy gives it
  for free.)
- **One compile pass per change.** `src/corpusModel.ts` compiles the corpus
  once, feeds the compiled files to the validation rules, and hands the same
  documents to `buildCatalogue` (its `precompiled` parameter) so the catalogue
  composes without recompiling. A watcher on `data/**` recompiles just the
  saved `.mit` file (~1s round trip); non-file events trigger a full reload
  (~20s, cold-start cost).
- **The compiled `catalogue/` masks the cold start.** At startup the model seeds
  the tree from `catalogue/` via the corpus's `loadCatalogue` (~0.5s) while the
  full compile runs; diagnostics always wait for the compile (serialised
  documents carry no source ranges). Every completed load writes `catalogue/`
  back (`writeCatalogue`, ~0.5s, chained so writes never interleave), so the
  cache — and the computer's dev input — stays fresh.
- **Clone Corpus** (welcome-view button / command) delegates to the built-in
  `git.clone` with the corpus URL; opening the clone activates the extension,
  and no separate build step is needed (the model builds in memory).
- **Build tooling**: esbuild + npm; `vsce package` for the .vsix; vitest for
  unit tests (scaffold templates are validated against the real corpus rule
  set via the corpus's in-memory test harness).

### Structure

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

### Markup suggestions

`compositor.suggestMarkup` flags likely people, citations, and foreign text
(Latin/French/Greek/…) in the open edition so a contributor can cycle them
(F8, like any diagnostic) and mark each up with a quick fix — or ignore it.
The finding is the corpus's: `buildHints`/`scanSource` in `@jsr/earlytexts__corpus`
mine lexicons from the markup the corpus already carries (so suggestions
improve as markup accumulates) and scan a file's raw source. This extension is
only the editor surface — `src/commands/suggestMarkup.ts` owns the toggle
picker, a dedicated Information-severity diagnostic collection (kept apart from
validation, whose diagnostics share the "compositor" source, so the two never
tangle), and the quick-fix code-action provider. Hints are cached and rebuilt
only when the corpus model reloads; scanning is per-file and on-demand. Pure
rules (category ⇄ suggestion mapping, wrap delimiters) live in
`src/suggestions.ts` and are unit-tested; `test/suggestionsPipeline.test.ts`
runs the whole mine→scan→filter→wrap path — which only holds together because
markit resolves to one instance across the corpus/markit boundary (its block
`Symbol()`s compare equal only within one instance), guaranteed here by the
single hoisted `@jsr/earlytexts__markit` copy that npm installs.

### Corpus layout (what the tree and scaffolds produce)

```
data/authors/<author>.mit            author metadata (no text)
data/works/<host>/<work>/index.mit   work stub: identity + canonical pointer
data/works/<host>/<work>/<year>.mit  a dated edition (1748, 1742a, 1739-40…)
```

`<host>` is the author slug, or a hyphen-joined joint slug for co-authored
works. A section heading `## <Author.Work.Edition>` borrows another edition's
text (collections are composed this way). Metadata lives in `[metadata]`
blocks inside the `.mit` files; the schema is `corpus/src/schema.ts`.

### Conventions

- TypeScript strict (no stricter than the corpus's typecheck, whose sources
  this project typechecks); functional style: arrow functions, no classes.
- Imports use explicit `.ts` extensions (`allowImportingTsExtensions`).
- Dependencies stay limited to the corpus and markit JSR packages
  (`@jsr/earlytexts__corpus` and `@jsr/earlytexts__markit`).
