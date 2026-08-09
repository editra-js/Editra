/**
 * Generates Editra's CycloneDX software bill of materials from locked package
 * metadata and bundled third-party assets. Regenerate the output with this tool
 * instead of editing the release artifact by hand.
 */
"use strict";

const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const lock = JSON.parse(fs.readFileSync(path.join(root, "package-lock.json"), "utf8"));
const output = path.join(root, "artifacts", "editra-sbom.cdx.json");
const checkOnly = process.argv.includes("--check");

function packageName(packagePath, entry) {
  return entry.name || packagePath.replace(/^node_modules\//, "");
}

function purl(name, version) {
  return `pkg:npm/${encodeURIComponent(name).replace("%40", "@").replace("%2F", "%2F")}@${version}`;
}

function component(packagePath, entry) {
  const name = packageName(packagePath, entry);
  const item = {
    type: "library",
    "bom-ref": purl(name, entry.version),
    name,
    version: entry.version,
    scope: entry.dev ? "optional" : "required",
    purl: purl(name, entry.version),
  };
  if (entry.integrity?.startsWith("sha512-")) {
    item.hashes = [{
      alg: "SHA-512",
      content: Buffer.from(entry.integrity.slice(7), "base64").toString("hex"),
    }];
  }
  if (entry.license) item.licenses = [{ license: { id: entry.license } }];
  if (entry.resolved) {
    item.externalReferences = [{ type: "distribution", url: entry.resolved }];
  }
  return item;
}

const packageEntries = Object.entries(lock.packages || {})
  .filter(([packagePath, entry]) => packagePath && entry?.version)
  .sort(([left], [right]) => left.localeCompare(right));
const components = packageEntries.map(([packagePath, entry]) => component(packagePath, entry));
const rootPackage = lock.packages?.[""] || {};
const rootRef = purl(lock.name, lock.version);
const directNames = new Set([
  ...Object.keys(rootPackage.dependencies || {}),
  ...Object.keys(rootPackage.devDependencies || {}),
]);
const directRefs = components
  .filter((item) => directNames.has(item.name))
  .map((item) => item["bom-ref"])
  .sort();

const bom = {
  bomFormat: "CycloneDX",
  specVersion: "1.6",
  serialNumber: `urn:uuid:00000000-0000-4000-8000-${Buffer.from(`${lock.name}@${lock.version}`).toString("hex").slice(0, 12).padEnd(12, "0")}`,
  version: 1,
  metadata: {
    component: {
      type: "application",
      "bom-ref": rootRef,
      name: lock.name,
      version: lock.version,
      purl: rootRef,
      licenses: [{ license: { id: rootPackage.license || "MIT" } }],
    },
    tools: { components: [{ type: "application", name: "Editra SBOM generator", version: "1.0.0" }] },
  },
  components,
  dependencies: [{ ref: rootRef, dependsOn: directRefs }],
};
const serialized = `${JSON.stringify(bom, null, 2)}\n`;

if (checkOnly) {
  const current = fs.existsSync(output) ? fs.readFileSync(output, "utf8") : "";
  if (current !== serialized) throw new Error("SBOM is stale. Run npm run security:sbom.");
  console.log(`SBOM verified: ${components.length} components.`);
} else {
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, serialized);
  console.log(`Generated CycloneDX SBOM with ${components.length} components.`);
}
