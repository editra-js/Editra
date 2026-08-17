# Editra API Reference

Version 1.0.1

## Pagination

```js
await editor.executeCommand("setPaginationRules", {
  keepParagraphsTogether: false,
  keepListItemsTogether: false,
  allowRowSplitting: true,
  keepRowsTogether: false,
  keepTableTogether: false,
  keepCodeBlocksTogether: true,
  repeatTableHeader: true
});

editor.executeCommand("toggleKeepTogether", options);
editor.executeCommand("setKeepTogether", value);
editor.executeCommand("KeepWithNext", options);
editor.executeCommand("InsertPageBreak");
editor.executeCommand("setListItemSplitting", options);
editor.executeCommand("setTablePagination", options);
editor.executeCommand("setCodeBlockSplitting", options);
editor.executeCommand("reflowPagination");
```

Selector-bearing options are resolved inside the editor surface. Pagination reflow is animation-frame batched and temporary layout spacers are excluded from `getCode()`, `getFormatted()`, and export output.

## Initialization

Package entry (`import Editra from "editra"` or `require("editra")`):

```js
const editor = await Editra.init({
  selector: "#editra-editor",
  theme: "Word",
  plugins: ["formatting", "table", "image"],
  toolbar: "foreColor highlighter | table image | undo redo",
  showMenuBar: true
});
```

Direct `core/editor.js` integrations and existing applications may continue using the configuration-object form:

```js
const editor = await Editra.init({
  selector: "#editra-editor",
  theme: "Word",
  plugins: ["bold", "italic", "table"],
  toolbar: "bold italic | table undo redo",
  showMenuBar: true,
  colorScheme: "light"
});
```

`selector` accepts a CSS selector or an HTML element. The selected host may be
a `<div>` or `<textarea>`. Textarea values are treated as the initial editor
HTML, synchronized after changes, submitted with their containing form, and
restored as a visible textarea when the editor is destroyed. An empty or
omitted `plugins` array enables all plugins. Explicit arrays enable only the
named plugins plus required system plugins.

Layout themes are selected during initialization:

```js
await Editra.init({ selector: "#document-editor", theme: "Word" });
await Editra.init({ selector: "#message-editor", theme: "Classic" });
```

`Word` provides a page-like Word-processing surface with automatic page
guides. `Classic` provides a continuous editor like TinyMCE, Quill, or
CKEditor; it does not automatically paginate content, though explicit page
breaks remain available.

## Configuration

| Option | Type | Default | Purpose |
|---|---|---|---|
| `selector` | string/HTMLElement | required | `<div>` or `<textarea>` editor host |
| `plugins` | string[] | all | Enabled plugins |
| `communityPlugins` | object[] | `[]` | Validated sandbox plugin manifests installed during initialization |
| `disabledPlugins` | string[] | `[]` | Explicit exclusions |
| `toolbar` | string | generated | Toolbar layout; `|` separates groups |
| `menu` | object | all menus | Allowed menu names/items |
| `showMenuBar` | boolean | `true` | Show the top menu |
| `theme` | `Word`/`Classic` | `Word` | Page-like or continuous editor layout |
| `colorScheme` | light/dark/system | `light` | UI color mode |
| `editorWidth` | CSS length | `8.5in` | Custom surface width in Classic; ignored in Word |
| `editorHeight` | CSS length | `11in` | Custom surface height in Classic; ignored in Word |
| `editorHeightFixed` | boolean | inferred | Classic only: preserve an explicitly configured height while page-size changes adjust proportional width |
| `pageSize` | string | `Letter` | Standard page size |
| `orientation` | portrait/landscape | `portrait` | Page orientation |
| `margins` | object | 72px each | Page margins |
| `header` / `footer` | string/object | none | Repeated page content |
| `printContentOnly` | boolean | `false` | Crop print output to content |
| `sanitizePaste` | boolean | `true` | Sanitize pasted HTML; enterprise security cannot be bypassed through this flag |
| `regulated` | boolean | `false` | Enable the locked regulated security profile |
| `security.profile` | `standard`/`regulated` | `standard` | Named security profile; `regulated` is equivalent to `regulated: true` |
| `security.pluginIntegrity` | object | `{}` | SHA-256 SRI map keyed by runtime-relative asset path; mandatory in regulated mode |
| `security.allowedUrlOrigins` | string[] | `[]` | External content/link origins explicitly approved in regulated mode |
| `security.allowedConnectionOrigins` | string[] | `[]` | External WebSocket origins explicitly approved in regulated mode |
| `security.allowedExternalProtocols` | string[] | `[]` | Optional `mailto:`/`tel:` protocols approved in regulated mode |
| `historyLimit` | number | `100` | Maximum undo snapshots |

## Content methods

| Method | Result |
|---|---|
| `getCode()` | Raw document HTML |
| `getText()` | Plain text |
| `getFormatted()` | Normalized cloned DOM |
| `setCode(html)` | Set raw HTML |
| `getMediaData()` | Image/video storage metadata |
| `focus()` | Focus the editor |
| `destroy()` | Remove listeners, observers, UI, and object URLs |
| `sanitizeHTML(html)` | Sanitize untrusted HTML with the active enterprise policy |
| `secureRequest(url, options)` | Make an origin-checked request with CSRF enforcement |
| `installCommunityPlugin(manifest)` | Validate and install a sandboxed community plugin; unavailable in regulated mode |
| `uninstallCommunityPlugin(id)` | Remove a community plugin iframe and capabilities |
| `getInstalledCommunityPlugins()` | Return frozen validated manifest data |
| `checkCommunityPluginUpdates(url)` | Compare installed versions with a registry |

## Commands

Call `editor.executeCommand(name, value)`.

