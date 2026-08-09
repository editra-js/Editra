# Editra User Guide

Version 1.1.1

## Installation

### npm

The intended public package command is:

```bash
npm install editra-js
```

Import the ES-module entry and Word theme, then initialize with a selector and options:

```js
import Editra from "editra-js";
import "editra-js/themes/word.css";

const editor = await Editra.init({
  selector: "#editra-editor",
  theme: "Word",
  plugins: ["formatting", "table", "image"]
});
```

CommonJS projects use the same API:

```js
const Editra = require("editra-js");

const editor = await Editra.init({
  selector: "#editra-editor",
  plugins: ["bold", "italic", "underline"]
});
```

The configuration-object form is the documented initialization pattern. The
legacy positional selector overload remains supported for compatibility.

The package is published under the unscoped `editra-js` name. Install the locally generated package archive when you need a pre-release check, and use `editra-js` in production integrations.

### CDN

The currently published GitHub-backed jsDelivr build is:

```html
<div id="editra-editor"></div>
<link rel="stylesheet"
      href="https://cdn.jsdelivr.net/gh/editra-js/Editra@v1.1.1/themes/word.css">
<script src="https://cdn.jsdelivr.net/gh/editra-js/Editra@v1.1.1/dist/editra.js"></script>
<script>
  await Editra.init({
    selector: "#editra-editor",
    theme: "Word"
  });
</script>
```

After this package is published under the `editra-js` name, jsDelivr usage is:

```html
<div id="editra-editor"></div>
<link rel="stylesheet"
      href="https://cdn.jsdelivr.net/npm/editra-js/themes/word.css">
<script src="https://cdn.jsdelivr.net/npm/editra-js/dist/editra.min.js"></script>
<script>
  await Editra.init({
    selector: "#editra-editor",
    theme: "Word"
  });
</script>
```

The equivalent unpkg links are:

```html
<link rel="stylesheet"
      href="https://unpkg.com/editra-js/themes/word.css">
<script src="https://unpkg.com/editra-js/dist/editra.min.js"></script>
```

Both npm CDNs must serve the complete release treeâ€”`dist/`, `core/`, `plugins/`, `ui/`, and `themes/`. Pin `/editra-js@1.1.1/` instead of `/editra/` when deterministic production builds are required.

### Local files

The planned first-party CDN will serve immutable, versioned assets from
`https://cdn.editra.in`. Until its deployment is verified, use one of the
published endpoints above. Deployment and migration details are documented in
[CDN_MIGRATION.md](CDN_MIGRATION.md).

Copy `core/`, `plugins/`, `ui/`, and `themes/` into the same web project. Add one editor host, the Word stylesheet, the core script, and initialization:

```html
<div id="editra-editor"></div>
<link rel="stylesheet" href="./themes/word.css">
<script src="./core/editor.js"></script>
<script>
  await Editra.init({ selector: "#editra-editor", theme: "Word" });
</script>
```

Use an HTTP server. From this project run `start-editra.cmd`, then open [the full demo](../examples/full.html). Browsers block dynamic plugin scripts when pages are opened with `file://`.

## Themes and editor containers

Choose `Word` for a page-like document editor with page guides, or `Classic`
for a continuous editor layout similar to TinyMCE, Quill, and CKEditor.
Classic mode only introduces a page boundary when the user inserts an
explicit page break.

In the Word theme, users type continuously: when Enter advances the caret past
the writable area of Page 1, the next line begins in the writable area of Page
2. Editra creates this separation only in its rendering layer. `getCode()` and
textarea form submission contain the document's ordinary flowing HTML, without
automatic page wrappers, spacer elements, or page-break tags. Print and PDF
rendering use the calculated page assignment, so the same lines remain on their
respective pages.

Named paper sizes use physical CSS units rather than rounded screen pixels.
For example, A4 is `210mm x 297mm` and Letter is `8.5in x 11in` in both the
editor and its generated print-ready HTML. In the examples, **Get Code** shows
the clean storage HTML while **Get HTML** downloads the paginated standalone
document intended for browser printing. Keep the browser print scale at 100%
and disable browser-added headers and footers for an exact match.

All bundled Word examples explicitly select a standard page size and
orientation. Examples for arbitrary editor dimensions and content-only
printing use the Classic theme because those operations are intentionally not
available in Word mode.

Every automatic Word page is rendered as a complete sheet even when it holds
only one line. Empty space below that line remains part of the page, and all
page guides use the same physical height as the selected print format.

