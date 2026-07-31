# Editra Security

## Security posture

Editra 1.17.0 treats all document HTML, pasted content, imported content, source-view content, collaboration operations, revision previews, headers, footers, and exported document content as untrusted.

DOMPurify 3.4.12 is pinned in the lockfile and distributed locally. Sanitization is enabled by default and cannot be bypassed through `sanitizePaste: false`. A host can explicitly disable the entire security layer for a trusted offline migration, but that mode is not enterprise-safe.

The same sanitization path applies to `<div>` and `<textarea>` hosts. A
textarea's initial value is treated as untrusted HTML before it reaches the
editable surface, and its synchronized form value contains the sanitized
serialized editor content; applications must still sanitize and authorize
stored content server-side.

> Assurance statement: “Editra is safe to integrate into enterprise applications without weakening host security” when the mandatory host controls in this document are implemented and the security layer remains enabled.

No software can guarantee the absence of every future vulnerability. This assurance is a documented integration posture, not a security certification, HIPAA attestation, regulatory opinion, or replacement for an application threat model and penetration test.

## Enforced editor controls

| Threat | Editra control |
|---|---|
| Stored and DOM XSS | DOMPurify HTML-profile allowlist; scripts, active embeds, forms, dangerous attributes, unsafe protocols, named-property clobbering, and executable CSS are removed. |
| Encoded payloads | Browser parsing plus DOMPurify canonicalization occurs before insertion. |
| Source-view bypass | HTML is sanitized before source view is applied to WYSIWYG. |
| Export leakage/XSS | Export page content is sanitized again before HTML, Word, and print output. |
| Malicious collaboration content | Remote blocks and revision previews pass through the same sanitizer. |
| Untrusted media | `file:` and executable data URLs are rejected; image data URLs use an image-only base64 pattern. |
| Embedded players | Iframes are denied by default. Hosts must opt in to exact domains; accepted frames receive a restrictive sandbox and referrer policy. |
| Oversized input | Configurable byte, DOM-node, depth, media-size, history-byte, and command-rate limits fail closed. |
| Plugin compromise | Built-ins resolve through a frozen manifest with origin/integrity controls. Community plugins use validated metadata, SHA-256 entry verification, sandboxed iframes, source-checked messages, and capability allowlists. |
| DOM sink abuse | Trusted Types support uses `editra-loader`, `dompurify`, and a sanitized `default` policy when the host enforces Trusted Types. |
| Memory leaks | `destroy()` cancels animation frames, disconnects observers, removes document listeners, revokes object URLs, destroys UI, removes sanitizer hooks, clears maps/history, and releases callbacks. |
| Slow updates | Input state, serialization, layout, and plugin work use keyed `requestAnimationFrame` batching. |

## Secure initialization

```html
<script nonce="SERVER_NONCE" src="/vendor/editra/core/editor.js"></script>
<script nonce="SERVER_NONCE">
  Editra.init({
    selector: "#editra-editor",
    sanitizePaste: true,
    security: {
      maxDocumentBytes: 5 * 1024 * 1024,
      maxNodes: 50000,
      maxDepth: 100,
      maxMediaBytes: 10 * 1024 * 1024,
      maxCommandsPerSecond: 120,
      allowIframes: false,
      allowedIframeHosts: [],
      allowedPluginOrigins: [location.origin],
      requirePluginIntegrity: false,
      pluginNonce: "SERVER_NONCE",
      csrfToken: document.querySelector('meta[name="csrf-token"]').content
    },
    onSecurityViolation(event) {
      securityTelemetry.record(event);
    }
  });
</script>
```

If external plugin delivery is approved, enable `requirePluginIntegrity` and provide a `security.pluginIntegrity` map keyed by the exact Editra plugin path. Never generate integrity hashes at runtime.

## Required response headers

The application server, reverse proxy, or gateway—not a JavaScript component—must send security headers. A strict starting policy is:

```http
Content-Security-Policy: default-src 'self'; script-src 'self' 'nonce-{RANDOM}'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; font-src 'self'; media-src 'self' blob: https:; frame-src 'self'; connect-src 'self' https: wss:; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'; trusted-types default dompurify editra-loader; require-trusted-types-for 'script'
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=()
Cross-Origin-Opener-Policy: same-origin
X-Frame-Options: DENY
```

