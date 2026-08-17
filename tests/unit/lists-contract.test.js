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
  assert.match(source, /setBulletListStyle/);
  assert.match(source, /setNumberListStyle/);
  assert.match(source, /dataset\.editraListStyle/);
  assert.match(source, /BULLET_STYLES/);
  assert.match(source, /NUMBER_STYLES/);
  assert.match(source, /promoteSelectedRootInlineContent/);
  assert.match(source, /function listScope/);
  assert.doesNotMatch(source, /core\.editor\.innerHTML\.replace/);
});
