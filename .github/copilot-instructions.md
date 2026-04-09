# Early Text Compositor — Architectural Decisions

## Overview

The Early Text Compositor is a VSCode extension that helps contributors edit and submit texts to the Early Text Corpus. It abstracts away Git/GitHub so contributors only need VSCode and a GitHub account.

## Architecture

### Subsystems

1. **Extension Core** — Activation, configuration, commands, lifecycle
2. **GitHub Auth** — Uses VSCode's built-in GitHub auth provider (`vscode.authentication`)
3. **Corpus Management** — Clones/pulls the corpus repo; manages local working copy; all git ops hidden from user
4. **Corpus Browser** — Tree view: authors → works → editions → sections, parsed from `index.mit` metadata
5. **Editing Workflow** — Creates feature branches transparently; opens `.mit` files for editing; tracks dirty state
6. **Submission Workflow** — Commits, pushes, creates GitHub PRs on user's behalf; shows submission status
7. **Markit Integration** — Declares `extensionDependencies` on the Markit extension for syntax highlighting + preview

### Key Decisions

- **Standalone extension** with `extensionDependencies` on `earlytexts.vscode-markit` (not bundled/monorepo)
- **Build tooling**: esbuild + npm
- **Markit parsing**: `@earlytexts/markit` npm package bundled into extension via esbuild (not calling Markit extension API)
- **Corpus access**: Extension manages cloning/pulling the corpus repository behind the scenes
- **Publisher ID**: `earlytexts` (placeholder)

### Corpus Structure

The corpus lives in a Git repo with this structure:

```
data/
  {author}/                   # e.g. hume, locke
    index.mit                 # Author metadata (forename, surname, birth, death, etc.)
    {work}.mit                # Simple single-file work
    {work}/                   # Multi-file work
      index.mit               # Work metadata (title, breadcrumb, published, editions, children)
      {child}.mit             # Section content (marked in work's `children` metadata)
      {child}/                # More complex section with subsections
        index.mit             # Section metadata (title, subsection, pages, speaker)
        {grandchild}.mit      # Subsection content (or subsection directory, with arbitrary nesting)
      {edition}/              # Edition variant (marked in work's `editions` metadata)
        index.mit             # Edition metadata
```