Import `themes/word.css` for Word integrations or `themes/classic.css` for
Classic integrations. Both entry points include Editra's shared controls and
icons.

Runnable examples:

- [Native A4 page flow and print-ready HTML](../examples/native-page-flow.html)
- [Word theme with a div host](../examples/word-theme.html)
- [Word div with modular loading](../examples/word-div-modular.html)
- [Classic theme with a textarea host](../examples/classic-theme.html)
- [Word textarea with modular loading](../examples/word-textarea-modular.html)
- [Classic textarea with single-bundle loading](../examples/classic-textarea-single.html)
- [Modular plugin loading](../examples/modular-loading.html)
- [Plugin marketplace](../examples/plugin-marketplace.html)

```js
await Editra.init({ selector: "#document-editor", theme: "Word" });
await Editra.init({ selector: "#message-editor", theme: "Classic" });
```

Both existing div hosts and textarea form controls work without a separate
container option:

```html
<div id="document-editor"></div>

<form>
  <textarea id="message-editor" name="message"><p>Initial HTML</p></textarea>
  <button type="submit">Save</button>
</form>
```

For textarea hosts, Editra reads the initial value as HTML and keeps the
textarea value synchronized so normal form submission continues to work. A
form reset restores the textarea's default content in the editor. Calling
`editor.destroy()` writes back the latest HTML and restores the textarea. The

## Basic usage

The menu bar groups document commands. The toolbar exposes enabled plugins and wraps when space is limited. Select text before applying inline formatting. Use Ctrl on Windows/Linux or Command on macOS for shortcuts.

- Bold, italic, and underline change selected text.
- Undo and redo restore history snapshots.
- Dropdowns apply fonts, sizes, headings, alignment, and line height.
- Color buttons open native color selectors.
- Insert controls add tables, media, page structure, and emoji.
- The HTML Code button switches between WYSIWYG and highlighted source.

Try [minimal UI](../examples/minimal.html), [hidden menu](../examples/hidden-menu.html), [custom tools](../examples/custom-tools.html), or [keyboard shortcuts](../examples/shortcuts.html).

### Demo integration actions

Every demonstration provides three integration controls:

- **Get Code** displays the current raw editor HTML safely in a code panel.
- **Get HTML** downloads a complete `.html` document containing the current editor HTML.
- **Insert on Focus** restores the last editor selection and inserts text at that cursor position.

The underlying APIs are:

```js
const html = editor.getCode();
const plainText = editor.getText();
editor.insertNode(document.createTextNode("Inserted at cursor position."));
```

### Feedback form and localStorage

The [feedback form demo](../examples/feedback-form.html) collects Name, Gender, and formatted Feedback. It shows live HTML and plain-text output, stores up to 25 submissions in `localStorage`, and restores the latest saved record.

```js
const feedback = {
  name: form.elements.name.value,
  gender: new FormData(form).get("gender"),
  html: editor.getCode(),
  text: editor.getText(),
  savedAt: new Date().toISOString()
};

localStorage.setItem("editra.feedback.v1", JSON.stringify([feedback]));
```

`localStorage` is device- and browser-specific. Use an authenticated server API instead when feedback must be shared, backed up, or centrally managed.

## Advanced usage

### Pagination and flow control

Pagination is enabled by default. Images, videos, charts, graphs, forms, iframes, objects, embeds, and media frames are indivisible: when a block fits on a page but not in the remaining space, Editra moves the complete block to the next page.

```js
const editor = await Editra.init({
  selector: "#editra-editor",
  pagination: {
    keepParagraphsTogether: false,
    keepListItemsTogether: false,
    allowRowSplitting: true,
    keepRowsTogether: false,
    keepTableTogether: false,
    keepCodeBlocksTogether: true,
    repeatTableHeader: true
  }
});
```

Apply rules to the current block or a selected element:

```js
editor.executeCommand("toggleKeepTogether");
editor.executeCommand("KeepWithNext", { enabled: true });
editor.executeCommand("InsertPageBreak");

editor.executeCommand("setListItemSplitting", {
  selector: "#steps",
  allowSplitting: false
});

editor.executeCommand("setTablePagination", {
  selector: "#results",
  allowRowSplitting: true,
  keepRowsTogether: false,
  keepTableTogether: false,
  repeatHeader: true
});

editor.executeCommand("setCodeBlockSplitting", {
  selector: "#sample-code",
  allowSplitting: false
});
```

