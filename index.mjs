const host = globalThis;
const moduleRoot = new URL("./", import.meta.url);
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
  version: "1.0.0",
  packageVersion: "1.0.0",
});

export { init, load };
export default Editra;
