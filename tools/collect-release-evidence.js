"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const root = path.resolve(__dirname, "..");
const outputArgument = process.argv[process.argv.indexOf("--output") + 1];
const output = path.resolve(root, outputArgument || "artifacts/release-evidence.json");
const files = [
  "package.json",
  "package-lock.json",
  "artifacts/editra-sbom.cdx.json",
  "dist/editra.js",
  "dist/editra.min.js",
  "plugins/runtime-integrity.json",
];
const git = (args) => {
  try {
    return execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();
  } catch {
    return "unavailable";
  }
};
const evidence = {
  schemaVersion: "1.0.0",
  generatedAt: new Date().toISOString(),
  package: require(path.join(root, "package.json")).name,
  version: require(path.join(root, "package.json")).version,
  source: {
    commit: git(["rev-parse", "HEAD"]),
    ref: process.env.GITHUB_REF || git(["branch", "--show-current"]),
    dirty: git(["status", "--porcelain"]) !== "",
    repository: process.env.GITHUB_REPOSITORY || "editra-js/Editra",
    runId: process.env.GITHUB_RUN_ID || null,
  },
  runtime: { node: process.version, platform: process.platform, architecture: process.arch },
  files: files.map((relativePath) => ({
    path: relativePath,
    sha256: crypto.createHash("sha256").update(fs.readFileSync(path.join(root, relativePath))).digest("hex"),
  })),
};
fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, `${JSON.stringify(evidence, null, 2)}\n`);
console.log(`Release evidence written to ${path.relative(root, output)}.`);
