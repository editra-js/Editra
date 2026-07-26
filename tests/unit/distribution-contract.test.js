/**
 * © Minsoft. All rights reserved.
 * Product: Editra (Minsoft product)
 * Author: Editra Team
 * Version: 1.15.0
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
const theme = read("ui/theme-premium.css");
const demos = read("examples/demo.js");
const feedback = read("examples/feedback-form.html");
const guide = read("docs/USER_GUIDE.md");

assert.equal(metadata.name, "editra");
assert.equal(metadata.version, "1.15.0");
assert.equal(metadata.license, "MIT");
assert.equal(metadata.module, "./src/editra.mjs");
assert(metadata.files.includes("plugins"));
assert(metadata.files.includes("themes"));

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

assert(guide.includes("npm install editra"));
assert(guide.includes("https://cdn.minsoft.com/editra/latest/editra.js"));
assert(guide.includes("../examples/feedback-form.html"));

console.log("Editra distribution and end-user integration contract passed.");
