# Editra Plugin Marketplace

The [marketplace example](../examples/plugin-marketplace.html) is a searchable
web directory backed by `plugins/registry.json`. It distinguishes built-ins
from reviewed community plugins and can install a community plugin into its
sandbox preview editor.

“Install” means validating the manifest and digest, creating a restricted
iframe, and granting only declared capabilities for the current page. The
sample stores the selected ID/version in `localStorage` for display; it does
not modify package files or silently execute plugins on another page.
Applications may persist approved choices server-side and pass those exact
manifests through `communityPlugins` during initialization.

Marketplace plugins use the same capability API when Editra is initialized on
a `<textarea>` or `<div>`, with the `Word` or `Classic` theme, and through the
single-bundle or modular entry. No separate plugin build, manifest field, or
install flow is required for either initialization mode.

Search is local and uses name, author, and description. Update checks compare
semantic versions through `checkCommunityPluginUpdates(registryUrl)`. Updates
remain explicit: fetch the reviewed manifest, show release information, and
call `installCommunityPlugin` only after application policy permits it.

For production, pin the registry, use immutable plugin URLs, keep community
integrity enforcement enabled, apply CSP, and serve the marketplace only to
authorized administrators when plugin choice affects shared documents.