Tables may flow across pages by default. Use a semantic `<thead>` for the header that should repeat on each exported page. `keepTableTogether` moves a table intact when it fits on one page; tables taller than a page must flow. See [pagination](../examples/pagination.html), [multipage tables](../examples/multipage.html), [media flow](../examples/media.html), [table rules](../examples/tables.html), and [code flow](../examples/code-view.html).

### Page sizes and orientation

Use Layout â†’ Page Size and Orientation or configure `pageSize` and `orientation`. The Word theme enforces fifteen standard physical sizes and does not accept custom width or height overrides. The Classic theme retains flexible CSS dimensions. See [page sizes](../examples/page-sizes.html) and the [custom Classic editor](../examples/sized-editor.html).

### Headers and footers

Insert reusable text, page numbers, date/time, and custom fields. Tokens include `{{page}}`, `{{pages}}`, `{{date}}`, and custom field names. See [header/footer](../examples/header-footer.html).

### Ruler and margins

View â†’ Show/Hide Ruler displays draggable margins, first-line indent, left indent, and tab stops. Click the track to add a tab; double-click a tab to remove it. See [ruler](../examples/ruler.html) and [margins](../examples/margins.html).

### Tables

Use Insert â†’ Table and drag across the grid. Resize rows/columns with handles. The square upper-left handle selects the complete table; Delete or Backspace then removes it. See [tables](../examples/tables.html).

### Media

Images accept local files, clipboard images, data URLs, and web URLs. Videos accept local files, MP4-style URLs, and supported embeds. Select inserted media to resize it. See [media](../examples/media.html), [image](../examples/image.html), and [video](../examples/video.html).

## Export and print

File → Export PDF uses the browser print dialog. Export Word produces Word-compatible HTML, while Export HTML preserves fixed page sections. Save uses the page-fidelity HTML exporter. “Print text area only” removes unused page height. QR codes and barcodes remain resolution-independent SVG, while special characters, Format Painter styles, superscript/subscript, block quotes, and semantic date/time elements remain in HTML and PDF print output. See [export](../examples/export.html) and [custom print](../examples/custom-print.html).

Use 100% print scale and disable browser-supplied print headers/footers for best fidelity.

## Toolbar feature guide

| Tool | Purpose and usage | Demo |
|---|---|---|
| Bold | Toggle strong emphasis on selected text | [Bold](../examples/bold.html) |
| Italic | Toggle emphasized text | [Italic](../examples/italic.html) |
| Underline | Underline selected text | [Underline](../examples/underline.html) |
| Undo / Redo | Move backward or forward through history | [Shortcuts](../examples/shortcuts.html) |
| Font Family / Size | Choose predefined Word-style fonts and sizes 8â€“36 | [Formatting](../examples/formatting.html) |
| Heading | Convert blocks semantically to paragraph or H1â€“H6 | [Headings](../examples/headings.html) |
| Text/Background Color | Apply foreground or background color | [Formatting](../examples/formatting.html) |
| Highlighter | Apply a marker-style background | [Formatting](../examples/formatting.html) |
| Strikethrough | Mark text as struck through | [Formatting](../examples/formatting.html) |
| Alignment | Align blocks left, center, right, or justified | [Formatting](../examples/formatting.html) |
| Line Height | Adjust selected block spacing | [Formatting](../examples/formatting.html) |
| Bullet/Number/Multilevel/TODO Lists | Create and nest list structures | [Lists](../examples/lists.html) |
| Increase/Decrease Indent | Change list or block indentation | [Lists](../examples/lists.html) |
| Table | Open the table-size grid | [Tables](../examples/tables.html) |
| Table Border Color | Change the active table border | [Tables](../examples/tables.html) |
| Image | Insert local, pasted, or URL images | [Image](../examples/image.html) |
| Video | Insert local or URL video | [Video](../examples/video.html) |
| Format Painter | Copy selected text formatting to another selection | [Productivity](../examples/productivity.html) |
| Track Changes | Mark insertions, deletions, and formatting changes | [Collaboration](../examples/collaboration.html) |
| Add Comment | Attach a threaded comment to a selection | [Collaboration](../examples/collaboration.html) |
| Emoji | Open the internal emoji selector | [Structure](../examples/structure.html) |
| Code Block | Insert a preformatted code block | [Structure](../examples/structure.html) |
| Horizontal Line | Insert a document divider | [Structure](../examples/structure.html) |
| Page Break | Lock a page boundary | [Multipage](../examples/multipage.html) |
| Keep Together | Keep the selected block on one page when it fits | [Pagination](../examples/pagination.html) |
| Keep With Next | Keep a heading or block with the following block | [Pagination](../examples/pagination.html) |
| Table of Contents | Generate navigation from H1â€“H6 | [Structure](../examples/structure.html) |
| HTML Code View | Edit highlighted source with line numbers | [Code view](../examples/code-view.html) |

