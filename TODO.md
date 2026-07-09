# Early Texts Compositor: Feature List

## Done (current prototype)

- [x] Corpus Browser: authors → works → editions from catalogue metadata
- [x] Open author files and editions from the tree; work stub on the context menu
- [x] Corpus validation in the Problems panel (full rule set, shared with the corpus's `deno task test`)
- [x] Incremental revalidation on save (~1s); status-bar summary and tree badge
- [x] New Author / New Work / New Edition scaffolds (canonical, pre-formatted files)
- [x] Corpus-wide Fix Formatting (equivalent of `deno task fmt`)
- [x] Insert Borrowed Section Reference from a catalogue picker

## Next

- [x] Command to bring up native VSCode diff view for two editions of the same work
- [x] Select a word, right-click → "Replace in this work/author" (find/replace in all editions of the same work; optionally in all works by the same author; should match _only_ the same word, not substrings, case sensitive)
- [x] Order authors alphabetically in the tree, and group them by first letter
- [ ] Quick fixes on diagnostics (e.g. format this file, add a missing key)
- [ ] Faster cold start (persist compiled state, or compile in parallel)
- [ ] Paragraph/block ID renumbering and page-range helpers
- [ ] Joint-host (co-authored) work scaffolding
- [ ] Integration with the corpus-tools TCP import pipeline

## Deferred: Git/GitHub integration

The original plan was for the extension to hide git entirely — authenticate
via VSCode's GitHub provider, clone the corpus, manage branches, auto-commit,
and open pull requests ("Check Changes" → "Submit Changes", PR status in a
control panel). That whole workflow is deliberately set aside for now: the
extension assumes the user has cloned the corpus themselves and manages
commits and pushes on their own. Revisit once the editing experience has
settled.

- [ ] Authenticate user via VSCode's built-in GitHub auth provider
- [ ] Clone the corpus repository on first use
- [ ] Branch creation/switching; auto-commit on user branches
- [ ] Current Changes view with diffs against main
- [ ] Check Changes (run validation) → Submit Changes (create PR)
- [ ] PR status display; updating existing PRs
