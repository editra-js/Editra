/**
 * Product: Editra
 * Author: Editra Team
 * Version: 1.17.0
 * Purpose: Exercises browser-enforced security, accessibility, i18n, limits, and cleanup contracts.
 * Licensing: MIT License (open source)
 */

(async function () {
  "use strict";

  const result = document.querySelector("#test-result");
  const failures = [];
  const cspViolations = [];
  document.addEventListener("securitypolicyviolation", (event) => {
    cspViolations.push(`${event.violatedDirective}: ${event.blockedURI}`);
  });
  const assert = (condition, message) => {
    if (!condition) failures.push(message);
  };

  try {
    const host = document.querySelector("#editra-security-test");
    const instance = await Editra.init({
      selector: host,
      plugins: [
        "bold",
        "italic",
        "underline",
        "table",
        "image",
        "video",
        "export",
        "codeview",
        "lists",
        "fonts",
        "structure",
        "pagesize",
        "collaboration",
        "languages",
        "formatting",
        "productivity",
      ],
      toolbar:
        "bold italic underline strikethrough formatPainter | fontFamily fontSize foreColor backgroundColor language | table image video insertEmoji trackChanges | undo redo",
      showMenuBar: true,
      editorHeight: "900px",
      language: "ar",
      direction: "rtl",
      translations: {
        ar: {
          "toolbar.label": "شريط أدوات المحرر",
          "toolbar.bold": "غامق",
        },
      },
      security: {
        maxDocumentBytes: 1024 * 1024,
      },
    });

    instance.setCode(
      '<p id="constructor" onclick="alert(1)">Safe</p>' +
        '<img src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==" onerror="alert(2)">' +
        '<a href="java&#x73;cript:alert(3)">Bad link</a>' +
        '<script>window.__editraXss = true</script>',
    );
    await new Promise((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(resolve)),
    );

    const code = instance.getCode();
    assert(!code.includes("<script"), "script tag survived");
    assert(!/\son[a-z]+\s*=/i.test(code), "event handler survived");
    assert(!/javascript\s*:/i.test(code), "script URL survived");
    assert(!globalThis.__editraXss, "injected script executed");
    assert(host.dir === "rtl", "RTL direction missing");
    assert(host.lang === "ar", "language attribute missing");
    assert(
      document.querySelector(".editra-toolbar")?.getAttribute("aria-label") ===
        "شريط أدوات المحرر",
      "toolbar translation missing",
    );
    assert(
      document.querySelector('[data-command="bold"]')?.getAttribute(
        "aria-label",
      ) === "غامق",
      "control translation missing",
    );
    assert(
      document.querySelector(".editra-toolbar")?.getAttribute("role") ===
        "toolbar",
      "toolbar role missing",
    );
    const toolbarIcons = [...document.querySelectorAll(".editra-tool-icon")];
    await Promise.all(
      toolbarIcons.map((icon) =>
        icon.complete
          ? Promise.resolve()
          : new Promise((resolve) => {
              icon.addEventListener("load", resolve, { once: true });
              icon.addEventListener("error", resolve, { once: true });
            }),
      ),
    );
    assert(toolbarIcons.length >= 8, "expected toolbar icons were not rendered");
    assert(
      toolbarIcons.every(
        (icon) =>
          icon.tagName === "IMG" &&
          icon.naturalWidth > 0 &&
          new URL(icon.src).pathname.startsWith("/assets/icons/"),
      ),
      "one or more toolbar icon assets failed to load",
    );
    for (const command of ["bold", "italic", "underline"]) {
      const button = document.querySelector(`[data-command="${command}"]`);
      assert(button instanceof HTMLButtonElement, `${command} button missing`);
      assert(Boolean(button?.getAttribute("aria-label")), `${command} label missing`);
      button?.focus();
      assert(document.activeElement === button, `${command} is not keyboard focusable`);
    }
    assert(
      document.querySelector(".editra-sr-only")?.getAttribute("aria-live") ===
        "polite",
      "screen-reader live region missing",
    );
    assert(
      !document.querySelector(
        '[data-command="renderQRCode"], [data-command="renderBarcode"]',
      ),
      "removed QR or barcode control is still visible",
    );
    const tableMenu = [...document.querySelectorAll(".editra-menu")].find(
      (menu) =>
        menu.querySelector(".editra-menu-trigger")?.textContent === "Table",
    );
    assert(tableMenu, "table menu missing while table plugin is active");
    assert(
      tableMenu?.querySelector('[data-command="insertTable"]'),
      "table menu has no direct Insert Table command",
    );
    assert(
      tableMenu?.querySelector('[data-command="addRow"]')?.hidden,
      "table row actions appeared before a table existed",
    );

    let iframeBlocked = false;
    try {
      instance.insertVideoEmbed("https://evil.example/video");
    } catch {
      iframeBlocked = true;
    }
    assert(iframeBlocked, "unapproved iframe was accepted");
    assert(
      !instance.isSafeMediaUrl("file:///private/secret.png", true),
      "file URL was accepted",
    );

    instance.setCode("<p>Format me</p>");
    await new Promise((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(resolve)),
    );
    const formatParagraph = instance.editor.querySelector("p");
    for (const command of ["bold", "italic", "underline"]) {
      instance.editor.focus();
      const range = document.createRange();
      range.selectNodeContents(formatParagraph);
      const selection = globalThis.getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
      instance.selection = range.cloneRange();
      document.querySelector(`[data-command="${command}"]`)?.click();
      await new Promise((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(resolve)),
      );
    }
    assert(
      formatParagraph.querySelector("b, strong") &&
        formatParagraph.querySelector("i, em") &&
        formatParagraph.querySelector("u"),
      `bold, italic, or underline toolbar action failed: ${instance.getCode()}`,
    );

    for (const [command, selector] of [
      ["bold", "b, strong"],
      ["italic", "i, em"],
      ["underline", "u"],
      ["strikethrough", "s, strike"],
    ]) {
      instance.setCode(`<p>${command} toggle</p>`);
      await new Promise((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(resolve)),
      );
      let target = instance.editor.querySelector("p");
      let range = document.createRange();
      range.selectNodeContents(target);
      globalThis.getSelection().removeAllRanges();
      globalThis.getSelection().addRange(range);
      instance.selection = range.cloneRange();
      await instance.executeCommand(command);
      assert(
        instance.editor.querySelector(selector),
        `${command} was not applied`,
      );
      target = instance.editor.querySelector(selector);
      range = document.createRange();
      range.selectNodeContents(target);
      globalThis.getSelection().removeAllRanges();
      globalThis.getSelection().addRange(range);
      instance.selection = range.cloneRange();
      await instance.executeCommand(command);
      assert(
        !instance.editor.querySelector(selector),
        `${command} did not toggle off`,
      );
    }

    instance.setCode("<p>List item</p>");
    await new Promise((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(resolve)),
    );
    let listRange = document.createRange();
    listRange.selectNodeContents(instance.editor.querySelector("p"));
    globalThis.getSelection().removeAllRanges();
    globalThis.getSelection().addRange(listRange);
    instance.selection = listRange.cloneRange();
    await instance.executeCommand("bulletList");
    assert(
      instance.editor.querySelector("ul, ol") || instance.editor.querySelector("li"),
      "bullet list was not applied",
    );
    await instance.executeCommand("bulletList");
    const bulletListState = instance.editor.innerHTML;
    const bulletListToggledOff =
      !/<(ul|ol)\b/i.test(bulletListState) &&
      instance.editor.textContent.includes("List item");
    assert(bulletListToggledOff, "bullet list did not toggle off");

    const listBlock =
      instance.editor.querySelector("p, div, h1, h2, h3, h4, h5, h6, blockquote, pre") ||
      instance.editor;
    listRange = document.createRange();
    listRange.selectNodeContents(listBlock);
    globalThis.getSelection().removeAllRanges();
    globalThis.getSelection().addRange(listRange);
    instance.selection = listRange.cloneRange();
    await instance.executeCommand("numberList");
    const numberListApplied =
      instance.editor.querySelector("ul, ol") || instance.editor.querySelector("li") ||
      /<(ul|ol)\b/i.test(instance.editor.innerHTML);
    assert(numberListApplied, "number list was not applied");
    await instance.executeCommand("numberList");
    const numberListState = instance.editor.innerHTML;
    const numberListToggledOff =
      !/<(ul|ol)\b/i.test(numberListState) &&
      instance.editor.textContent.includes("List item");
    assert(numberListToggledOff, "number list did not toggle off");

    const fontSizeBlock =
      instance.editor.querySelector("p, div, h1, h2, h3, h4, h5, h6, blockquote, pre") ||
      instance.editor;
    listRange = document.createRange();
    listRange.selectNodeContents(fontSizeBlock);
    globalThis.getSelection().removeAllRanges();
    globalThis.getSelection().addRange(listRange);
    instance.selection = listRange.cloneRange();
    await instance.executeCommand("setFontSize", "18px");
    await instance.executeCommand("setFontSize", "18px");
    assert(
      instance.editor.querySelectorAll('span[style*="font-size"]').length === 1,
      "rapid duplicate font-size commands created nested formatting",
    );
    const fontFamilyControl = document.querySelector(
      '.editra-toolbar [data-command="setFontFamily"]',
    );
    assert(
      fontFamilyControl?.querySelectorAll("option").length >= 20,
      "font selector has fewer than 20 families",
    );
    const languages = Object.entries(
      await instance.executeCommand("getLanguages"),
    ).map(([code, definition]) => ({ code, ...definition }));
    assert(
      languages.length >= 12 &&
        ["hi", "te", "ur", "ar"].every((code) =>
          languages.some((entry) => entry.code === code),
        ),
      "required multilingual options are missing",
    );
    await instance.executeCommand("setLanguage", "ur");
    assert(
      instance.editor.lang === "ur" && instance.editor.dir === "rtl",
      "Urdu did not apply RTL language state",
    );
    await instance.executeCommand("setLanguage", "en");
    assert(
      instance.editor.lang === "en" && instance.editor.dir === "ltr",
      "English did not restore LTR language state",
    );

    instance.setCode(
      '<p><span data-paint-source style="font-family:Georgia;font-size:20px;color:rgb(18, 52, 86);font-weight:700;background-color:rgb(255, 241, 118)">Source</span> <span data-paint-target>Target</span></p>',
    );
    await new Promise((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(resolve)),
    );
    let paintRange = document.createRange();
    paintRange.selectNodeContents(
      instance.editor.querySelector("[data-paint-source]"),
    );
    globalThis.getSelection().removeAllRanges();
    globalThis.getSelection().addRange(paintRange);
    instance.selection = paintRange.cloneRange();
    await instance.executeCommand("formatPainter");
    paintRange = document.createRange();
    paintRange.selectNodeContents(
      instance.editor.querySelector("[data-paint-target]"),
    );
    globalThis.getSelection().removeAllRanges();
    globalThis.getSelection().addRange(paintRange);
    instance.selection = paintRange.cloneRange();
    instance.editor.dispatchEvent(
      new PointerEvent("pointerup", { bubbles: true }),
    );
    await new Promise((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(resolve)),
    );
    const paintedTarget = instance.editor
      .querySelector("[data-paint-target]")
      ?.querySelector("span[style]");
    assert(
      paintedTarget &&
        paintedTarget.style.fontSize === "20px" &&
        paintedTarget.style.fontWeight === "700",
      "Format Painter did not copy source formatting to the target selection",
    );

    const backgroundControl = document.querySelector(
      '.editra-color-tool[data-command="setBackgroundColor"]',
    );
    backgroundControl?.click();
    const colorChooser = document.querySelector(
      ".editra-menu-chooser--setbackgroundcolor",
    );
    assert(
      colorChooser?.querySelectorAll(".editra-menu-color-grid button").length >=
        24 &&
        colorChooser.querySelector(
          '[data-menu-value="transparent"].editra-color-no-fill',
        ) &&
        colorChooser.querySelector(".editra-advanced-color input[type='color']"),
      "Word-style background palette, No Fill, or advanced chooser is missing",
    );
    colorChooser?.dispatchEvent(new CustomEvent("editra:close"));

    const emojiPopup = await instance.executeCommand("insertEmoji", {
      anchor: instance.toolbar.getButton("insertEmoji"),
    });
    assert(emojiPopup?.isConnected, "emoji popup did not open");
    document.body.dispatchEvent(
      new PointerEvent("pointerdown", { bubbles: true }),
    );
    assert(!emojiPopup?.isConnected, "emoji popup ignored an outside click");
    const typingPopup = await instance.executeCommand("insertEmoji", {
      anchor: instance.toolbar.getButton("insertEmoji"),
    });
    instance.editor.dispatchEvent(
      new InputEvent("beforeinput", {
        bubbles: true,
        inputType: "insertText",
        data: "x",
      }),
    );
    assert(!typingPopup?.isConnected, "emoji popup remained open while typing");

    const accessibilityDialog = instance.executeCommand("accessibility");
    assert(
      accessibilityDialog?.getAttribute("role") === "dialog" ||
        accessibilityDialog?.tagName === "DIALOG" ||
        accessibilityDialog?.querySelector("a[href*='COMPLIANCE.md']"),
      "Accessibility help dialog is not functional",
    );
    accessibilityDialog?.dispatchEvent(new CustomEvent("editra:close"));

    const layout = await instance.executeCommand("setPageSize", "A4");
    assert(
      layout?.height === "900px" &&
        Number.parseFloat(layout.width) >= 635 &&
        Number.parseFloat(layout.width) <= 637,
      "fixed-height A4 layout did not preserve height and adjust width",
    );

    instance.setCode("<p>Plugin regression content</p>");
    await new Promise((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(resolve)),
    );
    await instance.executeCommand("insertTable", { rows: 2, columns: 3 });
    assert(
      instance.editor.querySelectorAll("table tr").length === 2 &&
        instance.editor.querySelectorAll("table th, table td").length === 6,
      "table plugin failed to insert a 2 by 3 table",
    );
    await new Promise((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(resolve)),
    );
    assert(
      !tableMenu?.querySelector('[data-command="addRow"]')?.hidden,
      "table row actions did not appear after table insertion",
    );
    await instance.executeCommand("insertImage", {
      url: "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==",
      alt: "Regression image",
    });
    assert(
      instance.editor.querySelector('img[alt="Regression image"]'),
      "image plugin failed to insert media",
    );
    const regressionImage = instance.editor.querySelector(
      'img[alt="Regression image"]',
    );
    regressionImage.dispatchEvent(
      new PointerEvent("pointerdown", { bubbles: true }),
    );
    assert(
      regressionImage.closest(".editra-media-frame")?.classList.contains(
        "is-object-selected",
      ) ||
        regressionImage.closest(".editra-media-frame")?.classList.contains(
          "is-selected",
        ),
      "image object selection failed",
    );
    instance.editor.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "Delete",
        bubbles: true,
        cancelable: true,
      }),
    );
    assert(
      !instance.editor.querySelector('img[alt="Regression image"]'),
      "selected image was not deleted",
    );
    const navigationCount = performance.getEntriesByType("navigation").length;
    await instance.executeCommand("insertImage", {
      url: "https://assets.editra.test/stable.gif",
      alt: "Remote stable image",
    });
    const remoteImage = instance.editor.querySelector(
      'img[alt="Remote stable image"]',
    );
    console.log("remote-image-checkpoint", remoteImage?.complete, remoteImage?.loading);
    await new Promise((resolve) => {
      const onLoad = () => {
        console.log("remote-image-loaded");
        resolve();
      };
      if (remoteImage?.complete) {
        resolve();
        return;
      }
      remoteImage?.addEventListener("load", onLoad, { once: true });
      remoteImage?.addEventListener("error", onLoad, { once: true });
      setTimeout(() => {
        console.log("remote-image-timeout");
        resolve();
      }, 2000);
    });
    const beforeScroll = instance.getCode();
    globalThis.scrollTo(0, document.body.scrollHeight);
    globalThis.dispatchEvent(new Event("scroll"));
    await new Promise((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(resolve)),
    );
    assert(
      remoteImage.loading === "eager" || remoteImage.loading === "",
      "remote image is still lazy-loaded",
    );
    assert(
      instance.getCode() === beforeScroll ||
        instance.getCode().includes("Remote stable image"),
      "scrolling reset remote image state",
    );
    assert(
      performance.getEntriesByType("navigation").length === navigationCount,
      "remote image insertion caused a page navigation",
    );
    await instance.executeCommand("insertVideo", {
      file: new Blob(["Editra"], { type: "video/mp4" }),
    });
    assert(
      instance.editor.querySelector("video"),
      "video plugin failed to insert media",
    );

    const htmlExport = await instance.executeCommand("exportHTML", {
      download: false,
      returnHTML: true,
    });
    const wordExport = await instance.executeCommand("exportWord", {
      download: false,
      returnHTML: true,
    });
    const pdfExport = await instance.executeCommand("exportPDF", {
      print: false,
      returnHTML: true,
    });
    for (const [format, exported] of Object.entries({
      html: htmlExport,
      word: wordExport,
      pdf: pdfExport,
    })) {
      assert(exported?.format === format, `${format} export command failed`);
      assert(
        exported?.html?.includes("editra-export-page"),
        `${format} export omitted page layout`,
      );
    }

    instance.setCode(
      '<p><ins class="editra-change-insert" data-editra-change="insert">new</ins>' +
        '<del class="editra-change-delete" data-editra-change="delete">old</del>' +
        '<span class="editra-change-format" data-editra-change="format" style="color:red">styled</span></p>',
    );
    await new Promise((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(resolve)),
    );
    await instance.executeCommand("acceptAllChanges");
    assert(
      instance.editor.textContent.includes("new") &&
        !instance.editor.textContent.includes("old") &&
        instance.editor.querySelector('span[style*="color"]') &&
        !instance.editor.querySelector("[data-editra-change]"),
      `Accept All Changes semantics are incorrect: ${instance.getCode()}`,
    );
    instance.setCode(
      '<p><ins class="editra-change-insert" data-editra-change="insert">new</ins>' +
        '<del class="editra-change-delete" data-editra-change="delete">old</del>' +
        '<span class="editra-change-format" data-editra-change="format" style="color:red">styled</span></p>',
    );
    await new Promise((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(resolve)),
    );
    await instance.executeCommand("rejectAllChanges");
    assert(
      !instance.editor.textContent.includes("new") &&
        instance.editor.textContent.includes("old") &&
        !instance.editor.querySelector('span[style*="color"]') &&
        !instance.editor.querySelector("[data-editra-change]"),
      `Reject All Changes semantics are incorrect: ${instance.getCode()}`,
    );
    await new Promise((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(resolve)),
    );
    assert(
      cspViolations.length === 0,
      `CSP violations detected: ${cspViolations.join(", ")}`,
    );

    const security = instance.security;
    instance.destroy();
    assert(instance.destroyed, "destroy state missing");
    assert(!host.editraInstance, "instance reference leaked");
    assert(security.core === null, "security core reference leaked");

    const minimalHost = document.createElement("div");
    document.body.append(minimalHost);
    const minimal = await Editra.init({
      selector: minimalHost,
      plugins: ["bold"],
      toolbar: "bold",
    });
    const minimalMenuLabels = [
      ...minimal.toolbar.card.querySelectorAll(".editra-menu-trigger"),
    ].map((trigger) => trigger.textContent);
    assert(
      !minimalMenuLabels.includes("Table") &&
        !minimal.toolbar.card.querySelector('[data-command="insertImage"]'),
      "inactive plugin commands leaked into the minimal menus",
    );
    minimal.destroy();
    minimalHost.remove();

    const benchmark = await EditraCore.stressTest({ paragraphs: 1000 });
    assert(benchmark.paragraphs === 1000, "stress benchmark did not complete");
    document.body.dataset.benchmark = JSON.stringify(benchmark);
  } catch (error) {
    failures.push(error.stack || error.message);
  }

  document.body.setAttribute("data-test-status", failures.length ? "failed" : "passed");
  document.body.dataset.testStatus = failures.length ? "failed" : "passed";
  result.textContent = failures.length ? failures.join(" | ") : "passed";
})();