## Menu feature guide

### File

| Item | Purpose | Demo |
|---|---|---|
| New | Clear the document | [Full](../examples/full.html) |
| Open | Open an HTML/text file | [Full](../examples/full.html) |
| Save | Save page-fidelity HTML | [Export](../examples/export.html) |
| Export PDF/Word/HTML/Markdown | Serialize to the chosen format | [Export](../examples/export.html) |
| Import Word/HTML | Import supported document content | [Export](../examples/export.html) |
| Revision History | Compare and restore snapshots | [Collaboration](../examples/collaboration.html) |
| Print | Print full configured pages | [Export](../examples/export.html) |
| Print text area only | Crop printing to document content | [Custom print](../examples/custom-print.html) |

### Styled Word and HTML imports

File **Open**, **Import Word**, and **Import HTML** preserve supported document
appearance as editable, sanitized HTML. DOCX imports retain page sections,
paragraph and run formatting, lists, tables, packaged images, headers, footers,
footnotes, and endnotes where the browser renderer supports them. Safe embedded
HTML styles are resolved in an isolated shadow tree and converted to inline
styles, so the same appearance is retained by HTML, Word, PDF, and print
exports.

Imports fail closed and show a visible message when they contain scripts,
event handlers, forms, frames, active or macro-enabled Word content, embedded
executables, archive traversal, unsafe or external package relationships,
external media, CSS resource loading, fixed/sticky CSS, malformed archives, or
configured size/complexity limit violations. External stylesheets and files
referenced beside a local HTML file cannot be read by the browser; embed safe
CSS and images in the HTML when a self-contained import is required.

Browser HTML rendering and Microsoft Word use different layout engines, so
pixel-identical conversion cannot be guaranteed for every DOCX feature.
Unsupported Word fields, SmartArt, macros, ActiveX, OLE objects, and specialized
font/layout behavior are intentionally not executed or imported.

### Edit

| Item | Purpose | Demo |
|---|---|---|
| Undo / Redo | Navigate history | [Shortcuts](../examples/shortcuts.html) |
| Cut / Copy / Paste | Use browser clipboard operations | [Full](../examples/full.html) |
| Select All | Select document contents | [Shortcuts](../examples/shortcuts.html) |
| Find / Replace | Search with case and whole-word options | [Productivity](../examples/productivity.html) |

### View

| Item | Purpose | Demo |
|---|---|---|
| Zoom | Change editing zoom | [Word theme](../examples/word-theme.html) |
| Fullscreen | Expand the editor | [Word theme](../examples/word-theme.html) |
| Merge fields preview | Resolve placeholder values | [Productivity](../examples/productivity.html) |
| Show Comments | Toggle the comment sidebar | [Collaboration](../examples/collaboration.html) |
| HTML Code / Normal View | Switch source and WYSIWYG modes | [Code view](../examples/code-view.html) |
| Show / Hide Ruler | Toggle the document ruler | [Ruler](../examples/ruler.html) |
| Toggle Theme | Switch light and dark modes | [Theme](../examples/theme.html) |

### Insert

| Item | Purpose | Demo |
|---|---|---|
| Table | Insert a selected grid size | [Tables](../examples/tables.html) |
| Image / Video | Insert and resize media | [Media](../examples/media.html) |
| Link | Link selected content | [Full](../examples/full.html) |
| Comment | Add a selection comment | [Collaboration](../examples/collaboration.html) |
| Merge Field | Insert dynamic `{{Field}}` content | [Productivity](../examples/productivity.html) |
| Header / Footer | Repeat content across pages | [Header/footer](../examples/header-footer.html) |
| Footnote / Bookmark | Add document references | [Structure](../examples/structure.html) |
| Emoji / Special characters | Insert characters | [Structure](../examples/structure.html) |
| Media / Template | Invoke media or template commands | [Full](../examples/full.html) |
| Code block / Horizontal line | Insert structural content | [Structure](../examples/structure.html) |
| Page break | Force a new page | [Multipage](../examples/multipage.html) |
| Table of contents | Generate heading navigation | [Structure](../examples/structure.html) |

### Layout

