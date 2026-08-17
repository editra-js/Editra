# Editra Feature Guide

## Plugin delivery and ecosystem

Applications may retain the existing single-entry loader or use the modular
core distribution with an explicit plugin list. Formatting, table, and image
styles have separate plugin entry points, and lazy JavaScript loads when its
command is used. Reviewed built-ins retain the established UI and lifecycle.
Community extensions use the registry, semantic compatibility metadata,
SHA-256 entry verification, and sandbox capability API. Browse the
[marketplace](../examples/plugin-marketplace.html) or see the
[developer guide](PLUGIN_DEVELOPER_GUIDE.md).

## Editing and formatting

| Feature | Purpose | Expected behavior |
|---|---|---|
| Bold, italic, underline, strikethrough | Emphasize selected text | Repeating the command toggles the format |
| Font family and size | Apply a predefined, portable font style | Sizes are limited to 8-36 px; rapid duplicate selections are coalesced |
| Text and background color | Apply predefined colors | Toolbar and menu use the same choices |
| Headings H1-H6 | Create semantic document structure | The selected block becomes the chosen heading tag |
| Alignment and line height | Control paragraph presentation | Applies to the current or selected blocks |
| Remove format | Remove inline presentation | Document text and semantic structure remain |

The font menu offers more than 20 popular families. The compact color grids
share options between menus and toolbar controls; background/highlighter
pickers include **No Fill** plus an advanced color chooser. Format Painter is a
one-shot tool: select formatted source text, activate it, then select the
target. Escape cancels it.

**Code Block** is available from Insert, Format, and configured toolbars.
Choose plain text or a language presentation mode, then use **Code Block
Background** to apply any palette or custom color. Text contrast adjusts for
light and dark backgrounds, and the selected mode and color persist in exports.

## Lists and indentation

Bullet List and Number List convert the selected blocks into `<ul>` and `<ol>`
content. Repeating the active list command unwraps the list back into paragraphs.
Choosing the other list type converts the existing list without duplicating its
items. Each main button has a separate Word-style gallery: bullets include
circle, square, dash, arrow, check, diamond, and no-marker choices; numbering
includes decimal, leading-zero, letters, Roman numerals, Greek, and Arabic-Indic.
Changing a gallery choice never unwraps the list. Multilevel List and indent
commands change nesting; TODO List creates interactive checkbox items.

## Tables

**Insert Table** is available from both the configured toolbar and the Table or
Insert menu when the table plugin is enabled. Select, delete, add-row,
delete-row, add-column, delete-column, and border controls remain hidden until
the document contains a table. The corner handle selects a complete table, and
Delete or Backspace removes that selected table.

## Media and structure

Image and Video accept local files or permitted URLs and provide resize handles.
Remote HTTPS images load eagerly so delayed viewport entry cannot trigger a
layout reset. Click a media frame, table, or selectable structure to select it
as an object; Delete or Backspace removes it without resetting the document.
Emoji opens beside its triggering control and closes with its close button,
Escape, an outside click, or when editing resumes. Page Break, Horizontal Line,
Code Block, and Table of Contents create structural document elements.

## Codes and movable objects

Barcode supports Code 128, Code 39, and EAN-13 with validation and automatic
EAN check digits. QR codes use a UTF-8 JavaScript encoder and error-corrected
SVG matrices. Generated codes persist in document HTML and exports. Images,
barcodes, QR codes, and emoji can be selected, moved, and removed; resizable
objects expose corner handles.

## Languages

The built-in selector includes English, Hindi, Telugu, Urdu, Arabic, Spanish,
French, German, Portuguese, Chinese, Japanese, and Korean. Applying Urdu or
Arabic changes the document to RTL; other built-ins use LTR. Language and
direction are reflected in the editor's `lang` and `dir` attributes.

## Page layout

Page Size supports A3, A4, A5, B4, B5, Letter, Legal, Executive, Tabloid,
Ledger, Statement, Folio, Quarto, 10x14, and C5 Envelope formats in portrait or
landscape orientation.

- In the Word theme, changing size updates both dimensions to the selected
  standard. Custom `editorWidth`, `editorHeight`, and `setCustomPageSize`
  values are not applied; orientation only swaps the standard dimensions.
- In the Classic theme, `editorWidth` and `editorHeight` remain flexible. When
  height is explicitly configured, page-size commands preserve it and
  calculate a proportional width unless `editorHeightFixed: false` is used.
- Page-size state is used by page guides, print, HTML, Word, and PDF export.

Margins, ruler markers, headers, footers, pagination rules, Keep Together, and
Keep With Next affect the saved and exported page model.

## Track Changes workflow

1. Choose **Review -> Track Changes** to start or stop recording edits.
2. New text is marked as an insertion, removed text is retained as a visible
   deletion, and changed formatting is marked as a formatting revision.
3. Review the colored inline revisions before finalizing the document.
4. **Accept All Changes** keeps inserted text, permanently removes deleted
   text, and retains accepted formatting while removing revision markers.
5. **Reject All Changes** removes inserted text, restores deleted text, and
   removes proposed formatting.

Accept and Reject are finalization operations for every unresolved tracked
change in the current document. Use Revision History before finalizing if a
restorable checkpoint is required.

## Comments, revisions, and collaboration

Comments attach a thread to selected text and support replies and resolution.
Show Comments opens the comment interface. Revision History lists restorable
snapshots. Collaboration transports synchronize block operations and remote
cursors; the host application remains responsible for authentication,
authorization, persistence, and transport security.

## Find, merge fields, import, and export

Find/Replace supports case-sensitive and whole-word searches. Merge Fields
insert placeholders and can be previewed with supplied values. Import accepts
HTML and supported Word content. Export produces page-aware HTML, Word, and PDF
representations; Markdown is available through the productivity plugin.

## Code view and paste

Code View switches between syntax-highlighted source and WYSIWYG content.
Paste preserves allowed formatting while the enterprise sanitizer removes
unsafe markup. `getCode()`, `getText()`, `getFormatted()`, and `setCode()` expose
the document to host applications.

## Help menu

- **Accessibility** explains keyboard, focus, screen-reader, RTL, and compliance
  support.
- **About** identifies Editra and its MIT licensing.
- **Documentation** links to the user guide and API reference.
- **Shortcut Keys** lists every enabled Word-like keyboard command, native
  clipboard shortcut, object deletion key, and table-navigation key.

Each Help item opens an accessible, dismissible dialog near its menu item and
provides direct links to the corresponding documentation.
