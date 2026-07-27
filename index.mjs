/**
 * Product: Editra
 * Author: Editra Team
 * Version: 1.17.0
 * Purpose: Exposes the native ES-module Editra package entry API.
 * Licensing: MIT License (open source)
 */

const host = globalThis;
const moduleRoot = new URL("./", import.meta.url);
let runtimePromise = null;

function load(baseUrl) {
  if (host.EditraCore?.init) return Promise.resolve(host.EditraCore);
  if (runtimePromise) return runtimePromise;
  if (typeof document === "undefined") {
    return Promise.reject(
      new Error("Editra can only initialize in a browser document."),
    );
  }

  const root = baseUrl
    ? new URL(
        String(baseUrl).endsWith("/") ? String(baseUrl) : `${baseUrl}/`,
        document.baseURI,
      )
    : moduleRoot;
  const coreURL = new URL("core/editor.js", root);
  runtimePromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = coreURL.href;
    script.async = true;
    script.addEventListener(
      "load",
      () => {
        if (!host.EditraCore?.init) {
          runtimePromise = null;
          reject(new Error(`Invalid Editra runtime at ${coreURL.href}`));
          return;
        }
        resolve(host.EditraCore);
      },
      { once: true },
    );
    script.addEventListener(
      "error",
      () => {
        runtimePromise = null;
        reject(new Error(`Unable to load Editra from ${coreURL.href}`));
      },
      { once: true },
    );
    document.head.append(script);
  });
  return runtimePromise;
}

function normalizeConfig(selector, options) {
  if (selector && typeof selector === "object" && options === undefined) {
    return { ...selector };
  }
  return {
    ...(options && typeof options === "object" ? options : {}),
    selector,
  };
}

async function init(selector, options) {
  const config = normalizeConfig(selector, options);
  const baseUrl = config.baseUrl;
  delete config.baseUrl;
  const Runtime = await load(baseUrl);
  return Runtime.init(config);
}

const Editra = Object.freeze({
  init,
  load,
  version: "1.17.0",
  packageVersion: "1.1.0",
});

export { init, load };
export default Editra;
