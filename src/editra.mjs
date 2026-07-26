/**
 * Product: Editra
 * Author: Editra Team
 * Version: 1.16.0
 * Purpose: Exposes an ES-module loader for npm-based Editra integrations.
 * Licensing: MIT License (open source)
 */

const runtimeURL = new URL("../core/editor.js", import.meta.url);

const ready =
  globalThis.Editra
    ? Promise.resolve(globalThis.Editra)
    : new Promise((resolve, reject) => {
        const script = document.createElement("script");
        script.src = runtimeURL.href;
        script.addEventListener("load", () => resolve(globalThis.Editra), {
          once: true,
        });
        script.addEventListener(
          "error",
          () => reject(new Error(`Unable to load Editra from ${runtimeURL.href}`)),
          { once: true },
        );
        document.head.append(script);
      });

const Editra = Object.freeze({
  ready,
  async init(config) {
    const Runtime = await ready;
    return Runtime.init(config);
  },
});

export { ready };
export default Editra;
