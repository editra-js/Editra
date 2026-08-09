# Editra Standards and Compliance

## Scope

This document is a technical control mapping for Editra 1.1.1. It is not a certification. Compliance belongs to the complete deployed application, including identity, APIs, storage, infrastructure, monitoring, policies, and operating procedures.

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

## Financial-services readiness

Status legend: **Implemented** means repository evidence exists, **Adopter** means the integrating organization must operate the control, and **External** requires independent assurance. This mapping is readiness guidance, not a PCI DSS validation, SOC 2 report, legal opinion, or central-bank certification.

### PCI DSS v4.0.1

| Area | Status | Editra contribution | Remaining responsibility |
|---|---|---|---|
| Requirement 6 secure development and vulnerability management | Implemented + Adopter | Threat-based security architecture, locked dependencies, SBOM, VDP, automated tests and release gates | Operate secure-SDLC policy, training, reviews, patch deployment, inventory and evidence retention |
| Public web/payment-page application protection | Adopter | CSP, SRI and script-origin controls support the host | Deploy required public-facing protection; authorize, inventory and integrity-monitor every payment-page script |
| Requirement 11 testing/change detection | External + Adopter | Cross-browser adversarial regression suite and immutable artifact evidence | Commission independent penetration testing and retesting; monitor deployed page/header/script changes |
| Requirement 12 incident and third-party governance | Implemented + Adopter | Public VDP, SBOM and response/release process | Integrate enterprise incident contacts, exercises, acquirer/QSA/regulator notification and vendor oversight |

PCI scope depends on whether the deployed environment stores, processes, or transmits payment account data and must be confirmed with the adopting organization's QSA. Authoritative references: [PCI SSC standards](https://www.pcisecuritystandards.org/standards/), [document library](https://www.pcisecuritystandards.org/document_library/), and [Secure Software Standard](https://www.pcisecuritystandards.org/standards/secure-software/).

### SOC 2

| Trust Services area | Status | Editra contribution | Organization-level gap |
|---|---|---|---|
| Logical/technical access | Implemented + Adopter | Least-capability iframe API, exact origins, CSP and SRI | Identity, privileged access, secrets, infrastructure and access reviews |
| Detection and response | Implemented + Adopter | Security callbacks, automated gates and VDP | Central monitoring, alert ownership, incident operation and retained evidence |
| Change management and vendor risk | Implemented + Adopter | Lockfile, dependency review, SBOM and provenance workflow | Enforce approvals, segregation, protected repository settings, deployments and vendor governance |
| Availability, confidentiality and processing integrity | Adopter + External | Isolation and content-integrity controls contribute | Define the service boundary/commitments, operate controls over time and obtain an independent CPA examination |

The AICPA Trust Services Criteria address security, availability, processing integrity, confidentiality and privacy. A SOC 2 Type II conclusion requires an authorized independent examination over an operating period. References: [AICPA Trust Services Criteria](https://www.aicpa-cima.com/resources/download/2017-trust-services-criteria-with-revised-points-of-focus-2022) and [SOC suite](https://www.aicpa-cima.com/soc).

### Regional central-bank requirements

No jurisdiction, regulated-entity type, hosting model or outsourcing classification has been specified. The adopter must select the exact current regulator/circular and map secure SDLC, outsourcing, data localization, cryptography, logging/SOC, incident notification, continuity, vulnerability testing, audit access and retention. Editra cannot claim central-bank compliance without that mapping and operational evidence.

## Independent assurance and residual risk

Editra has not undergone an independent third-party penetration audit and has no SOC 2, ISO 27001, PCI DSS AOC/ROC, PCI Secure Software listing, or central-bank approval. Before a regulated production decision, commission an assessor to cover mXSS/parser differentials, CSP/Trusted Types bypass, iframe/message escape, plugin and supply-chain tampering, JSON/schema confusion, malicious imports/resource exhaustion, and host authorization/storage/output boundaries; remediate and retest findings.

Residual risks include browser or sanitizer zero-days, compromised host JavaScript, unsafe server-side reuse, malicious dependencies/plugins, malformed or oversized imports, client-telemetry suppression, editable DOCX/HTML fidelity differences and regulator-scope interpretation. The adopter must assign owners, compensating controls, acceptance dates and approval authority for each applicable risk.
