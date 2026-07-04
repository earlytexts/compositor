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

The corpus, markit, and compositor repositories are expected to be sibling
checkouts (`@earlytexts/corpus` is a `file:../corpus` dependency).

```sh
npm install
npm run compile   # bundle to dist/ (npm run watch for development)
npm run check     # typecheck
npm test          # unit tests (scaffold templates against the real rule set)
npm run package   # build the .vsix
```

To try it: open this folder in VSCode, press F5, and open the corpus folder
in the Extension Development Host.
