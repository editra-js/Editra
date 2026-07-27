Version: 2.0.0
# Editra Release Notes

## Version 2.0.0

Release date: 2026-07-27

### Step 24 QR and barcode removal

- Deprecated and removed QR and barcode toolbar/menu controls, commands,
  render-span interpretation, export generation, plugin code, icons, vendor
  runtimes, package dependencies, and related documentation.
- Removed all special handling for former `.render-mode` and `data-render`
  markup without changing generic spans or other formatting markup.
- Confirmed that no other editor tools, layouts, styling, or behaviors were
  modified by this removal.

### Step 23 stability restoration

- Reverted the Step 22 font-family experiment and removed its barcode fonts,
  pseudo-font sizing, resize overlay, and layout-affecting styles.
- Restored the Step 21 `.render-mode` plus `data-render` contract, badge
  styling, toggle behavior, lazy QR/CODE128 export pipeline, and toolbar/menu
  commands.
- Confirmed placeholders and normal text remain intact until the server or
  cloned export renderer interprets them.

### Step 21 rendering and editing improvements

- Added lazy, client-side QR Code and CODE128 Barcode render modes for selected
  text, with metadata-only storage and clone-only conversion during
  HTML/Word/PDF/print export.
- Added packaged QRCode and JsBarcode runtimes with exact dependency pins and
  third-party license inventory.
- Added object selection and Delete/Backspace removal for images, videos,
  tables, and non-editable structure elements.
- Changed remote HTTPS images to eager loading and stabilized their reserved
  layout space so scrolling does not reset editor state.
- Expanded the font selector to 23 families and added 12 document-language
  choices, including Hindi, Telugu, Urdu, and Arabic with RTL behavior.
- Added QR, Barcode, Language, and Format Painter UI integration, Word-style
  color grids with advanced choice and No Fill, arrow table-grid cursors, and
  consistent toggle behavior for core emphasis commands.

### Enterprise security hardening

- Added mandatory DOMPurify sanitization across initialization, paste, imports, source view, collaboration, revision previews, headers/footers, serialization, and export.
- Added Trusted Types and strict CSP compatibility, safe URL policy, deny-by-default iframe embeds, sandboxed print frames, and removal of `document.write`.
- Added byte, DOM-node, recursion-depth, media, command-rate, history, and plugin-origin limits.
- Added same-origin secure requests with required CSRF tokens for state-changing methods.
- Added plugin origin allowlisting, optional mandatory SRI, CSP nonces, and a no-eval policy.
- Added language packs, `lang`, RTL direction, translated toolbar/menu labels, and screen-reader command announcements.
- Replaced Jest with Node's built-in test runner after dependency audit findings.
- Exact-pinned DOMPurify, Webpack, Webpack CLI, and Playwright; the resulting npm audit reports zero known vulnerabilities.
- Added Chrome/Edge local security verification plus Chromium/Firefox/WebKit CI coverage.
- Added CodeQL, dependency review, npm audit, package inspection, security documentation, compliance mapping, and benchmark guidance.

### Toolbar and regression fixes

- Restored toolbar icons under strict Trusted Types by replacing sanitized
  inline SVG fragments with packaged, same-origin SVG image assets.
- Removed duplicate `editra-loader` Trusted Types policy creation during lazy
  plugin loading.
- Added a DOM formatting fallback for bold, italic, underline, and
  strikethrough when a browser reports no `execCommand` mutation.
- Added automated 404, CSP, toolbar action, table/media plugin, export, keyboard
  focus, ARIA label, lifecycle, and large-document browser checks.

### Metadata and UX consistency fixes

- Rebuilt `index.html` as a complete UTF-8-without-BOM document with an early
  charset declaration and the exact `Full Editra` title.
- Corrected bullet and number list toggle behavior and coalesced rapid duplicate
  font-size commands.
- Filtered menus by active plugins and made table row/column actions contextual
  to documents that contain a table.
- Added direct Insert Table access, anchored popup placement, outside/typing
  dismissal for Emoji, and accessible Help dialogs with documentation links.
- Defined fixed-height page-size switching and corrected Accept/Reject behavior
  for formatting revisions.
- Added a feature guide covering layout, menus, contextual tools, Help, and the
  complete Track Changes workflow.

### Security behavior changes

- `sanitizePaste` now defaults to `true`; the enterprise security layer cannot be bypassed by setting it to `false`.
- Iframes and hosted video players are denied until `security.allowIframes` and exact `allowedIframeHosts` are configured.
- `file:` media URLs are rejected.
- Local media larger than 10 MiB is rejected by default.

See [Security](docs/SECURITY.md), [Compliance](docs/COMPLIANCE.md), and [Performance](docs/PERFORMANCE.md).

## Version 1.16.0

Release date: 2026-07-26

### Features added

- Added page-aware automatic flow for indivisible media, charts, forms, embeds, and explicitly kept blocks.
- Added paragraph, list-item, table-row, complete-table, and code-block splitting policies.
- Added `InsertPageBreak`, `KeepWithNext`, `toggleKeepTogether`, and pagination configuration commands.
- Added multi-page table export segmentation with repeated semantic header rows.
- Added a dedicated pagination demonstration and pagination behavior throughout all example pages.
- Added npm CDN integration paths for jsDelivr and unpkg.
- Published the UMD bundle through the GitHub-backed jsDelivr endpoint.
- Added package release `1.0.0` with CommonJS and native ES-module entry points.
- Added a Webpack UMD build at `dist/editra.js` for npm-backed CDNs.
- Added Jest entry tests and verified installation from the generated package archive.

### Bugs fixed

- Explicit page breaks now consume the remaining page space and force subsequent content onto the next page.
- Temporary pagination spacers are excluded from saved and exported document HTML.
- Large pagination passes are processed in animation-frame batches.
- Removed former company branding from source headers, documentation, examples, package metadata, and repository files.

### Known issues

- Extremely tall indivisible blocks that exceed one configured page remain scrollable because they cannot fit intact on any page.
- Browser print engines can make small font-metric adjustments that affect the final row distribution.
- The unscoped npm package name `editra` remains owned by another publisher.
- The jsDelivr and unpkg paths require publication of this package under an available npm name.

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
