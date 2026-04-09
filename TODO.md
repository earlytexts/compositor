# Early Texts Compositor: Feature List

## UI Components

- **Control Panel**: A sidebar webview providing buttons, inputs, and status information (e.g. current branch, sync status). The main entry point for user interaction.
- **Current Changes**: A sidebar view listing files modified on the current branch. Git staging details are hidden from users — all changes appear as a single list. Clicking a file opens a diff view comparing it against the main branch.
- **Corpus Browser**: A sidebar view displaying the corpus structure (authors, works, relationships), using human-readable names and titles from metadata. Can be toggled to show a plain file tree instead.
- **Work Editor**: An editor tab for viewing and editing the text of a selected work (provided by VSCode out of the box).
- **Preview Panel**: A side-by-side panel showing a rendered preview of the work being edited (provided by the Markit extension).

## Core Infrastructure

- [ ] Authenticate user via VSCode's built-in GitHub auth provider
- [ ] Clone the corpus repository on first use

## Corpus Browser

- [ ] Display authors, works, and work children in a hierarchical tree
- [ ] Show a loading/placeholder state while cloning or pulling
- [ ] Button to pull the latest changes from the corpus repository
- [ ] Option to toggle between the default metadata view and a plain file tree view

## Editing Workflow

- [ ] Button in the control panel to create a new branch
- [ ] Dropdown to switch between the user's branches and the main branch
- [ ] On a user branch: all changes are automatically staged and committed; subsequent changes amend the same commit
- [ ] On the main branch: changes are not auto-committed — when the user saves, prompt them to either create a new branch (moving their changes there) or leave the changes uncommitted on main
- [ ] Show all current changes in the **Current Changes** view in real time
- [ ] Right-click a work in the Corpus Browser to switch between single-file and multi-file format:
  - *Single → multi*: create a directory for the work, move the file in as `index.mit`, and factor out child works into their own files (only factor out immediate children - not grandchildren or deeper)
  - *Multi → single*: move the file from `{id}/index.mit` to `{id}.mit`, move all child texts inline, then delete the child files and directories (_do_ merge grandchildren and deeper descendants into the new parent file)
  - Note that going multi → single is a lossy operation, since it flattens the hierarchy; subsequently going single → multi will only restore the immediate children, not the deeper descendants. This is intentional.
- [ ] On save, if the work's ID has changed: rename the file to match, and update any path references in parent works
- [ ] On save, if the new ID already exists in the corpus: show an error and refuse to save

## New Author / Text Workflow

- [ ] Button in the control panel to create a new author — prompts for metadata, then creates the author directory with an `index.mit`
- [ ] Right-click an author in the Corpus Browser to create a new work — prompts for metadata and format (single-file or multi-file), then creates the appropriate file or directory
- [ ] Right-click a multi-file work to create a new child — prompts for ID, creates the child file, and updates the parent `index.mit`

## Submission Workflow

- [ ] When on a user branch with committed changes, show a **Check Changes** button that runs `npm test` and displays any errors
- [ ] If all tests pass, replace **Check Changes** with **Submit Changes**
- [ ] If further changes are made after passing tests but before submitting, revert the button to **Check Changes**
- [ ] Clicking **Submit Changes**: prompt for a title and description, then create a pull request from the branch to main
- [ ] Show the PR status (open, merged, closed) and a link to it in the control panel (view a **View in Browser** button)
- [ ] After submitting, further edits continue to auto-commit on the same branch (as a new commit, separate from the submitted one)
- [ ] Once further edits exist post-submission, show a **Check Changes** / **Update Submission** button that behaves like the initial submission flow but updates the existing PR rather than creating a new one
- [ ] If the PR is closed or merged, show that status and disable the **Check Changes** / **Update Submission** button
- [ ] If the PR is merged while further edits exist, show a **Create New Submission** button that starts a new submission flow for the new changes