| Item | Purpose | Demo |
|---|---|---|
| Page Size | Choose a standard page | [Page sizes](../examples/page-sizes.html) |
| Orientation | Switch portrait/landscape | [Page sizes](../examples/page-sizes.html) |
| Margins | Apply normal, narrow, moderate, or wide margins | [Margins](../examples/margins.html) |
| Show / Hide Ruler | Toggle draggable layout controls | [Ruler](../examples/ruler.html) |
| Keep Together | Toggle indivisible flow for the selected block | [Pagination](../examples/pagination.html) |
| Keep With Next | Prevent a break between adjacent blocks | [Pagination](../examples/pagination.html) |
| Insert Page Break | Force subsequent content to the next page | [Pagination](../examples/pagination.html) |

### Table

| Item | Purpose | Demo |
|---|---|---|
| Select / Delete Table | Select or remove the complete table | [Tables](../examples/tables.html) |
| Add/Delete Row | Change table height | [Tables](../examples/tables.html) |
| Add/Delete Column | Change table width | [Tables](../examples/tables.html) |

### Format

Font, size, color, highlighter, headings, strikethrough, alignment, line height, lists, indentation, table border color, case change, and remove format control document appearance. See [formatting](../examples/formatting.html), [headings](../examples/headings.html), and [lists](../examples/lists.html).

The Font Family selector contains more than 20 common document and system
fonts. Text Color and Background Color use a compact Word-style palette,
provide an advanced native chooser, and expose **No Fill** for background and
highlight removal. Repeating bold, italic, underline, or strikethrough removes
the active format. Format Painter captures the selected text's font, size,
color, background, and emphasis, then applies them to the next selection.

### Languages

The Language selector supports English, Hindi, Telugu, Urdu, Arabic, Spanish,
French, German, Portuguese, Chinese, Japanese, and Korean. Urdu and Arabic
automatically use right-to-left direction. Hosts can observe
`onLanguageChange`.

Barcode controls generate validated Code 128, Code 39, and EAN-13 SVG output.
QR controls generate UTF-8, error-corrected SVG matrices. Both retain their
encoded value in document metadata and persist through HTML and PDF rendering.

Images, videos, QR codes, barcodes, emoji, tables, and structural blocks can be
selected as complete objects. Drag media and generated codes directly; drag a
table from its square upper-left selection handle. Page breaks, horizontal
lines, and tables of contents are also movable. A blue line previews the drop
position. Selected objects can be moved to an adjacent position with
Alt+Shift+Arrow. Resizable objects expose corner handles. Selection and drop
outlines are not persisted or exported, and Delete or Backspace removes the
selected object safely.

### Review

Track Changes records insertions, deletions, and formatting proposals. Accept
All keeps inserted text, removes deleted text, and retains proposed formatting;
Reject All removes inserted text, restores deleted text, and discards proposed
formatting. See the [Feature Guide](FEATURE_GUIDE.md) and
[collaboration demo](../examples/collaboration.html).

### Help

Accessibility, About, Documentation, and Shortcut Keys open accessible dialogs with
a clear explanation and direct documentation links. See the
[Feature Guide](FEATURE_GUIDE.md), [help](../examples/help.html), and
[about](../examples/about.html).

## Feature configuration examples

```js
await Editra.init({
  selector: "#editra-editor",
  pageSize: "A4",
  orientation: "portrait",
  margins: { top: 72, right: 64, bottom: 72, left: 64 },
  header: { text: "Quarterly Report", dateTime: true },
  footer: { pageNumber: "Page {{page}} of {{pages}}" },
  colorScheme: "system",
  sanitizePaste: true,
  security: {
    allowIframes: false,
    allowedPluginOrigins: [location.origin],
    maxDocumentBytes: 5 * 1024 * 1024
  }
});
```

All untrusted HTML is sanitized in the enterprise profile. See the [paste handling demo](../examples/paste.html) and [security guide](SECURITY.md).

## Troubleshooting

- Serve Editra over HTTP; never use `file://`.
- If `npm install editra-js` fails, use the locally packed release or confirm the package publication completed.
- If a jsDelivr or unpkg URL returns 404, confirm that the correct Editra package has been published and includes `dist/editra.js`.
- If feedback is not retained, verify that browser storage is enabled and the page is served from the same origin.
- Confirm plugin names and relative paths.
- Use Ctrl/Cmd+V when browser menu paste permission is unavailable.
- Check remote-host embedding policies when media fails.
- Use print scale 100% for page fidelity.
- Call `destroy()` before removing an editor host.
- See [HELP.md](HELP.md) for FAQs and error guidance.