Formatting commands include `bold`, `italic`, `underline`, `strikethrough`, `setFontFamily`, `setFontSize`, `setForeColor`, `setBackgroundColor`, `highlightText`, `setHeading`, `setAlignment`, and `setLineHeight`.

Document commands include `undo`, `redo`, `setPageSize`, `setOrientation`, `setCustomPageSize`, `setMargin`, `setIndent`, `setTabStop`, `insertHeader`, `insertFooter`, `insertPageBreak`, `insertHorizontalLine`, `insertTableOfContents`, and `toggleCodeView`.

Table commands include `insertTable`, `selectTable`, `deleteTable`, `mergeCells`, `splitCell`, `addRow`, `deleteRow`, `addColumn`, `deleteColumn`, `setTableBorder`, `setTableBorderColor`, `setCellBackground`, and `setTableAlignment`.

Media commands include `insertImage` and `insertVideo`.

Language commands:

```js
editor.executeCommand("setLanguage", "ur");
const languages = await editor.executeCommand("getLanguages");
```

Code commands are `insertBarcode({ value, format })` and
`insertQrCode({ value })`. Barcode formats are `CODE128`, `CODE39`, and
`EAN13`. Generated SVG markup retains encoded values in `data-editra-*`
attributes for persistence.

Object selection commands are `selectObject(element)` and
`deleteSelectedObject`. Pressing Delete or Backspace invokes the same deletion
behavior for selected media, tables, and non-editable structural objects.

Productivity commands include `findReplace`, `formatPainter`, `insertMergeField`, `previewMergeFields`, `exportPDF`, `exportWord`, `exportHTML`, `exportMarkdown`, `importWord`, `importHTML`, and `printContentOnly`.

Collaboration commands include `trackChanges`, `addComment`, `showComments`, `replyComment`, `resolveComment`, `viewRevisionHistory`, `restoreRevision`, `connectCollaboration`, and `disconnectCollaboration`.

Theme commands:

```js
editor.executeCommand("toggleTheme");
editor.executeCommand("setTheme", "dark");
editor.executeCommand("setTheme", "system");
```

## Page examples

```js
editor.executeCommand("setPageSize", {
  size: "A4",
  orientation: "landscape"
});

editor.executeCommand("setMargin", {
  top: 72,
  right: 64,
  bottom: 72,
  left: 64
});

editor.executeCommand("insertFooter", {
  text: "Editra",
  pageNumber: "Page {{page}} of {{pages}}",
  dateTime: true,
  fields: { Department: "Editorial" }
});
```

## Events and callbacks

The corresponding configuration callback receives an event detail object.

| Callback | Purpose |
|---|---|
| `onChange` | Document HTML/text changed |
| `onPaste` | Intercept or modify pasted data |
| `onCommand` | Command completed |
| `onFocus` / `onBlur` | Editor focus state |
| `onStateChange` | Formatting and plugin state |
| `onMenuToggle` | Menu visibility changed |
| `onToolbarBuild` | Toolbar rendered |
| `onRulerAdjust` | Margin, indent, or tab stop changed |
| `onPageChange` | Page count, size, orientation, or margins changed |
| `onThemeToggle` | Theme mode applied and menus refreshed |
| `onLanguageChange` | Document language or text direction changed |
| `onSecurityViolation` | Size, rate, URL, plugin, or policy violation detected |

DOM events use the same names prefixed by `editra:`, such as `editra:themeToggle`, `editra:rulerAdjust`, and `editra:pageChange`.

## Plugin registration

Plugins expose a function through `window.EditraPlugins` and register commands during `install(core)`. Every listener or observer must be released through `core.registerCleanup(callback)`.

This direct lifecycle is restricted to reviewed built-in plugins. Community
plugins use validated registry manifests and the sandbox capability protocol;
they never receive `core`. See the
[plugin developer guide](PLUGIN_DEVELOPER_GUIDE.md).

## Storage

`getCode()` returns persistable HTML. Local files may be represented as object URLs or data URLs depending on plugin options. For durable database storage, extract media through `getMediaData()` and replace temporary object URLs before saving.

## Toolbar icon assets

Toolbar icons are served as same-origin SVG images from `assets/icons/`.
Use `iconBaseUrl` when Editra's assets are hosted at a custom path:

```js
await Editra.init({
  selector: "#editra-editor",
  iconBaseUrl: "/static/editra/icons/"
});
```

Export commands accept non-interactive options for automated validation:

```js
const html = await editor.executeCommand("exportHTML", {
  download: false,
  returnHTML: true
});
const pdf = await editor.executeCommand("exportPDF", {
  print: false,
  returnHTML: true
});
```
## Isolated iframe mode

Set `isolation: "iframe"` and an `isolationUrl` to receive an asynchronous editor proxy instead of an in-document editor instance. Regulated mode requires the frame to use a separate origin. The proxy exposes asynchronous `getCode`, `getHTML`, `getText`, `getState`, `getJSON`, `validateJSON`, `setCode`, `setHTML`, `setJSON`, `focus`, `executeCommand`, and `destroy` operations. Deployment and sandbox requirements are documented in [SECURITY.md](./SECURITY.md#separate-origin-isolation).

## Structured document methods

- `getJSON()` returns the deterministic Editra document model.
- `validateJSON(value)` returns `{ valid, errors }` without changing content.
- `setJSON(value)` validates, sanitizes, and replaces the current content; invalid documents throw `TypeError`.

The root schema identity is `https://editra.in/schema/document/v1`, version `1.0.0`. Unknown node types, unsupported elements and attributes, excessive depth, excessive nodes, and oversized text are rejected. JSON imports pass through the same stable sanitizer as HTML imports. See [EDITRA-DOCUMENT-SCHEMA.json](./EDITRA-DOCUMENT-SCHEMA.json).
