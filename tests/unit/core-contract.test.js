/**
 * © Minsoft. All rights reserved.
 * Product: Editra (Minsoft product)
 * Author: Editra Team
 * Version: 1.15.0
 * Purpose: Verifies the documented Editra public API and command routing contract.
 * Licensing: MIT License (open source)
 */

"use strict";

const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");

const root = path.resolve(__dirname, "../..");
const core = fs.readFileSync(path.join(root, "core/editor.js"), "utf8");
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
assert.ok(core.includes('EditraCore.VERSION = "1.15.0"'));
console.log("Editra core API contract passed.");
