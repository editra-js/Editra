# Editra Plugin Registry Specification

The canonical registry is [`plugins/registry.json`](../plugins/registry.json)
and its machine-readable contract is
[`plugins/registry.schema.json`](../plugins/registry.schema.json).

Each entry contains `id`, `name`, semantic `version`, `author`, `description`,
`compatibility`, and `type`. Built-ins may specify JavaScript and CSS entry
paths. Community entries additionally require:

- `entry`: immutable HTTPS or same-origin sandbox document URL.
- `integrity`: SHA-256 digest of the entry document.
- `permissions`: capability names requested from the host.
- `allowedCommands`: explicit command subset when command execution is needed.
- `ui`: whether the sandbox iframe is visible and its accessible title.

Example:

```json
{
  "id": "spell-checker",
  "name": "Spell Checker",
  "version": "1.0.0",
  "author": "Community Dev",
  "description": "Adds spell checking support",
  "compatibility": ">=1.0.0",
  "type": "community",
  "entry": "/plugins/spell-checker/1.0.0/index.html",
  "integrity": "sha256-BASE64_DIGEST",
  "permissions": ["document.readText"],
  "allowedCommands": [],
  "ui": { "visible": true, "title": "Spell Checker" }
}
```

Registry updates are pull-request reviewed. Entries are never accepted from
client-side form submissions. CI validates the schema, compatibility range,
duplicate IDs, immutable URLs, integrity digest, and referenced assets.
