/**
 * Product: Editra
 * Author: Editra Team
 * Version: 1.16.0
 * Purpose: Verifies CommonJS package exports and selector-based initialization.
 * Licensing: MIT License (open source)
 */

"use strict";

const Editra = require("../../index.js");

describe("Editra package entry", () => {
  afterEach(() => {
    delete globalThis.EditraCore;
  });

  test("exports the CommonJS API", () => {
    expect(Editra.default).toBe(Editra);
    expect(Editra.init).toEqual(expect.any(Function));
    expect(Editra.load).toEqual(expect.any(Function));
    expect(Editra.packageVersion).toBe("1.0.0");
  });

  test("normalizes selector and options", async () => {
    const instance = { id: "editor-instance" };
    globalThis.EditraCore = {
      init: jest.fn().mockResolvedValue(instance),
    };

    await expect(
      Editra.init("#editra-editor", { theme: "premium" }),
    ).resolves.toBe(instance);
    expect(globalThis.EditraCore.init).toHaveBeenCalledWith({
      selector: "#editra-editor",
      theme: "premium",
    });
  });

  test("retains config-object compatibility", async () => {
    globalThis.EditraCore = {
      init: jest.fn().mockResolvedValue({}),
    };
    await Editra.init({
      selector: "#editra-editor",
      plugins: ["bold"],
    });
    expect(globalThis.EditraCore.init).toHaveBeenCalledWith({
      selector: "#editra-editor",
      plugins: ["bold"],
    });
  });
});