`frame-ancestors 'none'` and `X-Frame-Options: DENY` protect a top-level authoring application from clickjacking. If the application intentionally embeds its editor route, replace `frame-ancestors 'none'` with an explicit allowlist and use `X-Frame-Options: SAMEORIGIN` where compatible. JavaScript “frame busting” is not a substitute for headers.

`frame-src 'self'` permits reviewed same-origin community sandboxes. If an
application does not use community plugins, reduce it to `frame-src 'none'`.
Cross-origin plugin frames require an explicit origin in both CSP and
`allowedPluginOrigins`.

## Host responsibilities

Editra cannot safely implement server controls on behalf of its host:

- CSRF: validate synchronizer/double-submit tokens server-side, reject unexpected `Origin`/`Referer`, and use `SameSite=Lax` or `Strict`, `Secure`, and `HttpOnly` cookies. `secureRequest()` requires a configured token for state-changing requests, but the server must verify it.
- SQL/NoSQL/command injection: store editor output only through parameterized queries and typed repository APIs. Never concatenate content into SQL, shell commands, document-conversion arguments, templates, or logs.
- Bots and abuse: protect save, collaboration, feedback, import, and export endpoints with authenticated quotas, rate limits, anomaly logging, and CAPTCHA/challenge controls where appropriate.
- Data protection: classify data, minimize collection, encrypt transport and storage, restrict access, set retention periods, redact telemetry, and complete applicable GDPR/HIPAA/legal assessments.
- Export services: use isolated workers/containers, fixed executable arguments, timeouts, memory/CPU limits, and patched converters. Sanitize again on the server.
- Authentication and authorization: verify every document and collaboration action server-side; never trust editor callbacks as authorization.
- Malware: scan uploaded media and documents on the server before persistence or redistribution.

## Plugin policy

Editra does not use `eval`, `new Function`, or string timers. Built-in plugin
names resolve only through the frozen manifest. Approved built-in scripts use
origin allowlists and optional SRI. Community code is never accepted as a
plugin object and never receives the editor core. It runs in an iframe with
`sandbox="allow-scripts"` and no `allow-same-origin`; messages are matched to
the installed frame and filtered through declared capabilities and command
allowlists. Community entry documents require SHA-256 metadata verification by
default. Use immutable URLs to prevent changes between verification and frame
navigation.

### Sanitized HTML and CSS

Document content uses DOMPurify's HTML/SVG profiles. `script`, `style`,
`object`, `embed`, `applet`, `base`, `meta`, `link`, and `form` are always
forbidden. `iframe` is forbidden unless the host enables it and allowlists the
exact hostname. Attributes beginning with `on`, plus `srcdoc`, `action`,
`formaction`, `nonce`, and `ping`, are removed. URL attributes accept only
approved HTTP(S), mail, telephone, restricted image data, and managed blob
URLs. Inline CSS containing `expression`, `url()`, `@import`, browser behavior,
bindings, or executable protocols is removed. Node, depth, byte, media, and
command-rate limits fail closed. Plugin sandbox documents are not inserted
into editor content and receive no sanitizer exemption.

## Supply-chain policy

- Runtime dependency: exactly `dompurify@3.4.12`, with zero transitive runtime dependencies.
- Development dependencies are exact-pinned in `package.json` and locked by `package-lock.json`.
- CI runs `npm ci --ignore-scripts`, `npm audit --audit-level=high`, dependency review, CodeQL, tests, build, and package inspection.
- Renovation requires security review, lockfile diff review, upstream provenance/signature review, and the full browser matrix.
- Release artifacts must be produced from a protected tag and accompanied by checksums/signatures in the release process.

## Vulnerability reporting

Do not disclose exploitable findings in a public issue. Use GitHub private vulnerability reporting for `editra-js/Editra`, or contact `editra.dev@gmail.com` with affected versions, reproduction steps, impact, and suggested remediation. Do not include real personal or regulated data.

## Primary standards references

- [OWASP XSS Prevention](https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html)
- [OWASP CSRF Prevention](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html)
- [OWASP Injection Prevention](https://cheatsheetseries.owasp.org/cheatsheets/Injection_Prevention_Cheat_Sheet.html)
- [OWASP Denial of Service](https://owasp.org/www-community/attacks/Denial_of_Service)
- [Trusted Types](https://developer.mozilla.org/en-US/docs/Web/API/Trusted_Types_API)
- [DOMPurify](https://github.com/cure53/DOMPurify)
