(async function () {
  "use strict";

  const result = document.querySelector("#test-result");
  const cspViolations = [];
  document.addEventListener("securitypolicyviolation", (event) => {
    cspViolations.push({
      directive: event.effectiveDirective,
      blockedURI: event.blockedURI,
      sourceFile: event.sourceFile,
      lineNumber: event.lineNumber,
      sample: event.sample,
    });
  });
  const assert = (condition, message) => {
    if (!condition) throw new Error(message);
  };

  function unsafeOverrides(pluginIntegrity) {
    return {
      profile: "regulated",
      enabled: false,
      sanitize: false,
      allowIframes: true,
      allowedIframeHosts: ["outside.invalid"],
      allowedPluginOrigins: ["https://outside.invalid"],
      requirePluginIntegrity: false,
      requireCommunityPluginIntegrity: false,
      allowCommunityPlugins: true,
      trustedTypes: false,
      enforceSameOriginRequests: false,
      pluginIntegrity,
    };
  }

  try {
    const response = await fetch("../../plugins/runtime-integrity.json");
    assert(response.ok, "runtime integrity manifest was unavailable");
    const { integrity } = await response.json();
    const violations = [];
    const word = await Editra.init({
      selector: "#regulated-word",
      regulated: true,
      theme: "Word",
      plugins: ["bold", "table", "image", "codes"],
      toolbar: "bold | table image qrCode | undo redo",
      sanitizePaste: false,
      security: unsafeOverrides(integrity),
      onSecurityViolation(event) {
        violations.push(event);
      },
    });

    const security = word.security.config;
    assert(security.profile === "regulated", "regulated profile was not active");
    assert(security.regulated === true, "regulated marker was not exposed");
    assert(security.enabled && security.sanitize, "sanitization lock was weakened");
    assert(word.options.sanitizePaste === true, "paste sanitization lock was weakened");
    assert(security.allowIframes === false, "document iframe lock was weakened");
    assert(security.allowedIframeHosts.length === 0, "iframe hosts were retained");
    assert(security.allowCommunityPlugins === false, "community plugins were enabled");
    assert(security.requirePluginIntegrity, "runtime integrity was not required");
    assert(
      security.requireCommunityPluginIntegrity,
      "community integrity was not required",
    );
    assert(security.trustedTypes, "Trusted Types was disabled");
    assert(security.enforceSameOriginRequests, "same-origin requests were disabled");
    assert(
      security.allowedPluginOrigins.length === 1 &&
        security.allowedPluginOrigins[0] === location.origin,
      "plugin origins were not locked to the application origin",
    );
    assert(
      word.editor.dataset.editraSecurityProfile === "regulated",
      "surface security profile was not exposed",
    );
    assert(
      !word.getCode().includes("<script") && globalThis.regulatedXss !== true,
      "regulated initialization allowed executable markup",
    );
    assert(
      violations.filter((event) => event.type === "regulated-profile-lock").length >= 9,
      "unsafe override attempts were not reported",
    );
    await word.executeCommand("insertTable", { rows: 1, columns: 1 });
    await word.executeCommand("insertQrCode", { value: "regulated-qr" });
    await word.executeCommand("insertImage", {
      url: "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==",
      alt: "Regulated local image",
    });
    assert(word.editor.querySelector("table"), "verified table plugin did not load");
    assert(
      word.editor.querySelector("[data-editra-qr]"),
      "verified QR runtime did not load",
    );
    assert(
      word.editor.querySelector('img[alt="Regulated local image"]'),
      "verified image plugin did not load",
    );
    const structuredDocument = word.getJSON();
    assert(
      structuredDocument.schema === "https://editra.in/schema/document/v1" &&
        structuredDocument.version === "1.0.0" &&
        structuredDocument.type === "document",
      "structured document identity was not versioned",
    );
    assert(word.validateJSON(structuredDocument).valid, "exported JSON was invalid");
    const structuredText = JSON.stringify(structuredDocument);
    assert(
      structuredText.includes('"tag":"table"') &&
        structuredText.includes('"tag":"img"') &&
        structuredText.includes("data-editra-qr"),
      "structured JSON omitted supported table or media content",
    );
    word.setJSON(structuredDocument);
    await new Promise((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(resolve)),
    );
    assert(
      JSON.stringify(word.getJSON()) === structuredText,
      "structured JSON round-trip was not deterministic",
    );
    const invalidDocument = structuredClone(structuredDocument);
    invalidDocument.content.push({
      type: "element",
      tag: "script",
      content: [{ type: "text", text: "globalThis.jsonXss=true" }],
    });
    assert(!word.validateJSON(invalidDocument).valid, "unsafe JSON node was accepted");
    let invalidJSONBlocked = false;
    try {
      word.setJSON(invalidDocument);
    } catch (error) {
      invalidJSONBlocked = /invalid Editra document/i.test(error.message);
    }
    assert(invalidJSONBlocked, "invalid structured JSON import was not rejected");
    word.setCode(
      '<p data-csp-style-test style="color: rgb(31, 78, 121); font-size: 18px; text-align: center">Strict CSP formatting</p>',
    );
    await new Promise((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(resolve)),
    );
    const styledParagraph = word.editor.querySelector("[data-csp-style-test]");
    const computedStyle = getComputedStyle(styledParagraph);
    assert(
      computedStyle.color === "rgb(31, 78, 121)" &&
        computedStyle.fontSize === "18px" &&
        computedStyle.textAlign === "center",
      "regulated formatting was not restored under strict CSP",
    );
    assert(
      !styledParagraph.hasAttribute("data-editra-deferred-style"),
      "deferred style marker leaked into the live document",
    );

    const mutationPayloads = [
      '<math><mtext><table><mglyph><style><!--</style><img title="--><img src=x onerror=globalThis.mxssPwned=true>">',
      '<svg><p><style><g title="</style><img src=x onerror=globalThis.mxssPwned=true>">',
      '<form id="mxss"><math><mtext></form><form><mglyph><style></math><img src=x onerror=globalThis.mxssPwned=true>',
      '<svg><foreignObject><div><img src=x onerror="globalThis.mxssPwned=true"></div></foreignObject></svg>',
      '<noscript><p title="</noscript><img src=x onerror=globalThis.mxssPwned=true>">',
      '<a href="java\nscript:globalThis.mxssPwned=true">mutation link</a>',
    ];
    const mutationTags = [
      "svg",
      "math",
      "table",
      "select",
      "noscript",
      "template",
      "form",
      "style",
    ];
    for (let index = 0; index < 64; index += 1) {
      const outer = mutationTags[index % mutationTags.length];
      const inner = mutationTags[(index * 5 + 3) % mutationTags.length];
      mutationPayloads.push(
        `<${outer}><${inner}><p title="</${outer}><img src=x onerror=globalThis.mxssPwned=true>">mutation-${index}</${inner}>`,
      );
    }
    globalThis.mxssPwned = false;
    for (const payload of mutationPayloads) {
      let sanitized;
      try {
        sanitized = String(word.sanitizeHTML(payload, { kind: "mXSS corpus" }));
      } catch (error) {
        assert(
          /unstable mXSS corpus markup/i.test(error.message),
          `unexpected sanitizer rejection: ${error.message}`,
        );
        continue;
      }
      assert(
        String(word.sanitizeHTML(sanitized, { kind: "mXSS idempotence" })) ===
          sanitized,
        "sanitizer output was not idempotent",
      );
      const parsed = word.security.parseHTML(sanitized);
      assert(
        !parsed.querySelector("script,iframe,object,embed,foreignObject"),
        "mXSS corpus retained an active element",
      );
      parsed.querySelectorAll("*").forEach((node) => {
        [...node.attributes].forEach((attribute) => {
          assert(
            !attribute.name.toLowerCase().startsWith("on"),
            "mXSS corpus retained an event attribute",
          );
          assert(
            !/javascript\s*:/i.test(attribute.value),
            "mXSS corpus retained an executable URL",
          );
        });
      });
      const mutationHost = document.createElement("div");
      mutationHost.hidden = true;
      mutationHost.innerHTML = word.security.trustedHTML(
        sanitized,
        "mXSS browser reparse",
      );
      document.body.append(mutationHost);
      await new Promise((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(resolve)),
      );
      mutationHost.remove();
      assert(globalThis.mxssPwned !== true, "mXSS payload executed after reparse");
    }
    assert(word.security.isSafeUrl("/same-origin"), "same-origin URL was blocked");
    assert(
      !word.security.isSafeUrl("https://outside.invalid/resource"),
      "external URL was accepted without an allowlist",
    );
    assert(!word.security.isSafeUrl("mailto:test@example.com"), "mailto was accepted");

    let iframeBlocked = false;
    try {
      word.setCode('<iframe src="https://outside.invalid/embed"></iframe>');
      iframeBlocked = !word.getCode().includes("iframe");
    } catch {
      iframeBlocked = true;
    }
    assert(iframeBlocked, "regulated mode accepted an iframe");

    let communityBlocked = false;
    try {
      await word.installCommunityPlugin({});
    } catch (error) {
      communityBlocked = /does not permit community plugins/i.test(error.message);
    }
    assert(communityBlocked, "regulated mode accepted a community plugin");

    let requestBlocked = false;
    try {
      await word.secureRequest("https://outside.invalid/api");
    } catch (error) {
      requestBlocked = /cross-origin/i.test(error.message);
    }
    assert(requestBlocked, "regulated mode accepted a cross-origin request");

    let socketBlocked = false;
    try {
      word.security.validateWebSocketURL("wss://outside.invalid/socket");
    } catch (error) {
      socketBlocked = /non-allowlisted/i.test(error.message);
    }
    assert(socketBlocked, "regulated mode accepted a non-allowlisted socket");

    const classicHost = document.querySelector("#regulated-classic");
    const classic = await Editra.init({
      selector: classicHost,
      regulated: true,
      theme: "Classic",
      plugins: ["bold"],
      toolbar: "bold | undo redo",
      security: { profile: "regulated", pluginIntegrity: integrity },
    });
    assert(classic.host === classicHost, "regulated textarea host was not retained");
    assert(classic.options.theme === "Classic", "regulated Classic theme changed");
    assert(
      classic.editor.dataset.editraSecurityProfile === "regulated",
      "regulated textarea surface was not marked",
    );
    assert(
      !classic.getCode().includes("onerror") &&
        !classic.getCode().includes("outside.invalid") &&
        globalThis.regulatedXss !== true,
      "regulated textarea content bypassed sanitization or URL policy",
    );
    const classicDocument = classic.getJSON();
    assert(classic.validateJSON(classicDocument).valid, "Classic JSON export was invalid");
    classic.setJSON(classicDocument);

    const missingHost = document.createElement("div");
    document.body.append(missingHost);
    let missingIntegrityBlocked = false;
    try {
      await Editra.init({
        selector: missingHost,
        regulated: true,
        theme: "Classic",
        plugins: ["bold"],
      });
    } catch (error) {
      missingIntegrityBlocked = /requires an integrity hash/i.test(error.message);
    }
    missingHost.remove();
    assert(missingIntegrityBlocked, "regulated mode started without integrity metadata");

    assert(
      cspViolations.length === 0,
      `strict CSP violation: ${JSON.stringify(cspViolations)}`,
    );

    classic.destroy();
    word.destroy();
    document.body.dataset.testStatus = "passed";
    result.textContent = "passed";
  } catch (error) {
    document.body.dataset.testStatus = "failed";
    result.textContent = `${error?.message || String(error)}\n${error?.stack || ""}`;
  }
})();
