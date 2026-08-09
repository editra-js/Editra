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
    "foreignobject",
    "use",
    "animate",
    "animatemotion",
    "animatetransform",
    "set",
    "filter",
    "feimage",
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
  const TRUSTED_PARSE_CONTEXT = Symbol("editra-inert-parse");
  const UNSAFE_STYLESHEET =
    /(?:@import|@font-face|url\s*\(|expression\s*\(|behavior\s*:|-moz-binding|javascript\s*:|vbscript\s*:)/i;
  const ESCAPING_LAYOUT_CSS = /position\s*:\s*(?:fixed|sticky)\b/i;
  const MAX_SANITIZER_PASSES = 4;

  function normalizedOrigins(values) {
    return Object.freeze(
      [...new Set(Array.isArray(values) ? values : [])].flatMap((value) => {
        try {
          return [new URL(String(value), document.baseURI).origin];
        } catch {
          return [];
        }
      }),
    );
  }

  function regulatedProfile(options, supplied) {
    return (
      options.regulated === true ||
      String(supplied.profile ?? "").trim().toLowerCase() === "regulated"
    );
  }

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
    const regulated = regulatedProfile(options, supplied);
    const currentOrigin = global.location?.origin;
    const lockedOverrides = [];
    if (regulated) {
      if (options.sanitizePaste === false) lockedOverrides.push("sanitizePaste");
      if (supplied.enabled === false) lockedOverrides.push("security.enabled");
      if (supplied.sanitize === false) lockedOverrides.push("security.sanitize");
      if (supplied.allowIframes === true) lockedOverrides.push("security.allowIframes");
      if ((supplied.allowedIframeHosts ?? []).length) {
        lockedOverrides.push("security.allowedIframeHosts");
      }
      if (
        (supplied.allowedPluginOrigins ?? []).some(
          (origin) => String(origin) !== currentOrigin,
        )
      ) {
        lockedOverrides.push("security.allowedPluginOrigins");
      }
      if (supplied.requirePluginIntegrity === false) {
        lockedOverrides.push("security.requirePluginIntegrity");
      }
      if (supplied.requireCommunityPluginIntegrity === false) {
        lockedOverrides.push("security.requireCommunityPluginIntegrity");
      }
      if (supplied.allowCommunityPlugins === true) {
        lockedOverrides.push("security.allowCommunityPlugins");
      }
      if (supplied.trustedTypes === false) {
        lockedOverrides.push("security.trustedTypes");
      }
      if (supplied.enforceSameOriginRequests === false) {
        lockedOverrides.push("security.enforceSameOriginRequests");
      }
    }
    return Object.freeze({
      profile: regulated ? "regulated" : "standard",
      regulated,
      lockedOverrides: Object.freeze(lockedOverrides),
      enabled: regulated || supplied.enabled !== false,
      sanitize: regulated || supplied.sanitize !== false,
      allowDataImages: supplied.allowDataImages !== false,
      allowBlobUrls: supplied.allowBlobUrls !== false,
      allowIframes: regulated ? false : supplied.allowIframes === true,
      allowedIframeHosts: regulated
        ? Object.freeze([])
        : Object.freeze(
            Array.isArray(supplied.allowedIframeHosts)
              ? supplied.allowedIframeHosts.map((host) =>
                  String(host).trim().toLowerCase(),
                )
              : [],
          ),
      allowedPluginOrigins: regulated
        ? Object.freeze([currentOrigin].filter(Boolean))
        : normalizedOrigins(
            Array.isArray(supplied.allowedPluginOrigins)
              ? supplied.allowedPluginOrigins
              : [currentOrigin].filter(Boolean),
          ),
      allowedUrlOrigins: normalizedOrigins(supplied.allowedUrlOrigins),
      allowedConnectionOrigins: normalizedOrigins(
        supplied.allowedConnectionOrigins,
      ),
      allowedExternalProtocols: Object.freeze(
        (Array.isArray(supplied.allowedExternalProtocols)
          ? supplied.allowedExternalProtocols
          : []
        )
          .map((protocol) => String(protocol).trim().toLowerCase())
          .filter((protocol) => ["mailto:", "tel:"].includes(protocol)),
      ),
      requirePluginIntegrity:
        regulated || supplied.requirePluginIntegrity === true,
      requireCommunityPluginIntegrity:
        regulated || supplied.requireCommunityPluginIntegrity !== false,
      allowCommunityPlugins:
        !regulated && supplied.allowCommunityPlugins !== false,
      pluginIntegrity: Object.freeze({ ...(supplied.pluginIntegrity ?? {}) }),
      pluginNonce: supplied.pluginNonce ? String(supplied.pluginNonce) : "",
      trustedTypes: regulated || supplied.trustedTypes !== false,
      trustedTypesPolicyName:
        supplied.trustedTypesPolicyName || "default",
      csrfHeader: supplied.csrfHeader || "X-CSRF-Token",
      csrfToken: supplied.csrfToken ?? null,
      enforceSameOriginRequests:
        regulated || supplied.enforceSameOriginRequests !== false,
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
        createHTML(value, context) {
          if (context === TRUSTED_PARSE_CONTEXT) return String(value);
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
      this.restoreDeferredStyles = this.restoreDeferredStyles.bind(this);
      global.DOMPurify.addHook("uponSanitizeAttribute", this.attributeHook);
      global.DOMPurify.addHook(
        "afterSanitizeAttributes",
        this.afterAttributeHook,
      );
      this.config.lockedOverrides.forEach((setting) => {
        this.violation(
          "regulated-profile-lock",
          `The regulated profile ignored an unsafe ${setting} override.`,
          { setting },
        );
      });
      this.deferredStyleObserver = this.config.regulated
        ? new MutationObserver((records) => {
            records.forEach((record) =>
              record.addedNodes.forEach((node) => {
                if (node.nodeType === Node.ELEMENT_NODE) {
                  this.restoreDeferredStyles(node);
                }
              }),
            );
          })
        : null;
      this.deferredStyleObserver?.observe(this.core.editor, {
        childList: true,
        subtree: true,
      });
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

    parseXML(value) {
      const trustedSource = this.trustedParserInput(value);
      return new DOMParser().parseFromString(
        trustedSource,
        "application/xml",
      );
    }

    parseHTML(value) {
      const trustedSource = this.trustedParserInput(value);
      return new DOMParser().parseFromString(trustedSource, "text/html");
    }

    trustedParserInput(value) {
      const source = String(value ?? "");
      return this.trustedTypesPolicy?.createHTML
        ? this.trustedTypesPolicy.createHTML(source, TRUSTED_PARSE_CONTEXT)
        : source;
    }

    inspectHTMLImport(value) {
      const source = String(value ?? "");
      this.assertSize(source, "HTML import");
      const documentNode = this.parseHTML(source);
      const violations = new Set();

      documentNode.querySelectorAll("*").forEach((node) => {
        const tag = node.localName.toLowerCase();
        if (FORBID_TAGS.includes(tag) && tag !== "style") {
          violations.add(`blocked <${tag}> element`);
        }
        if (tag === "style") {
          const css = node.textContent || "";
          if (UNSAFE_STYLESHEET.test(css)) {
            violations.add("stylesheet can load or execute external content");
          }
          if (ESCAPING_LAYOUT_CSS.test(css)) {
            violations.add("stylesheet can escape the document surface");
          }
        }

        [...node.attributes].forEach((attribute) => {
          const name = attribute.name.toLowerCase();
          const compact = attribute.value.replace(CONTROL_CHARACTERS, "");
          if (name.startsWith("on")) {
            violations.add(`event handler attribute ${name}`);
          } else if (FORBID_ATTR.includes(name)) {
            violations.add(`blocked attribute ${name}`);
          } else if (name === "style" && UNSAFE_CSS.test(attribute.value)) {
            violations.add("inline CSS can load or execute external content");
          } else if (
            name === "style" &&
            ESCAPING_LAYOUT_CSS.test(attribute.value)
          ) {
            violations.add("inline CSS can escape the document surface");
          } else if (name === "srcset") {
            violations.add("responsive external image source");
          } else if (
            URL_ATTRIBUTES.has(name) &&
            !this.isSafeUrl(compact, {
              image: tag === "img",
              iframe: tag === "iframe",
            })
          ) {
            violations.add(`unsafe ${name} URL`);
          } else if (
            ["audio", "img", "source", "track", "video"].includes(tag) &&
            ["src", "poster"].includes(name) &&
            !/^(?:data:image\/(?:png|gif|jpeg|webp|avif);base64,|blob:)/i.test(
              compact,
            )
          ) {
            violations.add("external media resource");
          }
        });
      });

      return Object.freeze({
        safe: violations.size === 0,
        violations: Object.freeze([...violations]),
        document: documentNode,
      });
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
        if (
          this.config.regulated &&
          ["mailto:", "tel:"].includes(url.protocol) &&
          !this.config.allowedExternalProtocols.includes(url.protocol)
        ) {
          return false;
        }
        if (
          this.config.regulated &&
          ["http:", "https:"].includes(url.protocol) &&
          url.origin !== global.location.origin &&
          !this.config.allowedUrlOrigins.includes(url.origin)
        ) {
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
        USE_PROFILES: { html: true, svg: true, svgFilters: false },
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

    deferInlineStyles(fragment) {
      if (!this.config.regulated) return fragment;
      fragment.querySelectorAll?.("[style]").forEach((element) => {
        const declaration = String(element.getAttribute("style") || "").trim();
        element.removeAttribute("style");
        if (
          declaration &&
          !UNSAFE_CSS.test(declaration) &&
          !ESCAPING_LAYOUT_CSS.test(declaration)
        ) {
          element.setAttribute("data-editra-deferred-style", declaration);
        }
      });
      return fragment;
    }

    restoreDeferredStyles(root) {
      if (!this.config.regulated || !root) return root;
      const elements = [];
      if (root.nodeType === Node.ELEMENT_NODE && root.matches?.("[data-editra-deferred-style]")) {
        elements.push(root);
      }
      root.querySelectorAll?.("[data-editra-deferred-style]").forEach((element) =>
        elements.push(element),
      );
      elements.forEach((element) => {
        const declaration = String(
          element.getAttribute("data-editra-deferred-style") || "",
        );
        element.removeAttribute("data-editra-deferred-style");
        if (
          declaration &&
          !UNSAFE_CSS.test(declaration) &&
          !ESCAPING_LAYOUT_CSS.test(declaration)
        ) {
          element.style.cssText = declaration;
        }
      });
      return root;
    }

    sanitize(value, { trusted = false, kind = "document" } = {}) {
      const source = String(value ?? "");
      this.assertSize(source, kind);
      if (!this.config.enabled || !this.config.sanitize) return source;
      const prepareForSanitizer = (input) => {
        const markup = String(input);
        if (!this.config.regulated) return markup;
        return markup
          .replace(/<\s*\/?\s*style\b[^>]*>/gi, "")
          .replace(/(\s)style(\s*=)/gi, "$1data-editra-deferred-style$2");
      };
      const sanitizeFragment = (input) =>
        global.DOMPurify.sanitize(prepareForSanitizer(input), {
          ...this.sanitizerConfig(false),
          RETURN_DOM_FRAGMENT: true,
          RETURN_TRUSTED_TYPE: false,
        });
      const serializeFragment = (input) => {
        const container = document.createElement("div");
        container.append(input.cloneNode(true));
        return container.innerHTML;
      };

      let fragment = this.deferInlineStyles(sanitizeFragment(source));
      let serialized = serializeFragment(fragment);
      let stable = false;
      for (let pass = 1; pass < MAX_SANITIZER_PASSES; pass += 1) {
        const nextFragment = this.deferInlineStyles(sanitizeFragment(serialized));
        const nextSerialized = serializeFragment(nextFragment);
        fragment = nextFragment;
        if (nextSerialized === serialized) {
          stable = true;
          break;
        }
        serialized = nextSerialized;
      }
      if (!stable) {
        this.violation(
          "sanitizer-instability",
          `${kind} did not reach a stable sanitized DOM.`,
          { passes: MAX_SANITIZER_PASSES },
        );
        throw new TypeError(`Editra rejected unstable ${kind} markup.`);
      }
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
      if (!trusted) return serialized;
      const trustedResult = global.DOMPurify.sanitize(
        serialized,
        this.sanitizerConfig(true),
      );
      if (String(trustedResult) !== serialized) {
        this.violation(
          "sanitizer-instability",
          `${kind} changed while producing TrustedHTML.`,
          { passes: MAX_SANITIZER_PASSES + 1 },
        );
        throw new TypeError(`Editra rejected unstable ${kind} markup.`);
      }
      return trustedResult;
    }

    trustedHTML(value, kind = "document") {
      return this.sanitize(value, { trusted: true, kind });
    }

    trustedUIHTML(value, kind = "editor UI") {
      const source = String(value ?? "");
      this.assertSize(
        source,
        kind,
        Math.min(this.config.maxDocumentBytes, 512 * 1024),
      );
      const config = {
        RETURN_TRUSTED_TYPE: false,
        USE_PROFILES: { html: true },
        FORBID_TAGS: FORBID_TAGS.filter((tag) => tag !== "form"),
        FORBID_ATTR,
        SANITIZE_DOM: true,
        SANITIZE_NAMED_PROPS: true,
        ALLOW_UNKNOWN_PROTOCOLS: false,
      };
      const clean = String(global.DOMPurify.sanitize(source, config));
      const stable = String(global.DOMPurify.sanitize(clean, config));
      if (stable !== clean) {
        this.violation(
          "sanitizer-instability",
          `${kind} did not reach stable UI markup.`,
        );
        throw new TypeError(`Editra rejected unstable ${kind} markup.`);
      }
      const trustedResult = global.DOMPurify.sanitize(stable, {
        ...config,
        RETURN_TRUSTED_TYPE: true,
      });
      if (String(trustedResult) !== stable) {
        throw new TypeError(`Editra rejected unstable ${kind} markup.`);
      }
      return trustedResult;
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

    validateWebSocketURL(value) {
      const target = new URL(String(value), document.baseURI);
      if (!["ws:", "wss:"].includes(target.protocol)) {
        throw new TypeError("Editra requires a ws: or wss: collaboration URL.");
      }
      if (global.location.protocol === "https:" && target.protocol !== "wss:") {
        throw new TypeError("Editra blocked an insecure collaboration socket.");
      }
      const sameHost = target.host === global.location.host;
      if (
        this.config.regulated &&
        !sameHost &&
        !this.config.allowedConnectionOrigins.includes(target.origin)
      ) {
        throw new TypeError(
          "Editra regulated mode blocked a non-allowlisted collaboration origin.",
        );
      }
      return target.href;
    }

    destroy() {
      this.deferredStyleObserver?.disconnect();
      this.deferredStyleObserver = null;
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
