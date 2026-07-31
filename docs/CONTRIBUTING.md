# Contributing to Editra

## Fork and clone

1. Fork the repository in your Git hosting service.
2. Clone your fork: `git clone <fork-url>`.
3. Enter the repository and add the canonical Editra repository as `upstream`.
4. Run `node tests/automation/verify-project.js` before changing code.

## Branching strategy

- `main` contains releasable code.
- Use `feature/<short-name>` for features.
- Use `fix/<short-name>` for corrections.
- Use `docs/<short-name>` for documentation-only work.
- Rebase or merge the latest `main` before requesting review.

## Code style

- Use plain HTML, CSS, and JavaScript; do not add a framework dependency.
- Keep plugins independent and memory-safe.
- Batch repeated DOM changes with `requestAnimationFrame`.
- Register every global listener with a matching cleanup.
- Use accessible labels, keyboard behavior, and semantic HTML.
- Preserve existing public commands and minimal initialization.
- Start every source file with the required Editra ownership/version/license header.

## Testing requirements

- Run `node tests/automation/verify-project.js`.
- Run `node --check` for every changed JavaScript file.
- Test light and dark themes.
- Test plugin cleanup through `destroy()`.
- Test plugins with both `<div>` and `<textarea>` hosts; do not depend on the
  original host element being the editable surface.
- Test the feature with a large document when it changes rendering or serialization.
- Add or update a feature demo and `docs/USER_GUIDE.md`.
- Use the configuration-object initialization pattern in runnable examples:
  include `selector`, the `Word` or `Classic` theme, and the plugin IDs the
  example exercises. Keep the script external when the example runs under CSP.

## Pull request process

1. Keep each pull request focused.
2. Explain the user-visible change and compatibility impact.
3. Include tests and a linked example page.
4. Update `version.prop` and `RELEASE_NOTES.md` only for an approved release.
5. Confirm MIT-compatible licensing for new assets or dependencies.
6. Request review from an Editra maintainer.

## Plugin contribution workflow

1. Fork the repository and create `plugin/<plugin-id>`.
2. Add the implementation, tests, documentation, and a runnable example.
3. Add or update one entry in `plugins/registry.json`; do not weaken the JSON schema.
4. Generate the SHA-256 digest from the final immutable entry document.
5. Document every requested capability and allowed command.
6. Open a pull request using semantic versioning and state compatibility.

Reviewers verify code ownership and licensing, schema validity, dependency
provenance, CSP behavior, sanitization, URL handling, keyboard/accessibility,
cleanup, performance, browser coverage, and compatibility with both loading
modes and both supported host elements. Community plugins must remain functional without `allow-same-origin`,
top navigation, popups, forms, or direct editor DOM access. Approval adds the
entry to the registry; publishing occurs only from a protected release.

Security checklist:

- No `eval`, `new Function`, string timers, inline event handlers, or document writes.
- No secrets, credentials, tokens, or private document data in logs or telemetry.
- Minimum capability set and explicit command allowlist.
- Pinned dependencies and immutable assets with matching SHA-256 integrity.
- Bounded messages, inputs, output, network requests, and storage.
- Cleanup verified after uninstall and editor destruction.
