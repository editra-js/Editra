/**
 * CommonJS and browser-compatible package entry for Editra.
 *
 * The entry stays small and loads the browser runtime only when needed. This
 * preserves the modular source layout and supports self-hosted asset URLs.
 */
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
let runtimeIntegrity = "";
let isolationPromise = null;
let isolationIntegrity = "";
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

function regulatedRuntime(config) {
  return (
    config?.regulated === true ||
    String(config?.security?.profile ?? "").trim().toLowerCase() ===
      "regulated"
  );
}

/**
 * Loads the core browser runtime once and reuses it for later editor instances.
 *
 * @param {string|URL} [baseUrl] Base URL containing Editra runtime assets.
 * @param {object|null} [config=null] Security options used while loading.
 * @returns {Promise<object>} Runtime object exposing `init(config)`.
 */
function loadRuntime(baseUrl, config = null) {
  const regulated = regulatedRuntime(config);
  const expectedIntegrity = config?.security?.pluginIntegrity?.["core/editor.js"] || "";
  if (regulated && !expectedIntegrity) {
    return Promise.reject(
      new TypeError("Editra regulated mode requires an integrity hash for core/editor.js."),
    );
  }
  if (host.EditraCore?.init) {
    if (regulated && runtimeIntegrity !== expectedIntegrity) {
      return Promise.reject(
        new TypeError("Editra regulated mode cannot reuse an unverified core/editor.js runtime."),
      );
    }
    return Promise.resolve(host.EditraCore);
  }
  if (runtimePromise) {
    if (regulated && runtimeIntegrity !== expectedIntegrity) {
      return Promise.reject(
        new TypeError("Editra regulated mode cannot reuse an unverified core/editor.js runtime."),
      );
    }
    return runtimePromise;
  }
  if (typeof document === "undefined") {
    return Promise.reject(
      new Error("Editra can only initialize in a browser document."),
    );
  }

  const coreURL = new URL("core/editor.js", distributionRoot(baseUrl));
  if (regulated && coreURL.origin !== host.location.origin) {
    return Promise.reject(
      new TypeError("Editra regulated mode requires a same-origin runtime."),
    );
  }
  runtimeIntegrity = expectedIntegrity;
  runtimePromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = loaderPolicy?.createScriptURL
      ? loaderPolicy.createScriptURL(coreURL.href)
      : coreURL.href;
    script.async = true;
    if (expectedIntegrity) {
      script.integrity = expectedIntegrity;
      script.crossOrigin = "anonymous";
    }
    script.addEventListener(
      "load",
      () => {
        if (!host.EditraCore?.init) {
          runtimePromise = null;
          runtimeIntegrity = "";
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
        runtimeIntegrity = "";
        reject(new Error(`Unable to load Editra from ${coreURL.href}`));
      },
      { once: true },
    );
    document.head.append(script);
  });
  return runtimePromise;
}

function loadIsolation(baseUrl, config = null) {
  const regulated = regulatedRuntime(config);
  const expectedIntegrity =
    config?.security?.pluginIntegrity?.["isolation/host.js"] || "";
  if (regulated && !expectedIntegrity) {
    return Promise.reject(
      new TypeError(
        "Editra regulated isolation requires an integrity hash for isolation/host.js.",
      ),
    );
  }
  if (host.EditraIsolationHost?.init) {
    if (regulated && isolationIntegrity !== expectedIntegrity) {
      return Promise.reject(
        new TypeError("Editra regulated mode cannot reuse an unverified isolation host."),
      );
    }
    return Promise.resolve(host.EditraIsolationHost);
  }
  if (isolationPromise) {
    if (regulated && isolationIntegrity !== expectedIntegrity) {
      return Promise.reject(
        new TypeError("Editra regulated mode cannot reuse an unverified isolation host."),
      );
    }
    return isolationPromise;
  }
  if (typeof document === "undefined") {
    return Promise.reject(new Error("Editra isolation requires a browser document."));
  }
  const isolationURL = new URL("isolation/host.js", distributionRoot(baseUrl));
  if (regulated && isolationURL.origin !== host.location.origin) {
    return Promise.reject(
      new TypeError("Editra regulated mode requires a same-origin isolation loader."),
    );
  }
  isolationIntegrity = expectedIntegrity;
  isolationPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = loaderPolicy?.createScriptURL
      ? loaderPolicy.createScriptURL(isolationURL.href)
      : isolationURL.href;
    script.async = true;
    if (expectedIntegrity) {
      script.integrity = expectedIntegrity;
      script.crossOrigin = "anonymous";
    }
    script.addEventListener("load", () => {
      if (!host.EditraIsolationHost?.init) {
        isolationPromise = null;
        isolationIntegrity = "";
        reject(new Error(`Invalid Editra isolation host at ${isolationURL.href}`));
        return;
      }
      resolve(host.EditraIsolationHost);
    }, { once: true });
    script.addEventListener("error", () => {
      isolationPromise = null;
      isolationIntegrity = "";
      reject(new Error(`Unable to load Editra isolation from ${isolationURL.href}`));
    }, { once: true });
    document.head.append(script);
  });
  return isolationPromise;
}

/** Accepts both `init(config)` and `init(selector, options)` call styles. */
function normalizeConfig(selector, options) {
  if (selector && typeof selector === "object" && options === undefined) {
    return { ...selector };
  }
  return {
    ...(options && typeof options === "object" ? options : {}),
    selector,
  };
}

/**
 * Initializes a normal or iframe-isolated Editra instance.
 *
 * @param {string|HTMLElement|object} selector Host selector or full config.
 * @param {object} [options] Options used with the selector call style.
 * @returns {Promise<object>} Ready editor instance or isolation proxy.
 */
async function init(selector, options) {
  const config = normalizeConfig(selector, options);
  const baseUrl = config.baseUrl;
  delete config.baseUrl;
  if (config.isolation === "iframe") {
    const IsolationHost = await loadIsolation(baseUrl, config);
    return IsolationHost.init(config);
  }
  const Runtime = await loadRuntime(baseUrl, config);
  return Runtime.init(config);
}

const api = {
  init,
  load: loadRuntime,
  version: "1.1.1",
  packageVersion: "1.1.1",
};
api.default = api;
Object.freeze(api);

module.exports = api;
