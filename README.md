# The Early Text Compositor

The _Early Text Compositor_ is a VSCode extension designed to help in the creation and curation of the (_Early Text Corpus_)[https://github.com/earlytexts/corpus], a planned collection of diplomatic digital editions of everything in the English Short Title Catalogue (ESTC).

A digitization project on this scale has never been attempted before. It will only be possible with the help of a large community of people willing to volunteer their time and effort. The Compositor exists to facilitate this, by providing a user-friendly interface for submitting edits and entirely new works to the corpus. Contributors will need VSCode and and GitHub account, but they will not need to understand how to use Git or GitHub - the Compositor will handle all of that for them.

The corpus stores texts in (_Markit_)[https://github.com/earlytexts/markit], a custom markup language similar in spirit to Markdown, but designed with the specific needs of early text preservation in mind. It is intended as a more human-friendly alternative to TEI-XML, which has previously been the standard in this area.

The Markit language already comes with a VSCode extension, which provides syntax highlighting and a live preview. The Early Text Compositor builds on top of this, providing additional features for editing and submitting texts to the corpus.
