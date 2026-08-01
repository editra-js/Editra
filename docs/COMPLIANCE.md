# Editra Standards and Compliance

## Scope

This document is a technical control mapping for Editra 1.0.0. It is not a certification. Compliance belongs to the complete deployed application, including identity, APIs, storage, infrastructure, monitoring, policies, and operating procedures.

## OWASP mapping

| Area | Implementation evidence |
|---|---|
| A01 Broken Access Control | No client authorization claims; host responsibilities require server authorization on every action. |
| A02 Cryptographic Failures | Editra does not persist drafts automatically; transport/storage encryption remains a host control. |
| A03 Injection | Sanitized HTML boundaries; safe URL validation; no `eval`, `new Function`, or `document.write`; parameterization requirements documented. |
| A04 Insecure Design | Explicit limits, deny-by-default iframes, security events, lifecycle cleanup, threat-boundary documentation. |
| A05 Security Misconfiguration | Demonstration server sends CSP, Trusted Types, clickjacking, MIME, referrer, permissions, and opener headers. |
| A06 Vulnerable Components | Exact dependency pins, lockfile, audit, dependency review, and CodeQL CI. |
| A07 Authentication Failures | Authentication delegated to the host; no security decisions based on editor state. |
| A08 Integrity Failures | Same-origin plugin allowlist plus optional mandatory SRI and CSP nonce. |
| A09 Logging Failures | `onSecurityViolation` and `editra:security-violation` provide a redaction-safe telemetry boundary. |
| A10 SSRF | `secureRequest()` defaults to same-origin and safe credentials/referrer behavior. Server-side URL fetchers still require independent SSRF defenses. |

## WCAG 2.1 support

Editra targets WCAG 2.1 AA integration:

- The editor uses `role="textbox"`, `aria-multiline`, an accessible label, language, and direction.
- Toolbar and menu use native buttons/selects, toolbar/menu roles, labels, expanded state, focus management, and keyboard operation.
- Commands announce completion through a polite ARIA live region.
- Word-like shortcuts include bold, italic, underline, undo/redo, save, selection, indentation, and navigation behavior.
- The Word theme provides visible focus and Word-style selection.
- Motion is not required to operate the editor.

The host must provide page-level landmarks, skip links, sufficient contrast after theme customization, accessible validation, captions/transcripts for media, alternative text policy, zoom/reflow testing, and assistive-technology user testing. Automated tests do not prove WCAG conformance.

Reference: [W3C WCAG 2.1](https://www.w3.org/TR/WCAG21/).

## Internationalization

- `language` writes the editor `lang` attribute.
- `direction: "ltr" | "rtl" | "auto"` controls bidirectional layout.
- `translations` accepts language packs for toolbar, menu, command, option, and announcement keys.
- Content remains Unicode; no ASCII-only conversion occurs.
- CSS uses logical start alignment for RTL editor content.

Applications remain responsible for translating custom plugins, locale-aware date/number formatting, bidirectional-security review of identifiers, and locale-specific typography.

## Browser compatibility

CI executes the same security, accessibility, RTL, lifecycle, and performance suite in:

- Chromium (Chrome/Edge engine)
- Firefox
- WebKit (Safari-compatible engine)

The local installed-browser suite additionally checks Google Chrome and Microsoft Edge. Supported production targets are the latest two stable releases of Chrome, Edge, Firefox, and Safari. Legacy Internet Explorer is not supported.

## Data export

HTML, Word, and print/PDF page content is sanitized at export. Print preview uses a sandboxed blob-backed iframe rather than `document.write`. Hosts using server converters must sanitize again, isolate conversion, cap resources, pin converters, scan uploads, and avoid command interpolation.

## Privacy and regulated data

Editra has no analytics, tracking pixel, cloud upload, or automatic draft persistence. This reduces unintended disclosure but does not make an application GDPR- or HIPAA-compliant. Controllers/processors must implement lawful basis, notices, consent where required, data-subject rights, retention, breach handling, BAAs/DPAs, audit logging, and regional requirements.

## Verification evidence

- `tests/security/browser-security.html`: executable XSS, URL, iframe, RTL, ARIA, lifecycle, and stress checks.
- `tests/unit/security-contract.test.js`: dependency, sanitizer, export, no-eval, and lifecycle contracts.
- `tests/playwright/enterprise.spec.js`: Chromium/Firefox/WebKit matrix.
- `.github/workflows/security.yml`: audits, dependency review, CodeQL, browser matrix, build, and package inspection.
- `docs/PERFORMANCE.md`: benchmark procedure, budgets, and results.
