# Editra User Guide

Version 1.15.0

## Installation

### npm

The intended public package command is:

```bash
npm install editra
```

Import the ES-module loader and premium theme, then await initialization:

```js
import Editra from "editra";
import "editra/themes/premium.css";

const editor = await Editra.init({
  selector: "#editra-editor",
  theme: "premium"
});
```

The unscoped `editra` name currently belongs to another npm publisher. Until Minsoft obtains that package name, install a locally generated package archive with `npm pack`, or publish this project under a Minsoft-owned scope and replace the import name accordingly.

### CDN

The Minsoft CDN integration is:

```html
<div id="editra-editor"></div>
<link rel="stylesheet"
      href="https://cdn.minsoft.com/editra/latest/themes/premium.css">
<script src="https://cdn.minsoft.com/editra/latest/editra.js"></script>
<script>
  Editra.init({
    selector: "#editra-editor",
    theme: "premium"
  });
</script>
```

The CDN endpoint must serve the complete release tree—`editra.js`, `core/`, `plugins/`, `ui/`, and `themes/`—from the same `latest/` directory. The loader makes `Editra.init()` immediately callable and loads the runtime before initialization.

### Local files

Copy `core/`, `plugins/`, `ui/`, and `themes/` into the same web project. Add one editor host, the premium stylesheet, the core script, and initialization:

```html
<div id="editra-editor"></div>
<link rel="stylesheet" href="./themes/premium.css">
<script src="./core/editor.js"></script>
<script>
  Editra.init({ selector: "#editra-editor" });
</script>
```

Use an HTTP server. From this project run `start-editra.cmd`, then open [the full demo](../examples/full.html). Browsers block dynamic plugin scripts when pages are opened with `file://`.

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

### Page sizes and orientation

Use Layout → Page Size and Orientation or configure `pageSize` and `orientation`. Fifteen standard sizes and custom CSS dimensions are supported. See [page sizes](../examples/page-sizes.html) and [sized editor](../examples/sized-editor.html).

### Headers and footers

Insert reusable text, page numbers, date/time, and custom fields. Tokens include `{{page}}`, `{{pages}}`, `{{date}}`, and custom field names. See [header/footer](../examples/header-footer.html).

### Ruler and margins

View → Show/Hide Ruler displays draggable margins, first-line indent, left indent, and tab stops. Click the track to add a tab; double-click a tab to remove it. See [ruler](../examples/ruler.html) and [margins](../examples/margins.html).

### Tables

Use Insert → Table and drag across the grid. Resize rows/columns with handles. The square upper-left handle selects the complete table; Delete or Backspace then removes it. See [tables](../examples/tables.html).

### Media

Images accept local files, clipboard images, data URLs, and web URLs. Videos accept local files, MP4-style URLs, and supported embeds. Select inserted media to resize it. See [media](../examples/media.html), [image](../examples/image.html), and [video](../examples/video.html).

## Export and print

File → Export PDF uses the browser print dialog. Export Word produces Word-compatible HTML, while Export HTML preserves fixed page sections. Save uses the page-fidelity HTML exporter. “Print text area only” removes unused page height. See [export](../examples/export.html) and [custom print](../examples/custom-print.html).

Use 100% print scale and disable browser-supplied print headers/footers for best fidelity.

## Toolbar feature guide

| Tool | Purpose and usage | Demo |
|---|---|---|
| Bold | Toggle strong emphasis on selected text | [Bold](../examples/bold.html) |
| Italic | Toggle emphasized text | [Italic](../examples/italic.html) |
| Underline | Underline selected text | [Underline](../examples/underline.html) |
| Undo / Redo | Move backward or forward through history | [Shortcuts](../examples/shortcuts.html) |
| Font Family / Size | Choose predefined Word-style fonts and sizes 8–36 | [Formatting](../examples/formatting.html) |
| Heading | Convert blocks semantically to paragraph or H1–H6 | [Headings](../examples/headings.html) |
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
| Table of Contents | Generate navigation from H1–H6 | [Structure](../examples/structure.html) |
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
| Zoom | Change editing zoom | [Premium UI](../examples/premium-ui.html) |
| Fullscreen | Expand the editor | [Premium UI](../examples/premium-ui.html) |
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

### Table

| Item | Purpose | Demo |
|---|---|---|
| Select / Delete Table | Select or remove the complete table | [Tables](../examples/tables.html) |
| Add/Delete Row | Change table height | [Tables](../examples/tables.html) |
| Add/Delete Column | Change table width | [Tables](../examples/tables.html) |

### Format

Font, size, color, highlighter, headings, strikethrough, alignment, line height, lists, indentation, table border color, case change, and remove format control document appearance. See [formatting](../examples/formatting.html), [headings](../examples/headings.html), and [lists](../examples/lists.html).

### Review

Track Changes, Add Comment, Show Comments, Accept All Changes, and Reject All Changes support editorial review. See [collaboration](../examples/collaboration.html).

### Help

Accessibility, About, Documentation, and Shortcuts provide assistance or application-defined help actions. See [help](../examples/help.html) and [about](../examples/about.html).

## Feature configuration examples

```js
Editra.init({
  selector: "#editra-editor",
  pageSize: "A4",
  orientation: "portrait",
  margins: { top: 72, right: 64, bottom: 72, left: 64 },
  header: { text: "Quarterly Report", dateTime: true },
  footer: { pageNumber: "Page {{page}} of {{pages}}" },
  colorScheme: "system",
  sanitizePaste: false
});
```

See the [paste handling demo](../examples/paste.html) for raw and sanitized HTML behavior.

## Troubleshooting

- Serve Editra over HTTP; never use `file://`.
- If `npm install editra` resolves to a different publisher, use the locally packed release or the future Minsoft-scoped package.
- If the Minsoft CDN returns 404, confirm that the release tree and `latest` alias have been provisioned.
- If feedback is not retained, verify that browser storage is enabled and the page is served from the same origin.
- Confirm plugin names and relative paths.
- Use Ctrl/Cmd+V when browser menu paste permission is unavailable.
- Check remote-host embedding policies when media fails.
- Use print scale 100% for page fidelity.
- Call `destroy()` before removing an editor host.
- See [HELP.md](HELP.md) for FAQs and error guidance.
