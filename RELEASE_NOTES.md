# Editra Release Notes

## Version 1.16.0

Release date: 2026-07-26

### Features added

- Added page-aware automatic flow for indivisible media, charts, forms, embeds, and explicitly kept blocks.
- Added paragraph, list-item, table-row, complete-table, and code-block splitting policies.
- Added `InsertPageBreak`, `KeepWithNext`, `toggleKeepTogether`, and pagination configuration commands.
- Added multi-page table export segmentation with repeated semantic header rows.
- Added a dedicated pagination demonstration and pagination behavior throughout all example pages.
- Added the neutral Editra CDN integration at `https://cdn.editra.org/latest/editra.js`.

### Bugs fixed

- Explicit page breaks now consume the remaining page space and force subsequent content onto the next page.
- Temporary pagination spacers are excluded from saved and exported document HTML.
- Large pagination passes are processed in animation-frame batches.
- Removed former company branding from source headers, documentation, examples, package metadata, and repository files.

### Known issues

- Extremely tall indivisible blocks that exceed one configured page remain scrollable because they cannot fit intact on any page.
- Browser print engines can make small font-metric adjustments that affect the final row distribution.
- The unscoped npm package name `editra` remains owned by another publisher.
- The `cdn.editra.org` endpoint must be provisioned with the packaged release tree before public use.

See [docs/USER_GUIDE.md](docs/USER_GUIDE.md) for pagination configuration and distribution guidance.

## Version 1.15.0

Release date: 2026-07-26

### Features added

- Added shared Get Code, Get HTML, and Insert on Focus actions to every demonstration.
- Added a responsive feedback form that stores name, gender, rich HTML, and plain text in localStorage.
- Added live HTML and plain-text feedback previews plus saved-record rendering.
- Added npm package metadata, a browser distribution loader, and an ES-module loader.
- Added documented npm and CDN integration paths.
- Added automated distribution, demo, package-content, and premium-style checks.

### Bugs fixed

- Removed rounding from the outer editor and editable surface for a flat formal appearance.
- Standardized editor and code-view selection colors to Word-style blue with white text.
- Prevented raw HTML demo output from being interpreted as executable page markup.

### Known issues

- The unscoped npm name `editra` is owned by an existing package and requires registry ownership or a new scoped package name.
- GitHub publication requires a target repository/account and authenticated GitHub tooling.
- The configured CDN endpoint must serve the packaged release assets.

See [docs/USER_GUIDE.md](docs/USER_GUIDE.md) for version 1.15.0 integration and demo guidance.

## Version 1.14.0

Release date: 2026-07-26

### Features added

- Complete modular editor initialization with lazy plugin loading.
- Dynamic toolbar and menu configuration.
- Tables with grid insertion, resizing, cell operations, selection, and deletion.
- Local, clipboard, URL image insertion and resizable media.
- Local and URL video insertion with inline playback.
- Productivity tools, collaboration foundations, formatting, lists, code view, and paste controls.
- Word-like page sizes, orientation, margins, headers, footers, ruler, page guides, and keyboard shortcuts.
- Page-fidelity HTML, Word, and PDF print exports.
- Consistent light, dark, and system theme modes.
- Documentation, API reference, help, governance, examples, and automated release checks.

### Bugs fixed

- Corrected local `file://` module-loading guidance by providing a local HTTP server.
- Corrected YouTube embedding URL handling and player configuration behavior.
- Fixed toolbar wrapping, menu contrast, dark-theme dialog visibility, and page border styling.
- Fixed live ruler dragging, pointer cancellation, margin persistence, tab-stop export, and cleanup.
- Fixed whole-table Delete/Backspace behavior.

### Known issues

- Browser security prevents programmatic clipboard paste without user permission.
- PDF results can vary slightly with browser print settings, installed fonts, and printer drivers.
- Word HTML import/export fidelity depends on the Microsoft Word rendering engine.
- Real-time collaboration requires an application-provided transport and persistence service.
- Remote media availability and embedding policies are controlled by the media host.

See [docs/USER_GUIDE.md](docs/USER_GUIDE.md) for version 1.14.0 feature instructions and demonstrations.
