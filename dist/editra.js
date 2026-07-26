/*!
 * Product: Editra
 * Author: Editra Team
 * Version: 1.16.0
 * Purpose: Provides the browser-ready Editra UMD distribution for npm CDNs.
 * Licensing: MIT License (open source)
 */
(function webpackUniversalModuleDefinition(root, factory) {
	if(typeof exports === 'object' && typeof module === 'object')
		module.exports = factory();
	else if(typeof define === 'function' && define.amd)
		define([], factory);
	else if(typeof exports === 'object')
		exports["Editra"] = factory();
	else
		root["Editra"] = factory();
})(Object(typeof self !== 'undefined' ? self : this), () => {
return /******/ (() => { // webpackBootstrap
/******/ 	"use strict";
/******/ 	var __webpack_modules__ = ({

/***/ 237
(module) {

/**
 * Product: Editra
 * Author: Editra Team
 * Version: 1.16.0
 * Purpose: Exposes the CommonJS and UMD-compatible Editra package entry API.
 * Licensing: MIT License (open source)
 */



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
  version: "1.16.0",
  packageVersion: "1.0.0",
};
api.default = api;
Object.freeze(api);

module.exports = api;


/***/ }

/******/ 	});
/************************************************************************/
/******/ 	// The module cache
/******/ 	const __webpack_module_cache__ = {};
/******/ 	
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/ 		// Check if module is in cache
/******/ 		const cachedModule = __webpack_module_cache__[moduleId];
/******/ 		if (cachedModule !== undefined) {
/******/ 			return cachedModule.exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		const module = __webpack_module_cache__[moduleId] = {
/******/ 			// no module.id needed
/******/ 			// no module.loaded needed
/******/ 			exports: {}
/******/ 		};
/******/ 	
/******/ 		// Execute the module function
/******/ 		__webpack_modules__[moduleId].call(module.exports, module, module.exports, __webpack_require__);
/******/ 	
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/ 	
/************************************************************************/
/******/ 	
/******/ 	// startup
/******/ 	// Load entry module and return exports
/******/ 	// This entry module is referenced by other modules so it can't be inlined
/******/ 	let __webpack_exports__ = __webpack_require__(237);
/******/ 	
/******/ 	return __webpack_exports__;
/******/ })()
;
});