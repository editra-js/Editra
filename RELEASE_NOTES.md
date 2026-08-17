# Editra Release Notes

## Version 1.0.1

Release date: 2026-08-16

### Version 1.1.1 patch release

- Prepared the `editra-js` package and GitHub release artifacts for the
  `v1.1.1` release maintained by the Editra Team.
- Restored viewport-safe mobile menus, bottom-sheet pickers, and selection
  capture/restore for textarea and menu-driven formatting without removing the
  newer toolbar property detection, table resizing, link, emoji, or import work.
- Included dynamic modular plugin loading, standardized Word and Classic
  themes, textarea initialization examples, and updated developer and
  contributor documentation.
- Added higher-fidelity DOCX and styled HTML import, secure document handling,
  structured document data, isolated hosting, runtime integrity verification,
  and expanded table and draggable-object editing.
- Aligned package metadata, lockfile, runtime exports, documentation, SBOM,
  and automated governance checks with version `1.1.1`.

### Repository, domain, and team identity

- Moved the canonical repository to `https://github.com/editra-js/Editra` and
  aligned package metadata, documentation, tests, and the local Git remote.
- Established `https://editra.in` as the project homepage and reserved
  `https://cdn.editra.in` for the planned first-party asset CDN.
- Replaced former personal attribution and contact details with `Editra Team`
  and team-owned project channels.
- Documented DNS, provider, immutable versioning, caching, integrity, and
  rollout checks for the CDN migration.

### Themes and textarea integrations

- Standardized the public theme names as `Word` for the page-like modern
  experience and `Classic` for a continuous editor without automatic pages.
- Added tested textarea examples for Word modular loading and Classic
  single-bundle loading while preserving existing div-host initialization.
- Confirmed initial and synchronized textarea HTML uses the same sanitization
  path as div-host content.
- Standardized public initialization snippets on the configuration-object
  pattern and added a tested Word modular div example alongside the Classic
  single-bundle textarea example.
- Completed native Word-style page flow: Enter-created lines advance through
  each page's writable area, rendering-only page spacers never enter saved
  HTML, and print/PDF output preserves the editor's automatic page assignment.
- Aligned named paper formats with exact physical Word-compatible dimensions
  such as A4 `210mm x 297mm` and Letter `8.5in x 11in`. Print-ready HTML now
  reuses those dimensions instead of rounded screen pixels, and demo **Get
  HTML** downloads the same paginated document model used by PDF output.
- Word theme page geometry is now locked to the selected named standard;
  custom width and height initialization, `setEditorSize`, and
  `setCustomPageSize` cannot alter it. Classic sizing remains flexible.
- Corrected multi-page editing surfaces so every automatic page retains the
  complete standard paper height, including unused space below Page 2 content,
  instead of allowing the final page background to collapse around its text.

### Modular loading and plugin ecosystem

- Added `editra-core.js` and `editra-core.css` modular distribution entries,
  declared-plugin-only CSS loading, and on-demand built-in plugin JavaScript.
- Preserved the existing single-entry initialization and complete default UI.
- Added a versioned JSON plugin registry and schema, automated metadata and
  integrity validation, a searchable marketplace, and explicit update checks.
- Added sandboxed community plugin execution with source-checked messaging,
  SHA-256 entry verification, and manifest-approved capabilities.
- Added modular, marketplace, and spell-checker examples plus developer,
  registry, marketplace, contribution, help, and security documentation.

### Barcode, QR, and editing improvements

- Added lazy, client-side QR Code, Code 128, Code 39, and EAN-13 generation
  with persistent SVG output for HTML, Word, PDF, and print rendering.
- Added packaged QRCode and JsBarcode runtimes with exact dependency pins and
  third-party license inventory.
- Added object selection, resizing, movement, and Delete/Backspace removal for
  images, videos, barcodes, QR codes, emoji, tables, and structure elements.
- Changed remote HTTPS images to eager loading and stabilized their reserved
  layout space so scrolling does not reset editor state.
- Expanded the font selector to 23 families and added 12 document-language
  choices, including Hindi, Telugu, Urdu, and Arabic with RTL behavior.
- Added QR, Barcode, Language, and Format Painter UI integration, Word-style
  color grids with advanced choice and No Fill, arrow table-grid cursors, and
  consistent toggle behavior for core emphasis commands.
- Added superscript, subscript, block quotes, date/time insertion, categorized
  special characters, and multiple bullet and number styles.

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


See [docs/USER_GUIDE.md](docs/USER_GUIDE.md) for version 1.14.0 feature instructions and demonstrations.
