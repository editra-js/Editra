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
        "codes",
      ],
      toolbar:
        "bold italic underline strikethrough formatPainter | fontFamily fontSize foreColor backgroundColor language | table image video insertEmoji insertBarcode insertQrCode trackChanges | undo redo",
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
    assert(
      instance.options.editorWidth === "8.5in" &&
        instance.options.editorHeight === "11in" &&
        instance.options.editorHeightFixed === false,
      "Word initialization accepted a custom page dimension",
    );

    const formatTrigger = [...document.querySelectorAll(".editra-menu-trigger")]
      .find((trigger) => trigger.textContent.trim() === "Format");
    formatTrigger?.click();
    const colorMenuItem = document.querySelector(
      '.editra-menu.is-open [data-command="setForeColor"]',
    );
    colorMenuItem?.dispatchEvent(
      new PointerEvent("pointerover", {
        bubbles: true,
        relatedTarget: formatTrigger,
      }),
    );
    const inlineChooser = document.querySelector(".editra-menu-chooser");
    const itemRect = colorMenuItem?.getBoundingClientRect();
    const chooserRect = inlineChooser?.getBoundingClientRect();
    assert(
      colorMenuItem?.classList.contains("has-submenu"),
      "menu item is missing its submenu indicator",
    );
    assert(
      colorMenuItem?.getAttribute("aria-expanded") === "true",
      "submenu parent did not expose its expanded state",
    );
    assert(
      colorMenuItem?.closest(".editra-menu")?.classList.contains("is-open"),
      "parent menu closed while its submenu was open",
    );
    assert(
      inlineChooser &&
        [...inlineChooser.querySelectorAll("button")].every(
          (button) => button.scrollWidth <= button.clientWidth + 1,
        ),
      "submenu width did not fit its widest item",
    );
    const textColorSwatch = inlineChooser?.querySelector(
      ".editra-menu-color-grid button",
    );
    assert(
      textColorSwatch &&
        Number.parseFloat(getComputedStyle(textColorSwatch).width) <= 13,
      `text color swatches are not compact Word-style squares (${getComputedStyle(textColorSwatch).width})`,
    );
    assert(
      getComputedStyle(inlineChooser).borderTopWidth ===
        getComputedStyle(inlineChooser).borderLeftWidth,
      "submenu retained card-like top-border styling",
    );
    assert(
      chooserRect &&
        itemRect &&
        (chooserRect.left >= itemRect.right - 8 ||
          chooserRect.right <= itemRect.left + 8),
      `submenu was not placed beside its parent (${JSON.stringify({
        itemLeft: itemRect?.left,
        itemRight: itemRect?.right,
        chooserLeft: chooserRect?.left,
        chooserRight: chooserRect?.right,
        chooserStyleLeft: inlineChooser?.style.left,
        hostLeft: colorMenuItem
          ?.closest(".editra-menu")
          ?.getBoundingClientRect().left,
      })})`,
    );
    instance.menubar.closeMenus();

    const shortcutDialog = await instance.executeCommand("shortcutKeys");
    assert(
      shortcutDialog?.querySelectorAll(".editra-shortcut-list kbd").length >= 17 &&
        shortcutDialog.textContent.includes("Ctrl/Cmd+Shift+8") &&
        shortcutDialog.textContent.includes("Delete / Backspace"),
      "Shortcut Keys dialog did not explain all available shortcuts",
    );
    shortcutDialog.dispatchEvent(new CustomEvent("editra:close"));

    const untriggeredCharacters = await instance.executeCommand(
      "special-characters",
    );
    assert(
      untriggeredCharacters === false &&
        !document.querySelector(".editra-popup--characters"),
      "Special Characters opened without an explicit menu or toolbar trigger",
    );
    const insertTrigger = [...document.querySelectorAll(".editra-menu-trigger")]
      .find((trigger) => trigger.textContent.trim() === "Insert");
    insertTrigger?.click();
    document
      .querySelector('.editra-menu.is-open [data-command="special-characters"]')
      ?.click();
    const characterPicker = document.querySelector(
      ".editra-popup--characters",
    );
    assert(
      characterPicker?.isConnected,
      "Special Characters did not open from its menu item",
    );
    characterPicker?.dispatchEvent(new CustomEvent("editra:close"));

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

    await instance.executeCommand("toggleCodeView", { enabled: true });
    const sourceView = instance.toolbar.card.querySelector(".editra-code-view");
    const sourceMarkup =
      '<section data-source-container="true" style="color: rgb(12, 34, 56)">Container <span>text</span></section>';
    sourceView.value = sourceMarkup;
    sourceView.dispatchEvent(new Event("input", { bubbles: true }));
    const sourceSave = await instance.executeCommand("saveHTMLSource", {
      download: false,
    });
    assert(
      sourceSave.html.includes("Container <span>text</span>") &&
        sourceSave.html.includes('data-source-container="true"') &&
        sourceSave.html.includes("color: rgb(12, 34, 56)") &&
        !sourceSave.html.includes("<style"),
      "HTML source save changed container text or injected CSS",
    );
    await instance.executeCommand("toggleCodeView", { enabled: false });
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

    listRange = document.createRange();
    listRange.selectNodeContents(instance.editor.querySelector("p"));
    globalThis.getSelection().removeAllRanges();
    globalThis.getSelection().addRange(listRange);
    instance.selection = listRange.cloneRange();
    await instance.executeCommand("numberList", "upper-roman");
    assert(
      instance.editor.querySelector("ol")?.style.listStyleType ===
        "upper-roman",
      "number list style option was not applied",
    );
    await instance.executeCommand("numberList");

    instance.setCode('<p><span style="font-size:18px">Stable list text</span></p>');
    await new Promise((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(resolve)),
    );
    listRange = document.createRange();
    listRange.selectNodeContents(instance.editor.querySelector("p"));
    globalThis.getSelection().removeAllRanges();
    globalThis.getSelection().addRange(listRange);
    instance.selection = listRange.cloneRange();
    await instance.executeCommand("bulletList");
    await instance.executeCommand("bulletList");
    assert(
      instance.editor.querySelectorAll('span[style*="font-size"]').length === 1 &&
        !instance.editor.querySelector("ul,ol"),
      "list toggling changed explicit font size or created redundant wrappers",
    );

    instance.placeCaretAtEnd();
    const barcodeResult = await instance.executeCommand("insertBarcode", {
      value: "123456789012",
      format: "EAN13",
    });
    assert(barcodeResult === true, "EAN-13 barcode insertion failed");
    const barcode = instance.editor.querySelector('[data-editra-barcode="1234567890128"]');
    const barcodeFrame = barcode?.closest(".editra-media-frame");
    assert(
      barcode?.dataset.editraBarcodeFormat === "EAN13" &&
        barcode.querySelectorAll("svg rect").length > 10 &&
        barcodeFrame?.draggable &&
        barcodeFrame.querySelectorAll(".editra-resize-handle").length === 4,
      "EAN-13 barcode SVG or computed check digit is invalid",
    );
    const invalidBarcode = await instance.executeCommand("insertBarcode", {
      value: "1234567890123",
      format: "EAN13",
    });
    assert(
      Boolean(invalidBarcode?.error),
      "invalid EAN-13 check digit was accepted",
    );

    instance.placeCaretAtEnd();
    const qrValue = "https://example.com/editra?step=27";
    const qrResult = await instance.executeCommand("insertQrCode", {
      value: qrValue,
    });
    assert(qrResult === true, "QR code insertion failed");
    const qrCode = instance.editor.querySelector(`[data-editra-qr="${qrValue}"]`);
    const qrFrame = qrCode?.closest(".editra-media-frame");
    const qrViewBox = qrCode?.querySelector("svg")?.getAttribute("viewBox") || "";
    const qrExtent = Number(qrViewBox.split(/\s+/).at(-1));
    assert(
      qrCode?.dataset.editraQrErrorCorrection === "M" &&
        qrFrame?.draggable &&
        qrFrame.querySelectorAll(".editra-resize-handle").length === 4 &&
        qrExtent >= 29 &&
        (qrCode.querySelector("path")?.getAttribute("d") || "").length > 200,
      "QR encoder did not produce a standards-sized matrix",
    );
    const serializedCodes = instance.getCode();
    assert(
      serializedCodes.includes("data-editra-barcode") &&
        serializedCodes.includes("data-editra-qr") &&
        serializedCodes.includes("<svg"),
      "serialized document did not preserve generated codes",
    );
    const exportedCodes = await instance.executeCommand("exportHTML", {
      download: false,
      returnHTML: true,
    });
    assert(
      exportedCodes.html.includes("data-editra-barcode") &&
        exportedCodes.html.includes("data-editra-qr") &&
        exportedCodes.html.includes("<svg"),
      "HTML export did not preserve generated codes",
    );
    const pdfCodes = await instance.executeCommand("exportPDF", {
      print: false,
      returnHTML: true,
    });
    assert(
      pdfCodes.html.includes("data-editra-barcode") &&
        pdfCodes.html.includes("data-editra-qr") &&
        pdfCodes.html.includes("<svg"),
      "PDF render input did not preserve generated codes",
    );
    for (const [format, exported] of Object.entries({
      html: exportedCodes,
      pdf: pdfCodes,
    })) {
      const exportDocument = new DOMParser().parseFromString(
        exported.html,
        "text/html",
      );
      const qrPath = exported.html.match(/<path[^>]+d="([^"]+)"/i)?.[1] || "";
      assert(
        (exported.html.match(/<rect\b/gi) || []).length > 20 &&
          /viewBox="0 0 \d+ \d+"/i.test(exported.html) &&
          qrPath.length > 200 &&
          !exported.html.includes("editra-resize-handle"),
        `${format} export damaged vector code geometry or retained editor UI`,
      );
    }

    instance.placeCaretAtEnd();
    await instance.executeCommand("insertEmoji", { emoji: "\u{1F642}" });
    const emojiObject = instance.editor.querySelector(".editra-emoji-object");
    assert(
      emojiObject?.draggable &&
        emojiObject.dataset.editraSelectable === "true",
      "emoji was not inserted as a selectable draggable object",
    );
    instance.placeCaretAtEnd();
    await instance.executeCommand("special-characters", { character: "\u20AC" });
    await instance.executeCommand("insertDateTime", {
      mode: "date",
      date: new Date("2026-07-28T12:00:00Z"),
    });
    assert(
      instance.editor.textContent.includes("\u20AC") &&
        instance.editor.querySelector("time[datetime]"),
      "special character or date insertion failed",
    );
    instance.editor.insertAdjacentHTML(
      "beforeend",
      '<p data-export-semantics>Formula <sup>2</sup> and H<sub>2</sub>O</p>' +
        '<blockquote data-export-quote>Exported quotation</blockquote>',
    );
    const semanticHTMLExport = await instance.executeCommand("exportHTML", {
      download: false,
      returnHTML: true,
    });
    const semanticPDFExport = await instance.executeCommand("exportPDF", {
      print: false,
      returnHTML: true,
    });
    for (const [format, exported] of Object.entries({
      html: semanticHTMLExport,
      pdf: semanticPDFExport,
    })) {
      const exportDocument = new DOMParser().parseFromString(
        exported.html,
        "text/html",
      );
      assert(
        exportDocument.querySelector("sup") &&
          exportDocument.querySelector("sub") &&
          exportDocument.querySelector("blockquote") &&
          exportDocument.querySelector("time[datetime]") &&
          exportDocument.body.textContent.includes("\u20AC") &&
          exportDocument.querySelector(".editra-emoji-object"),
        `${format} export lost semantic or special-character content`,
      );
      assert(
        !exportDocument.querySelector(".editra-resize-handle"),
        `${format} export retained editor resize controls`,
      );
      assert(
        exported.html.includes(".editra-barcode svg") &&
          exported.html.includes("shape-rendering: crispEdges") &&
          exported.html.includes("break-inside: avoid"),
        `${format} export omitted stable code layout styles`,
      );
    }

    instance.setCode("<p>const answer = 42;</p>");
    await new Promise((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(resolve)),
    );
    const sourceParagraph = instance.editor.querySelector("p");
    const codeRange = document.createRange();
    codeRange.selectNodeContents(sourceParagraph);
    globalThis.getSelection().removeAllRanges();
    globalThis.getSelection().addRange(codeRange);
    instance.selection = codeRange.cloneRange();
    await instance.executeCommand("insertCodeBlock", "javascript");
    const configurableCodeBlock =
      instance.editor.querySelector(".editra-code-block");
    assert(
      configurableCodeBlock?.dataset.editraSyntax === "highlighted" &&
        configurableCodeBlock.dataset.editraCodeLanguage === "javascript" &&
        configurableCodeBlock.querySelector(
          "code.language-javascript .editra-code-token",
        ),
      "Code Block highlighting mode was not applied",
    );
    const codeCaret = document.createRange();
    codeCaret.selectNodeContents(configurableCodeBlock.querySelector("code"));
    codeCaret.collapse(true);
    globalThis.getSelection().removeAllRanges();
    globalThis.getSelection().addRange(codeCaret);
    instance.selection = codeCaret.cloneRange();
    await instance.executeCommand("setCodeBlockBackground", "#eaf2ff");
    await instance.executeCommand("insertCodeBlock", "plain");
    assert(
      configurableCodeBlock.style.backgroundColor === "rgb(234, 242, 255)" &&
        configurableCodeBlock.dataset.editraSyntax === "plain" &&
        !configurableCodeBlock.classList.contains("is-syntax-highlighted"),
      "Code Block background or plain-text mode is not configurable",
    );
    const codeBlockExport = await instance.executeCommand("exportHTML", {
      download: false,
      returnHTML: true,
    });
    assert(
      codeBlockExport.html.includes("data-editra-code-background") &&
        codeBlockExport.html.includes("background-color: rgb(234, 242, 255)"),
      "Code Block background did not persist in export",
    );

    instance.setCode("<p>Toggle formatting</p>");
    await new Promise((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(resolve)),
    );
    let formattingRange = document.createRange();
    formattingRange.selectNodeContents(instance.editor.querySelector("p"));
    globalThis.getSelection().removeAllRanges();
    globalThis.getSelection().addRange(formattingRange);
    instance.selection = formattingRange.cloneRange();
    await instance.executeCommand("strikethrough");
    await instance.executeCommand("strikethrough");
    assert(!instance.editor.querySelector("s"), "strikethrough did not toggle off");
    formattingRange = document.createRange();
    formattingRange.selectNodeContents(instance.editor.querySelector("p"));
    globalThis.getSelection().removeAllRanges();
    globalThis.getSelection().addRange(formattingRange);
    instance.selection = formattingRange.cloneRange();
    await instance.executeCommand("superscript");
    assert(instance.editor.querySelector("sup"), "superscript was not applied");
    await instance.executeCommand("superscript");
    assert(!instance.editor.querySelector("sup"), "superscript did not toggle off");

    instance.setCode("<p>Font size test</p>");
    await new Promise((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(resolve)),
    );

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
    const paintedExport = await instance.executeCommand("exportHTML", {
      download: false,
      returnHTML: true,
    });
    assert(
      paintedExport.html.includes('font-size: 20px') &&
        paintedExport.html.includes('font-weight: 700'),
      "HTML export did not preserve Format Painter styles",
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
    const backgroundSwatch = colorChooser?.querySelector(
      ".editra-menu-color-grid button",
    );
    assert(
      backgroundSwatch &&
        Number.parseFloat(getComputedStyle(backgroundSwatch).width) <= 13,
      `background color swatches are not compact Word-style squares (${getComputedStyle(backgroundSwatch).width})`,
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
      layout?.width === "210mm" &&
        layout?.height === "297mm" &&
        instance.options.editorWidth === "210mm" &&
        instance.options.editorHeight === "297mm",
      "Word theme did not enforce the standard A4 dimensions",
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

    const form = document.createElement("form");
    const textarea = document.createElement("textarea");
    textarea.name = "content";
    textarea.defaultValue =
      '<p>Textarea content</p><img src="data:image/gif;base64,R0lGODlhAQABAAAAACw=" onerror="globalThis.textareaXss=true"><script>globalThis.textareaXss=true</script>';
    textarea.value = textarea.defaultValue;
    form.append(textarea);
    document.body.append(form);
    const textareaEditor = await Editra.init({
      selector: textarea,
      theme: "Classic",
      plugins: ["bold", "structure"],
      toolbar: "bold insertPageBreak",
    });
    assert(textarea.hidden, "textarea host was not hidden while active");
    assert(
      !textareaEditor.getCode().includes("onerror") &&
        !textareaEditor.getCode().includes("<script") &&
        globalThis.textareaXss !== true,
      "textarea initial HTML bypassed sanitization",
    );
    assert(
      textareaEditor.host === textarea &&
        textareaEditor.options.theme === "Classic" &&
        textareaEditor.toolbar.card.classList.contains("editra-theme-classic"),
      "Classic textarea surface was not configured",
    );
    assert(
      textareaEditor.state.pageCount === null,
      "Classic theme introduced automatic page numbering",
    );
    textareaEditor.setCode("<p>Updated textarea</p>");
    await new Promise((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(resolve)),
    );
    assert(
      textarea.value.includes("Updated textarea"),
      "textarea value did not synchronize editor changes",
    );
    form.reset();
    await new Promise((resolve) => setTimeout(resolve, 30));
    await new Promise((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(resolve)),
    );
    assert(
      textareaEditor.getCode().includes("Textarea content"),
      "form reset did not restore textarea default content",
    );
    const classicCustomSize = textareaEditor.setEditorSize({
      width: "640px",
      height: "480px",
    });
    assert(
      classicCustomSize.width === "640px" &&
        classicCustomSize.height === "480px",
      "Classic theme no longer accepts flexible dimensions",
    );
    textareaEditor.destroy();
    assert(
      !textarea.hidden && textarea.style.display === "" && !textarea.editraInstance,
      "textarea host was not restored after destroy",
    );
    form.remove();

    const wordHost = document.createElement("div");
    document.body.append(wordHost);
    const wordEditor = await Editra.init({
      selector: wordHost,
      theme: "Word",
      pageSize: "A4",
      plugins: ["bold", "pagination", "export", "pagesize"],
      toolbar: "bold",
    });
    assert(
      wordEditor.options.theme === "Word" &&
        wordEditor.toolbar.card.classList.contains("editra-theme-word") &&
        wordEditor.state.pageCount >= 1,
      "Word theme was not configured",
    );
    wordEditor.applyPageMargins({
      top: 24,
      right: 24,
      bottom: 24,
      left: 24,
    });
    wordEditor.setCode(
      '<p style="height:1030px">This is line on Page 1</p>' +
        '<p>This is line on Page 2</p>',
    );
    await wordEditor.ensurePlugin("pagination");
    await wordEditor.ensurePlugin("export");
    wordEditor.editor.dispatchEvent(new InputEvent("input", { bubbles: true }));
    await wordEditor.executeCommand("reflowPagination");
    await new Promise((resolve) => setTimeout(resolve, 100));
    await new Promise((resolve) =>
      requestAnimationFrame(() =>
        requestAnimationFrame(() => requestAnimationFrame(resolve)),
      ),
    );
    const wordHTML = wordEditor.getCode();
    const automaticFlowSpacers = wordEditor.editor.querySelectorAll(
      ':scope > .editra-pagination-spacer[data-editra-flow-spacer="automatic-flow"]',
    ).length;
    const wordBlockMetrics = [...wordEditor.editor.children].map((element) => ({
      tag: element.tagName,
      top: element.offsetTop,
      height: element.getBoundingClientRect().height,
      spacer: element.dataset.editraFlowSpacer || null,
    }));
    const paginationDiagnostics = {
      plugin: Boolean(wordEditor.plugins.get("pagination")?.action),
      command: wordEditor.commands.has("reflowPagination"),
      height: wordEditor.options.editorHeight,
      paddingTop: getComputedStyle(wordEditor.editor).paddingTop,
      paddingBottom: getComputedStyle(wordEditor.editor).paddingBottom,
    };
    assert(
      wordEditor.state.pageCount === 2 &&
        automaticFlowSpacers === 1 &&
        (wordHTML.match(/<p\b/g) || []).length === 2 &&
        !wordHTML.includes("editra-pagination-spacer") &&
        !wordHTML.includes("editra-page-break"),
      `native page flow regression (${JSON.stringify({ pageCount: wordEditor.state.pageCount, automaticFlowSpacers, wordBlockMetrics, paginationDiagnostics })}): ${wordHTML}`,
    );
    const physicalPageHeight = wordEditor.resolveEditorPixels(
      wordEditor.options.editorHeight,
      "11in",
    );
    const renderedSurfaceHeight = wordEditor.editor.getBoundingClientRect().height;
    const renderedGuides = [...wordEditor.pageGuides.querySelectorAll(
      ".editra-page-guide",
    )].map((guide) => guide.getBoundingClientRect().height);
    assert(
      Math.abs(renderedSurfaceHeight - physicalPageHeight * 2) < 1 &&
        renderedGuides.length === 2 &&
        renderedGuides.every(
          (height) => Math.abs(height - physicalPageHeight) < 1,
        ),
      `Word pages did not retain equal full physical heights: ${JSON.stringify({ physicalPageHeight, renderedSurfaceHeight, renderedGuides })}`,
    );
    const wordPrint = await wordEditor.executeCommand("exportPDF", {
      print: false,
      returnHTML: true,
    });
    const printedDocument = new DOMParser().parseFromString(
      wordPrint.html,
      "text/html",
    );
    const printedPages = [...printedDocument.querySelectorAll(
      ".editra-export-page",
    )];
    assert(
      printedPages.length === 2 &&
        printedPages[0].textContent.includes("This is line on Page 1") &&
        !printedPages[0].textContent.includes("This is line on Page 2") &&
        printedPages[1].textContent.includes("This is line on Page 2"),
      "print rendering did not preserve the editor's native page separation",
    );
    const a4Layout = await wordEditor.executeCommand("setPageSize", "A4");
    await new Promise((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(resolve)),
    );
    const a4Export = await wordEditor.executeCommand("exportHTML", {
      download: false,
      returnHTML: true,
    });
    assert(
      a4Layout.width === "210mm" &&
        a4Layout.height === "297mm" &&
        wordEditor.options.editorWidth === "210mm" &&
        wordEditor.options.editorHeight === "297mm" &&
        /@page\s*\{\s*size:\s*210mm 297mm;\s*margin:\s*0;\s*\}/.test(
          a4Export.html,
        ) &&
        /width:\s*210mm;\s*height:\s*297mm;/.test(a4Export.html),
      `A4 physical dimensions diverged between editor and print-ready HTML: ${JSON.stringify({ layout: a4Layout, editorWidth: wordEditor.options.editorWidth, editorHeight: wordEditor.options.editorHeight, pageRule: a4Export.html.match(/@page[^}]+}/)?.[0], pageBox: a4Export.html.match(/\.editra-export-page\s*\{[^}]+}/)?.[0] })}`,
    );
    const protectedWidth = wordEditor.options.editorWidth;
    const protectedHeight = wordEditor.options.editorHeight;
    const directResize = wordEditor.setEditorSize({
      width: "500px",
      height: "600px",
    });
    const customResize = await wordEditor.executeCommand("setCustomPageSize", {
      width: "500px",
      height: "600px",
    });
    assert(
      directResize === false &&
        customResize === false &&
        wordEditor.options.editorWidth === protectedWidth &&
        wordEditor.options.editorHeight === protectedHeight,
      "Word theme accepted a custom page width or height",
    );
    const contentOnlyWord = await wordEditor.executeCommand(
      "printContentOnly",
      { print: false },
    );
    const forcedContentOnlyExport = await wordEditor.executeCommand(
      "exportHTML",
      { download: false, returnHTML: true, contentOnly: true },
    );
    assert(
      contentOnlyWord === false &&
        /@page\s*\{\s*size:\s*210mm 297mm;/.test(
          forcedContentOnlyExport.html,
        ),
      "Word theme allowed content-only printing to change physical page size",
    );
    const landscapeA4 = await wordEditor.executeCommand("setPageSize", {
      size: "A4",
      orientation: "landscape",
    });
    assert(
      landscapeA4.width === "297mm" && landscapeA4.height === "210mm",
      "Word theme did not apply fixed A4 landscape dimensions",
    );
    wordEditor.destroy();
    wordHost.remove();

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
