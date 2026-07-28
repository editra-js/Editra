# Editra

![npm version](https://img.shields.io/npm/v/editra-js?cacheSeconds=3600)
![npm downloads](https://img.shields.io/npm/dt/editra-js?cacheSeconds=3600)
![npm downloads per week](https://img.shields.io/npm/dw/editra-js?cacheSeconds=3600)
![npm downloads per month](https://img.shields.io/npm/dm/editra-js?cacheSeconds=3600)
![GitHub release](https://img.shields.io/github/v/release/editra-js/editra?sort=semver&cacheSeconds=3600)
![Chromium](https://img.shields.io/badge/chromium-151.0-blue?cacheSeconds=3600)
![Firefox](https://img.shields.io/badge/firefox-153.0-orange?cacheSeconds=3600)
![WebKit](https://img.shields.io/badge/webkit-26.5-green?cacheSeconds=3600)
[![Join Discord](https://img.shields.io/badge/discord-join-blueviolet?cacheSeconds=3600)](https://discord.gg/YOUR_INVITE_CODE)


Editra is a premium open‑source WYSIWYG editor for the web, offering Word‑style text editing, pagination control, tables, media embedding, and export to PDF/Word/HTML. Available via npm or CDN, it delivers enterprise‑grade features with a clean, developer‑friendly API.

Editra is a premium, modular WYSIWYG document editor built with pure HTML, CSS, and JavaScript. Version 2.0.1 is licensed under the MIT License.
Package version: 2.0.1

## Quick start

Serve the project over HTTP:

```powershell
.\start-editra.cmd
```

Then open `http://localhost:8080/examples/full.html`.

Minimal integration:

```html
<div id="editra-editor"></div>
<link rel="stylesheet" href="./themes/premium.css">
<script src="./core/editor.js"></script>
<script>
  Editra.init({ selector: "#editra-editor" });
</script>
```

Do not open the examples with `file://`; browsers block dynamically loaded plugin files for security reasons.

### Package integration

```bash
npm install editra-js
```

```js
import Editra from "editra-js";
import "editra-js/themes/premium.css";

await Editra.init("#editra-editor", { theme: "premium" });
```

The package is published as `editra-js`. A local release archive can be verified with `npm run pack:check`.

### CDN integration

Currently published through the GitHub-backed jsDelivr endpoint:

```html
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/editra-js/Editra@v1.0.0/themes/premium.css">
<script src="https://cdn.jsdelivr.net/gh/editra-js/Editra@v1.0.0/dist/editra.js"></script>
<script>
  Editra.init("#editra-editor", { theme: "premium" });
</script>
```

The npm-backed URLs, available after npm publication, are:

```html
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/editra-js/themes/premium.css">
<script src="https://cdn.jsdelivr.net/npm/editra-js/dist/editra.min.js"></script>
<script>
  Editra.init("#editra-editor", { theme: "premium" });
</script>
```

unpkg alternative:

```html
<script src="https://unpkg.com/editra-js/dist/editra.min.js"></script>
```

These npm CDN paths become valid after `editra-js` is published to the npm registry.

See the [feedback form](examples/feedback-form.html) for localStorage persistence, live HTML/plain-text output, and end-user form integration.

## Project layout

- `core/` — runtime and initialization engine.
- `plugins/` — independently loaded editor features.
- `ui/` — toolbar, menu, icons, and premium UI layer.
- `themes/` — public theme entry points.
- `src/` — distribution metadata and source manifest.
- `docs/` — user, API, help, governance, and roadmap documentation.
- `examples/` — runnable feature demonstrations.
- `tests/automation/` — release and regression checks.

## Documentation

- [User guide](docs/USER_GUIDE.md)
- [Feature guide](docs/FEATURE_GUIDE.md)
- [API reference](docs/API_REFERENCE.md)
- [Help and FAQ](docs/HELP.md)
- [About Editra](docs/ABOUT.md)
- [Contribution guide](docs/CONTRIBUTING.md)
- [Roadmap](docs/ROADMAP.md)
- [Enterprise security](docs/SECURITY.md)
- [Standards and compliance](docs/COMPLIANCE.md)
- [Performance benchmarks](docs/PERFORMANCE.md)
- [Release notes](RELEASE_NOTES.md)

## Testing

```powershell
npm test
npm run security:audit
npm run test:cross-browser
npm run pack:check
```

## License

[MIT License](LICENSE.md)
