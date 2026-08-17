# Editra security architecture

Editra 1.0.1 treats initial HTML, paste, source view, imported content, collaboration updates, revisions, headers/footers, JSON documents, and export content as untrusted. These controls reduce integration risk; they are not a certification or a substitute for an independent assessment of the deployed application.

## Trust boundaries and data flow

Content enters through DIV/textarea hosts, editor commands, HTML/DOCX imports, JSON import, collaboration, and plugins. It passes through size/depth/node limits, URL/CSS policy, stable parse/sanitize/serialize processing, and DOMPurify before reaching the editable DOM. Export paths sanitize again. The host application remains responsible for authentication, document authorization, server-side validation/sanitization, malware scanning, storage, encryption, retention, audit logging, network controls, and safe document-conversion workers.

The initial Editra entry script and integrity manifest are deployment trust anchors. Built-in runtime files load only from approved origins and, in regulated mode, require matching SHA-256 SRI entries. Community plugins are disabled in regulated mode.

## Regulated profile

Enable with `regulated: true` or `security.profile: "regulated"`. The profile locks sanitization, paste sanitization, Trusted Types, same-origin requests, runtime origin restrictions, and SRI. It disables document iframes and community plugins and denies external content/collaboration origins unless explicitly allowlisted. Unsafe override attempts are ignored and reported as `regulated-profile-lock` events.

Generate reviewed runtime hashes with `npm run security:integrity` and provide `plugins/runtime-integrity.json` as `security.pluginIntegrity`. Protect the entry script and manifest as immutable application assets.

## XSS, CSS, and DOM safeguards

- Sanitization iterates parse/sanitize/serialize until stable and rejects non-converging markup. The final inspected DOM is the returned representation.
- Trusted Types separates document content (`trustedHTML`) from fixed editor UI templates (`trustedUIHTML`). Source contracts reject unclassified direct HTML sinks.
- Scripts, active embeds/forms, event attributes, executable protocols, named-property clobbering, SVG filters, active SVG re-contextualization elements, external-resource CSS, and fixed/sticky layout escape are rejected.
- Inert SVG shapes needed by generated QR codes and barcodes remain supported.
- Imports, source view, collaboration, revisions, headers/footers, and exports use the same security invariants.
- Byte, media, node, depth, history, message, and command-rate limits fail closed.
- The browser suite exercises fixed and generated mXSS cases in Chromium, Firefox, and WebKit.

Approved regulated formatting is deferred before browser parsing and restored through CSSOM after safe insertion, allowing `style-src-attr 'none'` without weakening content filtering.

## Strict CSP

The tested regulated policy contains neither `unsafe-inline` nor `unsafe-eval`:

```http
Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self'; style-src-attr 'none'; img-src 'self' data: blob:; font-src 'self'; media-src 'self' blob:; frame-src 'none'; connect-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'self'; trusted-types default dompurify editra-loader; require-trusted-types-for 'script'
X-Content-Type-Options: nosniff
Referrer-Policy: no-referrer
Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=()
```

The application gateway must send and monitor these headers. Adjust `frame-src` and `frame-ancestors` only for the separate-origin mode described below.

## Separate-origin isolation

Set `isolation: "iframe"` and `isolationUrl` to run Editra inside the packaged sandbox frame. Regulated mode rejects a frame on the parent origin. Deploy `isolation/frame.html` and its assets on a dedicated trusted origin, allow that exact origin through the parent's `frame-src`, and allow only the application through the frame's `frame-ancestors`.

The frame uses `allow-scripts allow-same-origin`; the required cross-origin boundary prevents the parent from reading the editor DOM. Messages require the expected window, exact origin, cryptographically random channel, known operation, request identifier, and payload limits. Wildcard message targets are not used. The asynchronous proxy is documented in [API_REFERENCE.md](./API_REFERENCE.md#isolated-iframe-mode).

## Structured JSON

`getJSON`, `validateJSON`, and `setJSON` use the versioned [Editra document schema](./EDITRA-DOCUMENT-SCHEMA.json). Runtime validation is stricter than the generic JSON Schema: unknown nodes/elements/attributes and oversized structures are rejected, DOM nodes are constructed through browser APIs, and resulting HTML passes through the normal stable sanitizer.

## Host requirements

- Authorize every document, collaboration, import, save, and export action server-side.
- Use CSRF protection, secure cookies, parameterized storage, authenticated quotas, and safe logging.
- Scan uploaded files/media before persistence or redistribution. DOCX structural checks are not malware assurance.
- Sanitize and authorize stored output again at every server rendering boundary.
- Isolate converters with fixed arguments, patched binaries, CPU/memory/time limits, and no ambient credentials.
- Encrypt transport/storage, classify data, restrict access, define retention, and keep regulated content out of telemetry.
- Inventory and approve all host/payment-page scripts and monitor deployed scripts and headers for unauthorized change.

## Security events

Editra dispatches `editra:security-violation` and calls `onSecurityViolation` with `{ type, message, detail, timestamp }`. Hosts should map types to allowlisted codes, add authenticated server correlation, redact content and secrets, apply quotas/retention, and alert on abnormal volume. Browser telemetry can be suppressed or forged and does not replace server audit logs.

## Supply chain and release

Dependencies are exact-pinned and locked. CI performs immutable installation, audit, CodeQL, dependency review, build/unit/browser tests, SRI and SBOM validation, and package inspection. Tag builds produce checksums, release evidence, and GitHub build-provenance attestation. The CycloneDX SBOM is `artifacts/editra-sbom.cdx.json`.

Administrators must separately enable protected branches/tags, required reviews, private vulnerability reporting, secret scanning/push protection, restricted environments, and minimal workflow permissions. Releases must come from a clean reviewed commit and immutable signed tag; never overwrite a published package or move a tag.

## Vulnerability reporting

Follow the repository [security policy](../SECURITY.md). Do not disclose exploitable findings publicly or include real personal, payment-card, authentication, or regulated data.

## Verification

Run `npm run security:assurance`. It builds the distribution and runs unit/security contracts, Chromium/Firefox/WebKit tests, dependency audit, runtime integrity, SBOM verification, and package inspection. The generated local assurance JSON is transient CI evidence and is not part of the npm package.
