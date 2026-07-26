/**
 * © Minsoft. All rights reserved.
 * Product: Editra (Minsoft product)
 * Author: Editra Team
 * Version: 1.15.0
 * Purpose: Enforces Editra release metadata, headers, documentation, demos, and JavaScript syntax.
 * Licensing: MIT License (open source)
 */

"use strict";

const fs = require("node:fs");
const path = require("node:path");
const childProcess = require("node:child_process");

const root = path.resolve(__dirname, "../..");
const versionFile = fs.readFileSync(path.join(root, "version.prop"), "utf8");
const version = versionFile.match(/^version=(.+)$/m)?.[1]?.trim();
const requiredHeader = [
  "© Minsoft. All rights reserved.",
  "Product: Editra (Minsoft product)",
  "Author: Editra Team",
  `Version: ${version}`,
  "Purpose:",
  "Licensing: MIT License (open source)",
];
const sourceExtensions = new Set([".js", ".mjs", ".css", ".html", ".cmd"]);
const ignoredDirectories = new Set([".git"]);
const errors = [];

function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    if (ignoredDirectories.has(entry.name)) return [];
    const absolute = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(absolute) : [absolute];
  });
}

function relative(file) {
  return path.relative(root, file).replaceAll("\\", "/");
}

function requireFile(file) {
  if (!fs.existsSync(path.join(root, file))) errors.push(`Missing ${file}`);
}

if (!version) errors.push("version.prop has no version value");
["product=Editra", "release_date=2026-07-26"].forEach((value) => {
  if (!versionFile.includes(value)) errors.push(`version.prop missing ${value}`);
});

const requiredFiles = [
  "README.md",
  "LICENSE.md",
  "RELEASE_NOTES.md",
  "CONTRIBUTING.md",
  "docs/USER_GUIDE.md",
  "docs/API_REFERENCE.md",
  "docs/HELP.md",
  "docs/ABOUT.md",
  "docs/CONTRIBUTING.md",
  "docs/ROADMAP.md",
  "src/editra.js",
  "src/editra.mjs",
  "editra.js",
  "package.json",
  "tests/unit/core-contract.test.js",
  "tests/unit/distribution-contract.test.js",
];
requiredFiles.forEach(requireFile);

const examples = [
  "full", "hidden-menu", "custom-tools", "sized-editor", "media",
  "multipage", "header-footer", "page-sizes", "custom-print", "tables",
  "shortcuts", "minimal", "premium-ui", "help", "about", "bold",
  "italic", "underline", "ruler", "margins", "export", "theme", "image",
  "video", "formatting", "headings", "lists", "structure", "code-view",
  "productivity", "collaboration", "paste", "feedback-form",
];
examples.forEach((name) => requireFile(`examples/${name}.html`));

const files = walk(root);
const sourceFiles = files.filter((file) =>
  sourceExtensions.has(path.extname(file).toLowerCase()),
);

function validateLocalReference(owner, reference) {
  if (
    !reference ||
    reference.startsWith("#") ||
    /^(?:https?:|mailto:|tel:|data:|javascript:)/i.test(reference)
  ) return;

  const cleanReference = reference.split(/[?#]/, 1)[0];
  let decodedReference = cleanReference;
  try {
    decodedReference = decodeURIComponent(cleanReference);
  } catch {
    errors.push(`${relative(owner)} has an invalid encoded link: ${reference}`);
    return;
  }

  const target = path.resolve(path.dirname(owner), decodedReference);
  if (!fs.existsSync(target)) {
    errors.push(`${relative(owner)} links to missing file: ${reference}`);
  }
}

files
  .filter((file) => path.extname(file).toLowerCase() === ".md")
  .forEach((file) => {
    const content = fs.readFileSync(file, "utf8");
    for (const match of content.matchAll(/\[[^\]]*]\(([^)]+)\)/g)) {
      validateLocalReference(file, match[1]);
    }
  });

sourceFiles
  .filter((file) => path.extname(file).toLowerCase() === ".html")
  .forEach((file) => {
    const content = fs.readFileSync(file, "utf8");
    for (const match of content.matchAll(/\b(?:href|src)=["']([^"']+)["']/gi)) {
      validateLocalReference(file, match[1]);
    }
  });

sourceFiles.forEach((file) => {
  const content = fs.readFileSync(file, "utf8");
  requiredHeader.forEach((field) => {
    if (!content.slice(0, 700).includes(field)) {
      errors.push(`${relative(file)} missing header field: ${field}`);
    }
  });
});

sourceFiles
  .filter((file) => [".js", ".mjs"].includes(path.extname(file).toLowerCase()))
  .forEach((file) => {
    const result = childProcess.spawnSync(process.execPath, ["--check", file], {
      encoding: "utf8",
    });
    if (result.status !== 0) {
      errors.push(`${relative(file)} syntax error: ${result.stderr.trim()}`);
    }
  });

const releaseNotes = fs.readFileSync(path.join(root, "RELEASE_NOTES.md"), "utf8");
if (!releaseNotes.includes(`Version ${version}`)) {
  errors.push("RELEASE_NOTES.md version does not match version.prop");
}
const guide = fs.readFileSync(path.join(root, "docs/USER_GUIDE.md"), "utf8");
examples.forEach((name) => {
  if (!guide.includes(`examples/${name}.html`) && !["about", "help"].includes(name)) {
    errors.push(`USER_GUIDE.md does not link examples/${name}.html`);
  }
});
const license = fs.readFileSync(path.join(root, "LICENSE.md"), "utf8");
if (!license.includes("Permission is hereby granted, free of charge")) {
  errors.push("LICENSE.md does not contain the MIT grant");
}
const core = fs.readFileSync(path.join(root, "core/editor.js"), "utf8");
if (!core.includes(`EditraCore.VERSION = "${version}"`)) {
  errors.push("Core runtime version does not match version.prop");
}
const packageMetadata = JSON.parse(
  fs.readFileSync(path.join(root, "package.json"), "utf8"),
);
if (packageMetadata.version !== version) {
  errors.push("package.json version does not match version.prop");
}

if (errors.length) {
  console.error(`Editra governance verification failed (${errors.length}):`);
  errors.forEach((error) => console.error(`- ${error}`));
  process.exit(1);
}

console.log(
  `Editra ${version} verified: ${sourceFiles.length} source files, ${examples.length} demos, documentation, license, and syntax checks passed.`,
);
