// Version: 2.0.0
/**
 * Product: Editra
 * Version: 2.0.0
 * Purpose: Synchronizes release metadata and version headers from version.prop.
 * Licensing: MIT License (open source)
 */

"use strict";

const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const versionFile = path.join(root, "version.prop");
const packageFile = path.join(root, "package.json");
const releaseNotesFile = path.join(root, "RELEASE_NOTES.md");
const packageName = "editra-js";
const releaseMetadata = fs.readFileSync(versionFile, "utf8");
const author = releaseMetadata.match(/^author=(.+)$/m)?.[1]?.trim() || "";
const supportedExtensions = new Set([
  ".js",
  ".mjs",
  ".css",
  ".html",
  ".md",
  ".cmd",
]);
const ignoredDirectories = new Set([".git", ".npm-cache", "node_modules"]);

function readVersion() {
  const contents = fs.readFileSync(versionFile, "utf8");
  const version = contents.match(/^version=(.+)$/m)?.[1]?.trim();
  if (!version) throw new Error("version.prop must define a version value.");
  return version;
}

function headerFor(extension, version) {
  switch (extension) {
    case ".js":
    case ".mjs":
      return `// Version: ${version}`;
    case ".css":
      return `/* Version: ${version} */`;
    case ".html":
      return `<!-- Version: ${version} -->`;
    case ".md":
      return `Version: ${version}`;
    case ".cmd":
      return `REM Version: ${version}`;
    default:
      throw new Error(`Unsupported version header extension: ${extension}`);
  }
}

function headerPattern(extension) {
  switch (extension) {
    case ".js":
    case ".mjs":
      return /^\/\/ Version:.*(?:\r?\n|$)/;
    case ".css":
      return /^\/\* Version:.*?\*\/(?:\r?\n|$)/;
    case ".html":
      return /^<!-- Version:.*?-->(?:\r?\n|$)/;
    case ".md":
      return /^Version:.*(?:\r?\n|$)/;
    case ".cmd":
      return /^REM Version:.*(?:\r?\n|$)/;
    default:
      throw new Error(`Unsupported version header extension: ${extension}`);
  }
}

function updateHeader(file, version) {
  const extension = path.extname(file).toLowerCase();
  const original = fs.readFileSync(file, "utf8");
  const bom = original.startsWith("\uFEFF") ? "\uFEFF" : "";
  const contents = (bom ? original.slice(1) : original).replace(/\r\n?/g, "\n");
  const newline = "\n";
  const header = headerFor(extension, version);
  const metadataVersions = contents.replace(
    /^(\s*(?:(?:\/\/|REM|\*)\s*)?Version:\s*).*(?:\r?\n|$)/gm,
    `$1${version}${newline}`,
  );
  const escapedAuthor = author.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const authorLine = new RegExp(
    `^[ \\t]*(?:(?:\\/\\/|REM|\\*|<!--)[ \\t]*)?Author:[ \\t]*${escapedAuthor}[ \\t]*(?:-->)?[ \\t]*(?:\\n|$)`,
    "gim",
  );
  const inlineAuthor = new RegExp(
    `[ \\t]*Author:[ \\t]*${escapedAuthor}[ \\t]*\\|`,
    "gi",
  );
  const authoredBy = new RegExp(`authored by ${escapedAuthor}`, "gi");
  const withoutAuthor = metadataVersions
    .replace(authorLine, "")
    .replace(inlineAuthor, " ")
    .replace(authoredBy, "maintained by the Editra contributors");
  const updated = headerPattern(extension).test(withoutAuthor)
    ? withoutAuthor.replace(headerPattern(extension), `${header}${newline}`)
    : `${header}${newline}${withoutAuthor}`;

  const serialized = `${bom}${updated}`;
  if (serialized !== original) fs.writeFileSync(file, serialized);
}

function walk(directory, files) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (ignoredDirectories.has(entry.name)) continue;
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) walk(absolute, files);
    else if (supportedExtensions.has(path.extname(entry.name).toLowerCase())) {
      files.push(absolute);
    }
  }
}

function updatePackageVersion(version) {
  const packageMetadata = JSON.parse(fs.readFileSync(packageFile, "utf8"));
  packageMetadata.version = version;
  packageMetadata.name = packageName;
  delete packageMetadata.author;
  fs.writeFileSync(packageFile, `${JSON.stringify(packageMetadata, null, 2)}\n`);
}

function replaceInFile(file, pattern, replacement) {
  const contents = fs.readFileSync(file, "utf8");
  const updated = contents.replace(pattern, replacement);
  if (updated !== contents) fs.writeFileSync(file, updated);
}

function updateRuntimeVersions(version) {
  replaceInFile(
    releaseNotesFile,
    /^## Version .+$/m,
    `## Version ${version}`,
  );
  replaceInFile(
    path.join(root, "core", "editor.js"),
    /EditraCore\.VERSION\s*=\s*"[^"]+"/,
    `EditraCore.VERSION = "${version}"`,
  );
  ["index.js", "index.mjs"].forEach((file) => {
    replaceInFile(
      path.join(root, file),
      /(packageVersion|version):\s*"[^"]+"/g,
      (_, key) => `${key}: "${version}"`,
    );
  });
  replaceInFile(
    path.join(root, "README.md"),
    /Version [\d.]+ is licensed/,
    `Version ${version} is licensed`,
  );
  replaceInFile(
    path.join(root, "README.md"),
    /Package version: .+/,
    `Package version: ${version}`,
  );
}

function updateAdditionalMetadata() {
  const textFiles = [
    path.join(root, "LICENSE"),
    ...fs.readdirSync(path.join(root, "assets", "icons")).map((file) =>
      path.join(root, "assets", "icons", file),
    ),
  ];
  textFiles.forEach((file) => {
    if (!fs.existsSync(file) || file === versionFile) return;
    const contents = fs.readFileSync(file, "utf8");
    const escapedAuthor = author.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const updated = contents
      .replace(
        new RegExp(`\\s*\\|\\s*Author:\\s*${escapedAuthor}\\s*`, "gi"),
        " ",
      )
      .replace(
        new RegExp(`Copyright \\(c\\) 2026 ${escapedAuthor}`, "g"),
        "Copyright (c) 2026 Editra contributors",
      );
    if (updated !== contents) fs.writeFileSync(file, updated);
  });
}

const version = readVersion();
const files = [];
walk(root, files);
updatePackageVersion(version);
files.sort().forEach((file) => updateHeader(file, version));
updateRuntimeVersions(version);
updateAdditionalMetadata();

console.log(`Synchronized version ${version} in package metadata and ${files.length} headers.`);
