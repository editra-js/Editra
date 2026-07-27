// Version: 2.0.0
/**
 * Product: Editra
 * Author: Editra Team
 * Version: 2.0.0
 * Purpose: Verifies CommonJS package exports and selector-based initialization.
 * Licensing: MIT License (open source)
 */

"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Editra = require("../../index.js");
const packageMetadata = require("../../package.json");

test.afterEach(() => {
  delete globalThis.EditraCore;
});

test("exports the CommonJS API", () => {
  assert.equal(Editra.default, Editra);
  assert.equal(typeof Editra.init, "function");
  assert.equal(typeof Editra.load, "function");
  assert.equal(Editra.packageVersion, packageMetadata.version);
});

test("normalizes selector and options", async () => {
  const calls = [];
  const instance = { id: "editor-instance" };
  globalThis.EditraCore = {
    async init(config) {
      calls.push(config);
      return instance;
    },
  };
  assert.equal(
    await Editra.init("#editra-editor", { theme: "premium" }),
    instance,
  );
  assert.deepEqual(calls[0], {
    selector: "#editra-editor",
    theme: "premium",
  });
});

test("retains config-object compatibility", async () => {
  const calls = [];
  globalThis.EditraCore = {
    async init(config) {
      calls.push(config);
      return {};
    },
  };
  await Editra.init({
    selector: "#editra-editor",
    plugins: ["bold"],
  });
  assert.deepEqual(calls[0], {
    selector: "#editra-editor",
    plugins: ["bold"],
  });
});
