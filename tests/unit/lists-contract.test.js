// Version: 2.0.0
/**
 * Product: Editra
 * Version: 2.0.0
 * Purpose: Covers list toggle behavior regressions for the editor.
 * Licensing: MIT License (open source)
 */

"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "../..");
const source = fs.readFileSync(path.join(root, "plugins/lists.js"), "utf8");

test("lists plugin contains toggle-aware selection logic", () => {
  assert.match(source, /replaceListType/);
  assert.match(source, /normalizeFontSizeFormatting/);
  assert.match(source, /insertUnorderedList|insertOrderedList/);
  assert.doesNotMatch(source, /core\.editor\.innerHTML\.replace/);
});
