# Editra Plugin Developer Guide

## Loading models

Editra supports two compatible delivery models:

- The existing `dist/editra.js` entry is the simple application entry. Omitting
  `plugins` retains the complete built-in experience.
- `dist/editra-core.js` and `dist/editra-core.css` provide the modular entry.
  Only declared built-in plugin styles are fetched, and lazy plugin JavaScript
  is fetched when its command is first used.

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

See the [single-entry example](../examples/full.html),
[Word modular div example](../examples/word-div-modular.html), and
[general modular example](../examples/modular-loading.html).

## Editor hosts

Plugins use the editor API identically whether initialization targets a
`<div>` or `<textarea>`; plugin code must not query or replace the original
host. Test both forms. A textarea's initial value is sanitized into the editor
surface and synchronized back for form submission.

```html
<link rel="stylesheet" href="/editra/themes/classic.css">
<div id="document-editor"></div>
<script src="/editra/dist/editra.js"></script>
<script>
  Editra.init({
    selector: "#document-editor",
    theme: "Classic",
    plugins: ["formatting", "table"]
  });
</script>
```

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

These examples cover both themes and both host types. Runnable versions are the
[Word modular div](../examples/word-div-modular.html),
[Word modular textarea](../examples/word-textarea-modular.html) and
[Classic single-bundle textarea](../examples/classic-textarea-single.html).

## Reviewed built-in plugin API

Built-in plugins live in `plugins/<id>.js`, optionally accompanied by
`plugins/<id>.css`. They register a function in `window.EditraPlugins`.

```js
(function (global) {
  "use strict";
  const installations = new WeakMap();

  function install(core) {
    if (installations.has(core)) return installations.get(core);
    const remove = core.registerCommand("exampleCommand", () => true, {
      plugin: "example",
      source: "plugin"
    });
    const state = { remove };
    core.registerCleanup(() => {
      remove();
      installations.delete(core);
    });
    installations.set(core, state);
    return state;
  }

  function ExamplePlugin(core) {
    install(core);
    return true;
  }
  ExamplePlugin.install = install;
  ExamplePlugin.hydrate = install;
  ExamplePlugin.plugin = Object.freeze({
    name: "example",
    label: "Example",
    command: "exampleCommand"
  });
  (global.EditraPlugins ??= Object.create(null)).example = ExamplePlugin;
})(window);
```

Lifecycle hooks:

- `install(core)` registers commands and listeners once per editor.
- `hydrate(core, surface)` reconnects behavior after persisted HTML is loaded.
- `core.registerCleanup(callback)` is mandatory for listeners, observers,
  object URLs, overlays, and other retained resources.
- `destroy()` invokes registered cleanup callbacks.

Useful reviewed APIs include `registerCommand`, `sanitizeHTML`,
`secureRequest`, `executeCommand`, `recordHistory`, `emitChange`, `announce`,
and `registerCleanup`. Built-ins have internal access and therefore require
maintainer review and release signing.

## Sandboxed community plugin API

Community code does not receive `core`. It runs in an iframe with
`sandbox="allow-scripts"` and communicates using structured messages. A plugin
first sends:

```js
parent.postMessage({
  source: "editra-plugin",
  pluginId: "my-plugin",
  type: "ready"
}, "*");
```

The host responds with an API version and validated manifest. Requests use a
unique `requestId`, a declared capability, and structured-cloneable payload.
Available capabilities are:

| Capability | Result |
|---|---|
| `document.readText` | Current plain text |
| `document.readHTML` | Sanitized serialized HTML |
| `commands.execute` | Executes only commands listed in `allowedCommands` |
| `ui.notify` | Announces a bounded text message and emits a host event |

Responses have `source: "editra-host"`, the same `pluginId` and `requestId`,
and either `result` or `error`. The host verifies the message source against
the installed iframe. DOM nodes, functions, editor internals, credentials, and
arbitrary network access are never exposed through the capability API.

Install a validated manifest with:

```js
await editor.installCommunityPlugin(manifest);
const installed = await editor.getInstalledCommunityPlugins();
const updates = await editor.checkCommunityPluginUpdates("/plugins/registry.json");
await editor.uninstallCommunityPlugin(manifest.id);
```

See `community/spell-checker/` for a complete example.

## Versioning

Plugin versions use semantic versioning. `compatibility` currently uses the
strict form `>=MAJOR.MINOR.PATCH`. Breaking capability or lifecycle changes
increment the relevant major version. Registry entries use immutable,
versioned asset URLs in production. Update checks compare installed versions
with the reviewed registry; applications decide when to install an update.
