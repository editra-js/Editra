"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const registryPath = path.join(root, "plugins", "registry.json");
const registry = JSON.parse(fs.readFileSync(registryPath, "utf8"));
JSON.parse(fs.readFileSync(path.join(root, "plugins", "registry.schema.json"), "utf8"));
const errors = [];
const ids = new Set();
const versionPattern = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;
const compatibilityPattern = /^>=\d+\.\d+\.\d+$/;

if (registry.schemaVersion !== "1.0.0") errors.push("Unsupported schemaVersion");
if (!Array.isArray(registry.plugins)) errors.push("plugins must be an array");
for (const plugin of registry.plugins ?? []) {
  for (const key of ["id", "name", "version", "author", "description", "compatibility", "type"]) {
    if (!String(plugin[key] ?? "").trim()) errors.push(`${plugin.id || "plugin"} missing ${key}`);
  }
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(plugin.id)) errors.push(`Invalid id ${plugin.id}`);
  if (ids.has(plugin.id)) errors.push(`Duplicate id ${plugin.id}`);
  ids.add(plugin.id);
  if (!versionPattern.test(plugin.version)) errors.push(`Invalid version for ${plugin.id}`);
  if (!compatibilityPattern.test(plugin.compatibility)) errors.push(`Invalid compatibility for ${plugin.id}`);
  if (!["builtin", "community"].includes(plugin.type)) errors.push(`Invalid type for ${plugin.id}`);

  if (plugin.type === "builtin") {
    for (const field of ["entry", "style"]) {
      if (!plugin[field]) continue;
      const asset = path.resolve(path.dirname(registryPath), plugin[field]);
      if (!asset.startsWith(path.dirname(registryPath) + path.sep) || !fs.existsSync(asset)) {
        errors.push(`${plugin.id} has a missing ${field}`);
      }
    }
  } else {
    if (!/^sha256-[A-Za-z0-9+/]+={0,2}$/.test(plugin.integrity ?? "")) {
      errors.push(`${plugin.id} has invalid integrity`);
      continue;
    }
    if (!Array.isArray(plugin.permissions)) errors.push(`${plugin.id} permissions must be an array`);
    const url = new URL(plugin.entry, "https://editra.local/");
    if (url.origin === "https://editra.local") {
      const asset = path.resolve(root, url.pathname.slice(1));
      if (!asset.startsWith(root + path.sep) || !fs.existsSync(asset)) {
        errors.push(`${plugin.id} entry is missing`);
      } else {
        const digest = `sha256-${crypto.createHash("sha256").update(fs.readFileSync(asset)).digest("base64")}`;
        if (digest !== plugin.integrity) errors.push(`${plugin.id} integrity does not match its entry`);
      }
    }
  }
}

if (errors.length) {
  console.error(`Plugin registry validation failed:\n- ${errors.join("\n- ")}`);
  process.exitCode = 1;
} else {
  console.log(`Plugin registry validated: ${registry.plugins.length} entries.`);
}
