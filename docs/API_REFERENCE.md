# Editra API Reference

Version 1.15.0

## Initialization

```js
const editor = await Editra.init({
  selector: "#editra-editor",
  plugins: ["bold", "italic", "table"],
  toolbar: "bold italic | table undo redo",
  showMenuBar: true,
  colorScheme: "light"
});
```

`selector` accepts a CSS selector or an HTML element. An empty or omitted `plugins` array enables all plugins. Explicit arrays enable only the named plugins plus required system plugins.

## Configuration

| Option | Type | Default | Purpose |
|---|---|---|---|
| `selector` | string/HTMLElement | required | Editor host |
| `plugins` | string[] | all | Enabled plugins |
| `disabledPlugins` | string[] | `[]` | Explicit exclusions |
| `toolbar` | string | generated | Toolbar layout; `|` separates groups |
| `menu` | object | all menus | Allowed menu names/items |
| `showMenuBar` | boolean | `true` | Show the top menu |
| `theme` | string | `premium` | Theme asset name |
| `colorScheme` | light/dark/system | `light` | UI color mode |
| `editorWidth` | CSS length | `816px` | Custom page width |
| `editorHeight` | CSS length | `1056px` | Custom page height |
| `pageSize` | string | `Letter` | Standard page size |
| `orientation` | portrait/landscape | `portrait` | Page orientation |
| `margins` | object | 72px each | Page margins |
| `header` / `footer` | string/object | none | Repeated page content |
| `printContentOnly` | boolean | `false` | Crop print output to content |
| `sanitizePaste` | boolean | `false` | Remove unsafe pasted elements |
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

## Commands

Call `editor.executeCommand(name, value)`.

Formatting commands include `bold`, `italic`, `underline`, `strikethrough`, `setFontFamily`, `setFontSize`, `setForeColor`, `setBackgroundColor`, `highlightText`, `setHeading`, `setAlignment`, and `setLineHeight`.

Document commands include `undo`, `redo`, `setPageSize`, `setOrientation`, `setCustomPageSize`, `setMargin`, `setIndent`, `setTabStop`, `insertHeader`, `insertFooter`, `insertPageBreak`, `insertHorizontalLine`, `insertTableOfContents`, and `toggleCodeView`.

Table commands include `insertTable`, `selectTable`, `deleteTable`, `mergeCells`, `splitCell`, `addRow`, `deleteRow`, `addColumn`, `deleteColumn`, `setTableBorder`, `setTableBorderColor`, `setCellBackground`, and `setTableAlignment`.

Media commands include `insertImage` and `insertVideo`.

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
  text: "Minsoft",
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

DOM events use the same names prefixed by `editra:`, such as `editra:themeToggle`, `editra:rulerAdjust`, and `editra:pageChange`.

## Plugin registration

Plugins expose a function through `window.EditraPlugins` and register commands during `install(core)`. Every listener or observer must be released through `core.registerCleanup(callback)`.

## Storage

`getCode()` returns persistable HTML. Local files may be represented as object URLs or data URLs depending on plugin options. For durable database storage, extract media through `getMediaData()` and replace temporary object URLs before saving.
