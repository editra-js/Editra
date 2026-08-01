"use strict";

const host =
  typeof globalThis !== "undefined"
    ? globalThis
    : typeof self !== "undefined"
      ? self
      : this;
const entryScriptURL =
  typeof document !== "undefined" && document.currentScript?.src
    ? document.currentScript.src
    : null;
let runtimePromise = null;
const loaderPolicySymbol = Symbol.for("editra.loaderPolicy");
let loaderPolicy = host[loaderPolicySymbol] ?? null;
if (!loaderPolicy && host.trustedTypes?.createPolicy) {
  try {
    loaderPolicy = host.trustedTypes.createPolicy("editra-loader", {
      createScriptURL(value) {
        const url = new URL(String(value), document.baseURI);
        if (url.origin !== host.location.origin) {
          throw new TypeError("Editra blocked a cross-origin runtime script.");
        }
        return url.href;
      },
    });
  } catch {
    loaderPolicy = null;
  }
}
host[loaderPolicySymbol] = loaderPolicy;

function distributionRoot(baseUrl) {
  if (baseUrl) {
    return new URL(
      String(baseUrl).endsWith("/") ? String(baseUrl) : `${baseUrl}/`,
      typeof document !== "undefined" ? document.baseURI : undefined,
    );
  }
  if (!entryScriptURL) {
    throw new Error(
      "Editra requires a browser document or an explicit options.baseUrl.",
    );
  }
  const entry = new URL(entryScriptURL);
  return /\/dist\/[^/]+$/i.test(entry.pathname)
    ? new URL("../", entry)
    : new URL("./", entry);
}

function loadRuntime(baseUrl) {
  if (host.EditraCore?.init) return Promise.resolve(host.EditraCore);
  if (runtimePromise) return runtimePromise;
  if (typeof document === "undefined") {
    return Promise.reject(
      new Error("Editra can only initialize in a browser document."),
    );
  }

  const coreURL = new URL("core/editor.js", distributionRoot(baseUrl));
  runtimePromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = loaderPolicy?.createScriptURL
      ? loaderPolicy.createScriptURL(coreURL.href)
      : coreURL.href;
    script.async = true;
    script.addEventListener(
      "load",
      () => {
        if (!host.EditraCore?.init) {
          runtimePromise = null;
          reject(new Error(`Invalid Editra runtime at ${coreURL.href}`));
          return;
        }
        host.Editra = api;
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
  const Runtime = await loadRuntime(baseUrl);
  return Runtime.init(config);
}

const api = {
  init,
  load: loadRuntime,
  version: "1.0.0",
  packageVersion: "1.0.0",
};
api.default = api;
Object.freeze(api);

module.exports = api;
