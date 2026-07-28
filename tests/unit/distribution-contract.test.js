// Version: 2.0.0
/**
 * Product: Editra
 * Version: 2.0.0
 * Purpose: Verifies Editra package metadata, demo integration actions, feedback persistence, and premium styling.
 * Licensing: MIT License (open source)
 */

"use strict";

const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "../..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const metadata = JSON.parse(read("package.json"));
const version = read("version.prop").match(/^version=(.+)$/m)?.[1]?.trim();
const theme = read("ui/theme-premium.css");
const documentTheme = read("themes/premium.css");
const demos = read("examples/demo.js");
const feedback = read("examples/feedback-form.html");
const guide = read("docs/USER_GUIDE.md");
const pagination = read("plugins/pagination.js");
const tablePlugin = read("plugins/table.js");
const exportPlugin = read("plugins/export.js");

assert.equal(metadata.name, "editra-js");
assert.equal(metadata.version, version);
assert.equal(metadata.description, "Premium WYSIWYG Editor for the Web");
assert.equal(metadata.license, "MIT");
assert.equal(metadata.main, "index.js");
assert.equal(metadata.module, "index.mjs");
assert.equal(
  metadata.repository.url,
  "git+https://github.com/editra-js/Editra.git",
);
assert.deepEqual(metadata.keywords, [
  "wysiwyg",
  "editor",
  "html",
  "pdf",
  "word",
]);
assert(metadata.files.includes("plugins"));
assert(metadata.files.includes("themes"));
assert(metadata.files.includes("vendor"));

assert.match(
  theme,
  /\.editra-card\s*\{[\s\S]*?border-radius:\s*0\s*!important/,
);
assert.match(
  theme,
  /\.editra-editor\s*\{[\s\S]*?border-radius:\s*0\s*!important/,
);
assert.match(theme, /background:\s*#2b78d4\s*!important/);
assert.match(theme, /color:\s*#fff\s*!important/);

["Get Code", "Get HTML", "Insert on Focus"].forEach((label) => {
  assert(demos.includes(`"${label}"`), `Missing shared ${label} action`);
});
assert(demos.includes("editra.feedback.v1"));
assert(demos.includes("localStorage.setItem"));
assert(feedback.includes('name="name"'));
assert(feedback.includes('name="gender"'));
assert(feedback.includes('id="editra-editor"'));
assert(feedback.includes("data-saved-html"));
assert(feedback.includes("data-saved-text"));

assert(guide.includes("npm install editra-js"));
assert(guide.includes("https://cdn.jsdelivr.net/npm/editra-js/dist/editra.min.js"));
assert(guide.includes("https://unpkg.com/editra-js/dist/editra.min.js"));
assert(
  guide.includes(
    "https://cdn.jsdelivr.net/gh/editra-js/Editra@v1.0.0/dist/editra.js",
  ),
);
assert(guide.includes("../examples/feedback-form.html"));
assert(guide.includes("../examples/pagination.html"));

[
  "setPaginationRules",
  "toggleKeepTogether",
  "setListItemSplitting",
  "setTablePagination",
  "setCodeBlockSplitting",
  "KeepWithNext",
  "InsertPageBreak",
].forEach((command) => {
  assert(pagination.includes(command), `Missing pagination command ${command}`);
});
assert(pagination.includes("requestAnimationFrame"));
assert(documentTheme.includes("data-editra-keep-table-together"));
assert(tablePlugin.includes("createTHead"));
assert(tablePlugin.includes("editraRepeatHeader"));
assert(exportPlugin.includes("splitTableAcrossPages"));
assert(exportPlugin.includes("table-header-group"));
assert(demos.includes('pagination: {}'));

console.log("Editra distribution and end-user integration contract passed.");
