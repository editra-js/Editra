/**
 * Rejects dependency licenses that Editra does not allow in its distribution.
 *
 * Dependency Review performs this check for pull-request changes when GitHub's
 * dependency graph is available. This local validator provides the same denied
 * license policy for forks and repositories where that optional feature is off.
 */
"use strict";

const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const lock = JSON.parse(
  fs.readFileSync(path.join(root, "package-lock.json"), "utf8"),
);
const denied = new Set([
  "GPL-2.0",
  "GPL-2.0-only",
  "GPL-2.0-or-later",
  "GPL-3.0",
  "GPL-3.0-only",
  "GPL-3.0-or-later",
  "AGPL-1.0",
  "AGPL-1.0-only",
  "AGPL-1.0-or-later",
  "AGPL-3.0",
  "AGPL-3.0-only",
  "AGPL-3.0-or-later",
]);

const failures = [];
for (const [location, metadata] of Object.entries(lock.packages ?? {})) {
  if (!location || !location.startsWith("node_modules/")) continue;
  const license = String(metadata.license ?? "").trim();
  const identifiers = license.match(/\b(?:AGPL|GPL)-[0-9.]+(?:-(?:only|or-later))?/g) ?? [];
  const blocked = identifiers.find((identifier) => denied.has(identifier));
  if (blocked) {
    failures.push(`${location.slice("node_modules/".length)}: ${license}`);
  }
}

if (failures.length) {
  throw new Error(`Denied dependency licenses:\n${failures.join("\n")}`);
}

console.log(`Dependency licenses validated: ${denied.size} denied SPDX identifiers.`);
