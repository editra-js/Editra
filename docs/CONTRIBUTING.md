Version: 2.0.0
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
- Test the feature with a large document when it changes rendering or serialization.
- Add or update a feature demo and `docs/USER_GUIDE.md`.

## Pull request process

1. Keep each pull request focused.
2. Explain the user-visible change and compatibility impact.
3. Include tests and a linked example page.
4. Update `version.prop` and `RELEASE_NOTES.md` only for an approved release.
5. Confirm MIT-compatible licensing for new assets or dependencies.
6. Request review from an Editra maintainer.
