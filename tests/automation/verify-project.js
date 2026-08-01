"use strict";

const fs = require("node:fs");
const path = require("node:path");
const childProcess = require("node:child_process");

const root = path.resolve(__dirname, "../..");
const versionFile = fs.readFileSync(path.join(root, "version.prop"), "utf8");
const version = versionFile.match(/^version=(.+)$/m)?.[1]?.trim();
const packageVersion =
  versionFile.match(/^package_version=(.+)$/m)?.[1]?.trim();
const releaseDate = versionFile.match(/^release_date=(.+)$/m)?.[1]?.trim();
const sourceExtensions = new Set([".js", ".mjs", ".css", ".html", ".cmd"]);
const metadataExtensions = new Set([
  ...sourceExtensions,
  ".md",
  ".svg",
  ".txt",
]);
const ignoredDirectories = new Set([".git", ".npm-cache", "node_modules"]);
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
[
  "product=Editra",
  "author=",
].forEach((value) => {
  if (!versionFile.includes(value)) errors.push(`version.prop missing ${value}`);
});
if (!/^\d{4}-\d{2}-\d{2}$/.test(releaseDate || "")) {
  errors.push("version.prop release_date must use YYYY-MM-DD");
}

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
  "docs/SECURITY.md",
  "docs/COMPLIANCE.md",
  "docs/PERFORMANCE.md",
  "docs/CDN_MIGRATION.md",
  "docs/FEATURE_GUIDE.md",
  "src/editra.js",
  "src/editra.mjs",
  "index.js",
  "index.mjs",
  "webpack.config.js",
  "playwright.config.js",
  "dist/editra.js",
  "package-lock.json",
  "editra.js",
  "package.json",
  "plugins/pagination.js",
  "plugins/ecosystem.js",
  "plugins/registry.json",
  "plugins/registry.schema.json",
  "docs/PLUGIN_DEVELOPER_GUIDE.md",
  "docs/PLUGIN_REGISTRY_SPEC.md",
  "docs/PLUGIN_MARKETPLACE.md",
  "plugins/languages.js",
  "core/security.js",
  "vendor/purify.min.js",
  "vendor/THIRD_PARTY_LICENSES.md",
  "assets/icons/bold.svg",
  "assets/icons/italic.svg",
  "assets/icons/underline.svg",
  "assets/icons/table.svg",
  "assets/icons/image.svg",
  "assets/icons/video.svg",
  ".github/workflows/security.yml",
  "tests/unit/core-contract.test.js",
  "tests/unit/distribution-contract.test.js",
  "tests/unit/security-contract.test.js",
  "tests/security/browser-security.html",
  "tests/playwright/enterprise.spec.js",
];
requiredFiles.forEach(requireFile);

