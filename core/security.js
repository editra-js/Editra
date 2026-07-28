// Version: 2.0.0
/**
 * Product: Editra
 * Version: 2.0.0
 * Purpose: Enforces HTML sanitization, document limits, safe URLs, Trusted Types, and security telemetry.
 * Licensing: MIT License (open source)
 */

(function (global) {
  "use strict";

  const DEFAULT_LIMITS = Object.freeze({
    maxDocumentBytes: 5 * 1024 * 1024,
    maxNodes: 50000,
    maxDepth: 100,
    maxMediaBytes: 10 * 1024 * 1024,
    maxCommandsPerSecond: 120,
  });
  const FORBID_TAGS = Object.freeze([
    "script",
    "style",
    "iframe",
    "object",
    "embed",
    "applet",
    "base",
    "meta",
    "link",
    "form",
  ]);
  const FORBID_ATTR = Object.freeze([
    "srcdoc",
    "action",
    "formaction",
    "nonce",
    "ping",
  ]);
  const URL_ATTRIBUTES = new Set([
    "href",
    "src",
    "poster",
    "cite",
    "background",
    "xlink:href",
  ]);
  const UNSAFE_CSS =
    /(?:expression\s*\(|url\s*\(|@import|behavior\s*:|-moz-binding|javascript\s*:|vbscript\s*:)/i;
  const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f-\u009f\s]+/g;

  function bytes(value) {
    const text = String(value ?? "");
    return typeof TextEncoder === "function"
      ? new TextEncoder().encode(text).byteLength
      : new Blob([text]).size;
  }

  function normalizedSecurity(options = {}) {
    const supplied =
      options.security && typeof options.security === "object"
        ? options.security
        : {};
    return Object.freeze({
      enabled: supplied.enabled !== false,
      sanitize: supplied.sanitize !== false,
      allowDataImages: supplied.allowDataImages !== false,
      allowBlobUrls: supplied.allowBlobUrls !== false,
      allowIframes: supplied.allowIframes === true,
      allowedIframeHosts: Object.freeze(
        Array.isArray(supplied.allowedIframeHosts)
          ? supplied.allowedIframeHosts.map((host) =>
              String(host).trim().toLowerCase(),
            )
          : [],
      ),
      allowedPluginOrigins: Object.freeze(
        Array.isArray(supplied.allowedPluginOrigins)
          ? supplied.allowedPluginOrigins.map((origin) => String(origin))
          : [global.location?.origin].filter(Boolean),
      ),
      requirePluginIntegrity: supplied.requirePluginIntegrity === true,
      pluginIntegrity: Object.freeze({ ...(supplied.pluginIntegrity ?? {}) }),
      pluginNonce: supplied.pluginNonce ? String(supplied.pluginNonce) : "",
      trustedTypes: supplied.trustedTypes !== false,
      trustedTypesPolicyName:
        supplied.trustedTypesPolicyName || "default",
      csrfHeader: supplied.csrfHeader || "X-CSRF-Token",
      csrfToken: supplied.csrfToken ?? null,
      enforceSameOriginRequests: supplied.enforceSameOriginRequests !== false,
      ...DEFAULT_LIMITS,
      ...Object.fromEntries(
        Object.keys(DEFAULT_LIMITS).map((key) => [
          key,
          Number.isFinite(Number(supplied[key]))
            ? Math.max(1, Number(supplied[key]))
            : DEFAULT_LIMITS[key],
        ]),
      ),
    });
  }

  function createLoaderPolicy() {
    if (!global.trustedTypes?.createPolicy) return null;
    try {
      return global.trustedTypes.createPolicy("editra-loader", {
        createScriptURL(value) {
          const url = new URL(String(value), document.baseURI);
          if (url.origin !== global.location.origin) {
            throw new TypeError("Editra blocked a cross-origin runtime script.");
          }
          return url.href;
        },
      });
    } catch {
      return null;
    }
  }

  const loaderPolicy =
    global[Symbol.for("editra.loaderPolicy")] || createLoaderPolicy();

  function trustedScriptURL(value) {
    return loaderPolicy?.createScriptURL
      ? loaderPolicy.createScriptURL(String(value))
      : String(value);
  }

  function createDefaultTrustedTypesPolicy(config) {
    if (!config.trustedTypes || !global.trustedTypes?.createPolicy) return null;
    try {
      return global.trustedTypes.createPolicy(config.trustedTypesPolicyName, {
        createHTML(value) {
          return global.DOMPurify.sanitize(String(value), {
            RETURN_TRUSTED_TYPE: false,
            USE_PROFILES: { html: true },
            FORBID_TAGS,
            FORBID_ATTR,
            SANITIZE_DOM: true,
            SANITIZE_NAMED_PROPS: true,
            ALLOW_UNKNOWN_PROTOCOLS: false,
          });
        },
        createScriptURL(value) {
          const url = new URL(String(value), document.baseURI);
          if (!config.allowedPluginOrigins.includes(url.origin)) {
            throw new TypeError(`Editra blocked plugin origin: ${url.origin}`);
          }
          return url.href;
        },
      });
    } catch {
      return null;
    }
  }

  class EditraSecurity {
    constructor(core, options = {}) {
      if (!global.DOMPurify?.isSupported) {
        throw new Error(
          "Editra security initialization failed: DOMPurify is unavailable.",
        );
      }
      this.core = core;
      this.config = normalizedSecurity(options);
      this.commandWindowStartedAt = performance.now();
      this.commandCount = 0;
      this.trustedTypesPolicy = createDefaultTrustedTypesPolicy(this.config);
      this.attributeHook = this.attributeHook.bind(this);
      this.afterAttributeHook = this.afterAttributeHook.bind(this);
      global.DOMPurify.addHook("uponSanitizeAttribute", this.attributeHook);
      global.DOMPurify.addHook(
        "afterSanitizeAttributes",
        this.afterAttributeHook,
      );
    }

    violation(type, message, detail = {}) {
      const payload = Object.freeze({
        type,
        message,
        detail,
        timestamp: new Date().toISOString(),
      });
      this.core?.editor?.dispatchEvent(
        new CustomEvent("editra:security-violation", {
          bubbles: true,
          detail: payload,
        }),
      );
      if (typeof this.core?.options?.onSecurityViolation === "function") {
        this.core.options.onSecurityViolation(payload);
      }
      return payload;
    }

    assertSize(value, kind = "document", limit = this.config.maxDocumentBytes) {
      const actual = bytes(value);
      if (actual <= limit) return actual;
      this.violation("size-limit", `${kind} exceeds the configured byte limit.`, {
        actual,
        limit,
      });
      throw new RangeError(
        `Editra rejected ${kind}: ${actual} bytes exceeds ${limit} bytes.`,
      );
    }

    isSafeUrl(value, { image = false, iframe = false } = {}) {
      const source = String(value ?? "").trim();
      if (!source) return false;
      if (
        image &&
        this.config.allowDataImages &&
        /^data:image\/(?:png|gif|jpeg|webp|avif);base64,[a-z0-9+/=\s]+$/i.test(
          source,
        )
      ) {
        return true;
      }
      try {
        const url = new URL(source, document.baseURI);
        if (url.protocol === "blob:") return this.config.allowBlobUrls;
        if (!["http:", "https:", "mailto:", "tel:"].includes(url.protocol)) {
          return false;
        }
        if (iframe) {
          return (
            this.config.allowIframes &&
            this.config.allowedIframeHosts.includes(url.hostname.toLowerCase())
          );
        }
        return true;
      } catch {
        return false;
      }
    }

    attributeHook(node, data) {
      const name = data.attrName.toLowerCase();
      if (name.startsWith("on") || FORBID_ATTR.includes(name)) {
        data.keepAttr = false;
        return;
      }
      if (name === "style" && UNSAFE_CSS.test(data.attrValue)) {
        data.keepAttr = false;
        return;
      }
      if (URL_ATTRIBUTES.has(name)) {
        const compact = data.attrValue.replace(CONTROL_CHARACTERS, "");
        const image = node.nodeName.toLowerCase() === "img";
        const iframe = node.nodeName.toLowerCase() === "iframe";
        if (!this.isSafeUrl(compact, { image, iframe })) {
          data.keepAttr = false;
        }
      }
    }

    afterAttributeHook(node) {
      if (
        node.nodeName.toLowerCase() === "a" &&
        node.getAttribute("target") === "_blank"
      ) {
        const rel = new Set(
          String(node.getAttribute("rel") || "")
            .split(/\s+/)
            .filter(Boolean),
        );
        rel.add("noopener");
        rel.add("noreferrer");
        node.setAttribute("rel", [...rel].join(" "));
      }
    }

    sanitizerConfig(returnTrustedType = false) {
      return {
        RETURN_TRUSTED_TYPE: returnTrustedType,
        USE_PROFILES: { html: true, svg: true, svgFilters: true },
        FORBID_TAGS: this.config.allowIframes
          ? FORBID_TAGS.filter((tag) => tag !== "iframe")
          : FORBID_TAGS,
        FORBID_ATTR,
        ADD_TAGS: this.config.allowIframes ? ["iframe"] : [],
        ADD_ATTR: this.config.allowIframes
          ? ["allow", "allowfullscreen", "referrerpolicy", "sandbox"]
          : [],
        SANITIZE_DOM: true,
        SANITIZE_NAMED_PROPS: true,
        ALLOW_UNKNOWN_PROTOCOLS: false,
      };
    }

    sanitize(value, { trusted = false, kind = "document" } = {}) {
      const source = String(value ?? "");
      this.assertSize(source, kind);
      if (!this.config.enabled || !this.config.sanitize) return source;
      const clean = global.DOMPurify.sanitize(
        source,
        this.sanitizerConfig(trusted),
      );
      const fragment = global.DOMPurify.sanitize(
        String(clean),
        {
          ...this.sanitizerConfig(false),
          RETURN_DOM_FRAGMENT: true,
          RETURN_TRUSTED_TYPE: false,
        },
      );
      let nodes = 0;
      let maximumDepth = 0;
      const stack = [...fragment.childNodes].map((node) => [node, 1]);
      while (stack.length) {
        const [node, depth] = stack.pop();
        nodes += 1;
        maximumDepth = Math.max(maximumDepth, depth);
        if (
          nodes > this.config.maxNodes ||
          maximumDepth > this.config.maxDepth
        ) {
          this.violation("dom-complexity", "Document DOM limits exceeded.", {
            nodes,
            maximumDepth,
          });
          throw new RangeError("Editra rejected a recursively complex document.");
        }
        node.childNodes?.forEach((child) => stack.push([child, depth + 1]));
      }
      return clean;
    }

    trustedHTML(value, kind = "document") {
      return this.sanitize(value, { trusted: true, kind });
    }

    permitCommand(name) {
      const now = performance.now();
      if (now - this.commandWindowStartedAt >= 1000) {
        this.commandWindowStartedAt = now;
        this.commandCount = 0;
      }
      this.commandCount += 1;
      if (this.commandCount <= this.config.maxCommandsPerSecond) return true;
      this.violation("command-rate", "Command rate limit exceeded.", { name });
      return false;
    }

    assertPluginURL(url, relativePath) {
      if (!this.config.allowedPluginOrigins.includes(url.origin)) {
        throw new TypeError(`Editra blocked plugin origin: ${url.origin}`);
      }
      const integrity = this.config.pluginIntegrity[relativePath];
      if (this.config.requirePluginIntegrity && !integrity) {
        throw new TypeError(
          `Editra requires an integrity hash for ${relativePath}.`,
        );
      }
      return integrity || null;
    }

    validateRequest(url, init = {}) {
      const target = new URL(url, document.baseURI);
      if (
        this.config.enforceSameOriginRequests &&
        target.origin !== global.location.origin
      ) {
        throw new TypeError("Editra blocked a cross-origin application request.");
      }
      const method = String(init.method || "GET").toUpperCase();
      const headers = new Headers(init.headers || {});
      if (!["GET", "HEAD", "OPTIONS"].includes(method)) {
        if (!this.config.csrfToken) {
          throw new TypeError(
            "Editra requires security.csrfToken for state-changing requests.",
          );
        }
        headers.set(this.config.csrfHeader, String(this.config.csrfToken));
      }
      return {
        url: target.href,
        init: {
          ...init,
          headers,
          credentials: init.credentials || "same-origin",
          referrerPolicy: init.referrerPolicy || "strict-origin-when-cross-origin",
        },
      };
    }

    destroy() {
      global.DOMPurify.removeHook(
        "uponSanitizeAttribute",
        this.attributeHook,
      );
      global.DOMPurify.removeHook(
        "afterSanitizeAttributes",
        this.afterAttributeHook,
      );
      this.core = null;
    }

    static config(options) {
      return normalizedSecurity(options);
    }

    static trustedScriptURL(value) {
      return trustedScriptURL(value);
    }
  }

  global.EditraSecurity = EditraSecurity;
})(window);
