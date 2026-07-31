"use strict";

const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");

const root = path.resolve(__dirname, "../..");
const core = fs.readFileSync(path.join(root, "core/editor.js"), "utf8");
const version = fs
  .readFileSync(path.join(root, "version.prop"), "utf8")
  .match(/^version=(.+)$/m)?.[1]
  ?.trim();
const requiredMethods = [
  "static async init",
  "executeCommand(",
  "getCode()",
  "getText()",
  "getFormatted()",
  "setCode(",
  "toggleCodeView(",
  "destroy()",
];
const requiredCommands = [
  "insertHeader",
  "insertFooter",
  "setPageSize",
  "setMargin",
  "toggleRuler",
  "selectTable",
  "deleteTable",
  "exportPDF",
  "exportWord",
  "exportHTML",
  "toggleTheme",
];

requiredMethods.forEach((method) =>
  assert.ok(core.includes(method), `Missing public method ${method}`),
);
requiredCommands.forEach((command) =>
  assert.ok(core.includes(command), `Missing command route ${command}`),
);
assert.ok(core.includes(`EditraCore.VERSION = "${version}"`));
assert.ok(core.includes('return "Word"'));
assert.ok(core.includes('return "Classic"'));
assert.ok(core.includes("HTMLTextAreaElement"));
console.log("Editra core API contract passed.");