const indexBuffer = fs.readFileSync(path.join(root, "index.html"));
if (
  indexBuffer.length >= 3 &&
  indexBuffer[0] === 0xef &&
  indexBuffer[1] === 0xbb &&
  indexBuffer[2] === 0xbf
) {
  errors.push("index.html must use UTF-8 without BOM");
}
const indexHTML = indexBuffer.toString("utf8");
if (!/<meta\s+charset=["']?UTF-8["']?\s*\/?>/i.test(indexHTML)) {
  errors.push("index.html is missing an early UTF-8 charset declaration");
}
if (!/<title>Full Editra<\/title>/.test(indexHTML)) {
  errors.push("index.html title must be exactly Full Editra");
}
if (indexHTML.includes("\ufffd")) {
  errors.push("index.html contains a Unicode replacement character");
}

const examples = [
  "full", "hidden-menu", "custom-tools", "sized-editor", "media",
  "multipage", "header-footer", "page-sizes", "custom-print", "tables",
  "shortcuts", "minimal", "word-theme", "classic-theme", "help", "about", "bold",
  "italic", "underline", "ruler", "margins", "export", "theme", "image",
  "video", "formatting", "headings", "lists", "structure", "code-view",
  "productivity", "collaboration", "paste", "feedback-form", "pagination",
  "modular-loading", "plugin-marketplace", "word-div-modular", "word-textarea-modular",
  "classic-textarea-single",
];
examples.forEach((name) => requireFile(`examples/${name}.html`));

const files = walk(root);
const removedBrand = [109, 105, 110, 115, 111, 102, 116]
  .map((code) => String.fromCharCode(code))
  .join("");
const formerSurname = [116, 97, 110, 103, 101, 100, 117, 112, 97, 108, 108, 101]
  .map((code) => String.fromCharCode(code))
  .join("");
const formerGivenName = [97, 115, 105, 102]
  .map((code) => String.fromCharCode(code))
  .join("");
const removedIdentities = [
  [formerSurname, formerGivenName].join("-"),
  [formerSurname, formerGivenName].join(""),
  [formerSurname, "mahammad", formerGivenName].join(" "),
  [formerSurname, formerGivenName].join("."),
];
files
  .filter((file) =>
    [".js", ".mjs", ".css", ".html", ".md", ".json", ".prop", ".cmd"]
      .includes(path.extname(file).toLowerCase()),
  )
  .forEach((file) => {
    const contents = fs.readFileSync(file, "utf8").toLowerCase();
    if (contents.includes(removedBrand)) {
      errors.push(`${relative(file)} contains removed company branding`);
    }
    removedIdentities.forEach((identity) => {
      if (contents.includes(identity)) {
        errors.push(`${relative(file)} contains removed identity ${identity}`);
      }
    });
  });
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

walk(root)
  .filter((file) => metadataExtensions.has(path.extname(file).toLowerCase()))
  .forEach((file) => {
  const content = fs.readFileSync(file, "utf8");
  const beginning = content.slice(0, 900);
  if (
    /^(?:\/\/|\/\*|<!--|REM)?[ \t]*Version:[ \t]*\d+\.\d+\.\d+/i.test(
      beginning,
    ) ||
    /^(?:\/\*{1,2}|<!--)[\s\S]*?Product:[ \t]*Editra[\s\S]*?Purpose:/i.test(
      beginning,
    )
  ) {
    errors.push(`${relative(file)} contains redundant release metadata`);
  }
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
if (!releaseNotes.includes(`Release date: ${releaseDate}`)) {
  errors.push("RELEASE_NOTES.md release date does not match version.prop");
}
const guide = fs.readFileSync(path.join(root, "docs/USER_GUIDE.md"), "utf8");
if (!guide.includes(`Version ${version}`)) {
  errors.push("USER_GUIDE.md version does not match version.prop");
}
const apiReference = fs.readFileSync(
  path.join(root, "docs/API_REFERENCE.md"),
  "utf8",
);
if (!apiReference.includes(`Version ${version}`)) {
  errors.push("API_REFERENCE.md version does not match version.prop");
}
const securityGuide = fs.readFileSync(path.join(root, "docs/SECURITY.md"), "utf8");
if (!securityGuide.includes(`Editra ${version} treats`)) {
  errors.push("SECURITY.md version does not match version.prop");
}
const complianceGuide = fs.readFileSync(
  path.join(root, "docs/COMPLIANCE.md"),
  "utf8",
);
if (!complianceGuide.includes(`Editra ${version}. It is not`)) {
  errors.push("COMPLIANCE.md version does not match version.prop");
}
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
if (packageMetadata.version !== packageVersion) {
  errors.push("package.json version does not match package_version");
}
if (packageMetadata.main !== "index.js") {
  errors.push("package.json main must be index.js");
}
if (
  packageMetadata.repository?.url !==
  "git+https://github.com/editra-js/Editra.git"
) {
  errors.push("package.json repository does not match the Git origin");
}
if (packageMetadata.author !== "Editra Team") {
  errors.push("package.json author must identify the Editra Team");
}
if (packageMetadata.homepage !== "https://editra.in") {
  errors.push("package.json homepage must use the Editra domain");
}
const requiredKeywords = ["wysiwyg", "editor", "html", "pdf", "word"];
if (
  requiredKeywords.some(
    (keyword) => !packageMetadata.keywords?.includes(keyword),
  )
) {
  errors.push("package.json is missing required npm keywords");
}

if (errors.length) {
  console.error(`Editra governance verification failed (${errors.length}):`);
  errors.forEach((error) => console.error(`- ${error}`));
  process.exit(1);
}

console.log(
  `Editra ${version} verified: ${sourceFiles.length} source files, ${examples.length} demos, documentation, license, and syntax checks passed.`,
);
