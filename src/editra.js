/**
 * Product: Editra
 * Author: Editra Team
 * Version: 1.16.0
 * Purpose: Provides an optional distribution loader for the canonical Editra core runtime.
 * Licensing: MIT License (open source)
 */

(function (global) {
  "use strict";

  if (global.Editra) {
    global.EditraReady = Promise.resolve(global.Editra);
    return;
  }

  const source = document.currentScript;
  const coreURL = new URL("../core/editor.js", source.src);
  const ready = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = coreURL.href;
    script.addEventListener("load", () => resolve(global.Editra), {
      once: true,
    });
    script.addEventListener(
      "error",
      () => reject(new Error(`Unable to load Editra from ${coreURL.href}`)),
      { once: true },
    );
    document.head.append(script);
  });
  global.EditraReady = ready;
  global.Editra = {
    init: async (config) => {
      const Runtime = await ready;
      return Runtime.init(config);
    },
  };
})(window);
