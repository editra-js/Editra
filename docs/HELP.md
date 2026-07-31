# Editra Help

## Frequently asked questions

### Initialization Pattern

Use one configuration object with `selector`, `theme`, and an explicit plugin
list. The recommended modular pattern with a Word-theme `<div>` is:

```html
<link rel="stylesheet" href="/editra/dist/editra-core.css">
<div id="editor"></div>
<script src="/editra/dist/editra-core.js"></script>
<script>
  Editra.init({
    selector: "#editor",
    theme: "Word",
    plugins: ["formatting", "table", "image"]
  });
</script>
```

The optional single-bundle pattern with a Classic-theme `<textarea>` is:

```html
<link rel="stylesheet" href="/editra/themes/classic.css">
<textarea id="editor"></textarea>
<script src="/editra/dist/editra.js"></script>
<script>
  Editra.init({
    selector: "#editor",
    theme: "Classic",
    plugins: ["formatting", "table"]
  });
</script>
```

`Word` supplies the modern page-like document experience with automatic page
guides. `Classic` supplies a continuous editor without automatic page numbers;
explicit page breaks remain available. Both themes support both host types.
See the tested [Word modular div](../examples/word-div-modular.html) and
[Classic single-bundle textarea](../examples/classic-textarea-single.html)
examples.

### Using Editra with `<textarea>`

Textarea hosts use their current value as initial HTML and remain synchronized
for normal form submission. This is the Word theme with modular loading:

```html
<link rel="stylesheet" href="/editra/dist/editra-core.css">
<textarea id="editor"></textarea>
<script src="/editra/dist/editra-core.js"></script>
<script>
  Editra.init({
    selector: "#editor",
    theme: "Word",
    plugins: ["formatting", "table", "image"]
  });
</script>
```

This is the Classic theme with the established single-bundle entry:

```html
<link rel="stylesheet" href="/editra/themes/classic.css">
<textarea id="editor"></textarea>
<script src="/editra/dist/editra.js"></script>
<script>
  Editra.init({
    selector: "#editor",
    theme: "Classic",
    plugins: ["formatting", "table"]
  });
</script>
```

See the runnable [Word modular textarea](../examples/word-textarea-modular.html)
and [Classic single-bundle textarea](../examples/classic-textarea-single.html)
examples. Existing `<div>` hosts continue to work unchanged.

### Plugin Loading Modes

Use the existing `dist/editra.js` entry for the simplest single-bundle
integration and omit `plugins` to retain all built-in functionality. Use
`dist/editra-core.js` plus
`dist/editra-core.css` for modular delivery, then declare only the plugins the
editor may load. Modular loading is the recommended production mode when a
smaller initial payload is useful; lazy JavaScript is downloaded on first
command use. See the
[modular loading example](../examples/modular-loading.html).

### Plugin Ecosystem

Browse reviewed entries in the
[plugin marketplace](../examples/plugin-marketplace.html). Developers can use
the [plugin developer guide](PLUGIN_DEVELOPER_GUIDE.md), submit a focused pull
request, and follow the registry and security checklists. Built-ins run as
reviewed application modules; community plugins run in sandboxed iframes with
manifest-approved capabilities. Installation and updates are explicit.

### Why does Editra fail when opened with `file://`?

Plugins are loaded dynamically. Modern browsers block those requests from a local-file origin. Run `start-editra.cmd` and use `http://localhost:8080`.

### Why will Paste not run from a menu click?

Browsers require clipboard permission and usually require a direct keyboard or pointer action. Use Ctrl/Cmd+V. The `onPaste` hook can inspect or replace pasted content.

### Why does a remote video fail?

The host may prohibit embedding. For YouTube, insert the normal watch URL and let the video plugin convert it. Error 153 generally indicates missing or rejected embed-client identification by the host.

### Why does exported pagination differ?

Keep browser print scaling at 100%, disable extra browser headers/footers, and ensure the same fonts are installed. Word and printer engines can have small metric differences.

### How do I recover content?

Use Ctrl/Cmd+Z or Edit → Undo. Applications should also persist `getCode()` regularly.

## Common errors

- `CORS policy` or origin `null`: serve over HTTP.
- `Unknown Editra plugin`: check spelling and use a documented plugin name.
- Missing toolbar control: include its plugin or let Editra infer plugins from `toolbar`.
- Plugin integrity failed: refresh the reviewed registry and verify the entry asset was not modified.
- Plugin capability denied: add only the capability required by the reviewed manifest.
- Clipboard permission denied: use the operating-system paste shortcut.
- Media does not play: confirm the URL is public, HTTPS, and embeddable.

## Keyboard shortcuts

| Action | Windows/Linux | macOS |
|---|---|---|
| Bold | Ctrl+B | Cmd+B |
| Italic | Ctrl+I | Cmd+I |
| Underline | Ctrl+U | Cmd+U |
| Undo | Ctrl+Z | Cmd+Z |
| Redo | Ctrl+Y / Ctrl+Shift+Z | Cmd+Shift+Z |
| Save | Ctrl+S | Cmd+S |
| Select all | Ctrl+A | Cmd+A |
| Find/replace | Ctrl+F | Cmd+F |
| Insert link | Ctrl+K | Cmd+K |
| Print | Ctrl+P | Cmd+P |
| Numbered list | Ctrl+Shift+7 | Cmd+Shift+7 |
| Bulleted list | Ctrl+Shift+8 | Cmd+Shift+8 |
| Copy / Cut / Paste | Ctrl+C / X / V | Cmd+C / X / V |
| Move through table | Tab / Shift+Tab | Tab / Shift+Tab |
| Delete selected object or table | Delete / Backspace | Delete / Backspace |

The configurable **Help → Shortcut Keys** dialog presents this reference inside
the editor and uses the same command registry as the keyboard handler.

## Support

For support, open an issue in the project repository with the Editra version, browser version, minimal initialization configuration, reproduction steps, and console output.
