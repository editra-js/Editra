/**
 * Generates SHA-256 integrity values for runtime-loadable Editra assets.
 *
 * Regulated mode uses this manifest to reject missing or modified scripts and
 * styles. Use `--check` in CI to verify the committed manifest without changing
 * it.
 */
"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const outputPath = path.join(root, "plugins", "runtime-integrity.json");
const checkOnly = process.argv.includes("--check");

const explicitAssets = ["core/document-schema.js", "core/editor.js", "core/security.js"];
const assetDirectories = [
  ["plugins", new Set([".js", ".css"])],
  ["ui", new Set([".js", ".css"])],
  ["themes", new Set([".css"])],
  ["vendor", new Set([".js"])],
  ["isolation", new Set([".js"])],
];

const assets = [...explicitAssets];
for (const [directory, extensions] of assetDirectories) {
  const absoluteDirectory = path.join(root, directory);
  for (const entry of fs.readdirSync(absoluteDirectory, { withFileTypes: true })) {
    if (!entry.isFile() || !extensions.has(path.extname(entry.name))) continue;
    assets.push(`${directory}/${entry.name}`);
  }
}

const integrity = Object.fromEntries(
  [...new Set(assets)]
    .sort((left, right) => left.localeCompare(right))
    .map((relativePath) => {
      const content = fs.readFileSync(path.join(root, ...relativePath.split("/")));
      const digest = crypto.createHash("sha256").update(content).digest("base64");
      return [relativePath, `sha256-${digest}`];
    }),
);

const manifest = `${JSON.stringify(
  {
    schemaVersion: "1.0.0",
    algorithm: "sha256",
    integrity,
  },
  null,
  2,
)}\n`;

if (checkOnly) {
  const current = fs.existsSync(outputPath)
    ? fs.readFileSync(outputPath, "utf8")
    : "";
  if (current !== manifest) {
    throw new Error(
      "Runtime integrity manifest is stale. Run npm run security:integrity.",
    );
  }
  console.log(`Runtime integrity verified: ${Object.keys(integrity).length} assets.`);
} else {
  fs.writeFileSync(outputPath, manifest);
  console.log(`Generated runtime integrity for ${Object.keys(integrity).length} assets.`);
}
