(function (global) {
  "use strict";

  const bootstrapScript = document.currentScript;
  const projectBase = new URL("../", bootstrapScript.src);
  const scriptPromises = new Map();
  const loaderPolicySymbol = Symbol.for("editra.loaderPolicy");
  let loaderPolicy = global[loaderPolicySymbol] ?? null;
  if (!loaderPolicy && global.trustedTypes?.createPolicy) {
    try {
      loaderPolicy = global.trustedTypes.createPolicy("editra-loader", {
        createScriptURL(value) {
          const url = new URL(String(value), document.baseURI);
          if (url.origin !== global.location.origin) {
            throw new TypeError("Editra blocked a cross-origin runtime script.");
          }
          return url.href;
        },
      });
    } catch {
      loaderPolicy = null;
    }
  }
  global[loaderPolicySymbol] = loaderPolicy;

  const PLUGIN_DEFINITIONS = Object.freeze({
    bold: {
      file: "plugins/bold.js",
      label: "Bold",
      icon: "bold",
      shortcut: "b",
    },
    italic: {
      file: "plugins/italic.js",
      label: "Italic",
      icon: "italic",
      shortcut: "i",
    },
    underline: {
      file: "plugins/underline.js",
      label: "Underline",
      icon: "underline",
      shortcut: "u",
    },
    table: {
      file: "plugins/table.js",
      css: "plugins/table.css",
      label: "Insert table",
      icon: "table",
      command: "insertTable",
      aliases: ["selectTable", "deleteTable"],
      toolbarItems: [
        { name: "table", command: "insertTable", label: "Insert table", icon: "table" },
        { name: "tableBorderColor", command: "setTableBorderColor", label: "Table border color", icon: "borderColor", type: "color", value: "#1f1f1f" },
      ],
      lazy: true,
    },
    image: {
      file: "plugins/image.js",
      css: "plugins/image.css",
      label: "Insert image",
      icon: "image",
      command: "insertImage",
      lazy: true,
    },
    video: {
      file: "plugins/video.js",
      label: "Insert video",
      icon: "video",
      command: "insertVideo",
      lazy: true,
    },
    productivity: {
      file: "plugins/productivity.js",
      label: "Format Painter",
      icon: "formatPainter",
      command: "formatPainter",
      lazy: true,
    },
    export: {
      file: "plugins/export.js",
      label: "Page-fidelity export",
      command: "exportPDF",
      hidden: true,
      lazy: true,
    },
    collaboration: {
      file: "plugins/collaboration.js",
      label: "Track changes",
      icon: "trackChanges",
      command: "trackChanges",
      toolbarItems: [
        {
          name: "trackChanges",
          command: "trackChanges",
          label: "Track changes",
          icon: "trackChanges",
        },
        {
          name: "addComment",
          command: "addComment",
          label: "Add comment",
          icon: "comment",
        },
      ],
      lazy: true,
    },
    formatting: {
      file: "plugins/formatting.js",
      css: "plugins/formatting.css",
      label: "Text color",
      command: "setForeColor",
      lazy: true,
      toolbarItems: [
        { name: "foreColor", command: "setForeColor", label: "Text color", icon: "textColor", type: "color", value: "#25231f" },
        { name: "backgroundColor", command: "setBackgroundColor", aliases: ["backColor"], label: "Background color", icon: "palette", type: "color", value: "#fff2a8" },
        { name: "highlighter", command: "highlightText", label: "Highlighter", icon: "highlighter", type: "color", value: "#fff176" },
        { name: "strikethrough", command: "strikethrough", label: "Strikethrough", icon: "strikethrough" },
        { name: "superscript", command: "superscript", label: "Superscript", icon: "superscript" },
        { name: "subscript", command: "subscript", label: "Subscript", icon: "subscript" },
        { name: "blockQuote", command: "blockQuote", label: "Block quote", icon: "blockQuote" },
        { name: "alignment", command: "setAlignment", label: "Alignment", type: "select", value: "left", options: [["left", "Align left"], ["center", "Align center"], ["right", "Align right"], ["justify", "Justify"]] },
        { name: "lineHeight", command: "setLineHeight", label: "Line height", type: "select", value: "1.5", options: [["1", "1.0"], ["1.15", "1.15"], ["1.5", "1.5"], ["1.85", "1.85"], ["2", "2.0"], ["2.5", "2.5"]] },
      ],
    },
    fonts: {
      file: "plugins/fonts.js",
      label: "Font family",
      command: "setFontFamily",
      lazy: true,
      toolbarItems: [
        { name: "fontFamily", command: "setFontFamily", label: "Font family", type: "select", value: "Calibri", options: [["Segoe UI", "Segoe UI"], ["Calibri", "Calibri"], ["Arial", "Arial"], ["Helvetica", "Helvetica"], ["Times New Roman", "Times New Roman"], ["Georgia", "Georgia"], ["Garamond", "Garamond"], ["Verdana", "Verdana"], ["Tahoma", "Tahoma"], ["Trebuchet MS", "Trebuchet MS"], ["Courier New", "Courier New"], ["Consolas", "Consolas"], ["Cambria", "Cambria"], ["Candara", "Candara"], ["Century Gothic", "Century Gothic"], ["Franklin Gothic Medium", "Franklin Gothic Medium"], ["Palatino Linotype", "Palatino Linotype"], ["Book Antiqua", "Book Antiqua"], ["Lucida Sans Unicode", "Lucida Sans Unicode"], ["Impact", "Impact"], ["Noto Sans", "Noto Sans"], ["Noto Serif", "Noto Serif"], ["Arial Unicode MS", "Arial Unicode MS"]] },
        { name: "fontSize", command: "setFontSize", label: "Font size", type: "select", value: "12px", options: Array.from({ length: 29 }, (_, index) => [`${index + 8}px`, String(index + 8)]) },
      ],
    },
    languages: {
      file: "plugins/languages.js",
      label: "Document language",
      command: "setLanguage",
      lazy: true,
      toolbarItems: [
        {
          name: "language",
          command: "setLanguage",
          label: "Document language",
          type: "select",
          value: "en",
          options: [
            ["en", "English"],
            ["hi", "Hindi - हिन्दी"],
            ["te", "Telugu - తెలుగు"],
            ["ur", "Urdu - اردو"],
            ["ar", "Arabic - العربية"],
            ["es", "Spanish - Español"],
            ["fr", "French - Français"],
            ["de", "German - Deutsch"],
            ["pt", "Portuguese - Português"],
            ["zh", "Chinese - 中文"],
            ["ja", "Japanese - 日本語"],
            ["ko", "Korean - 한국어"],
          ],
        },
      ],
    },
    headings: {
      file: "plugins/headings.js",
      label: "Heading",
      command: "setHeading",
      lazy: true,
      toolbarItems: [
        { name: "heading", command: "setHeading", label: "Heading", type: "select", value: "p", options: [["p", "Normal"], ["h1", "Heading 1"], ["h2", "Heading 2"], ["h3", "Heading 3"], ["h4", "Heading 4"], ["h5", "Heading 5"], ["h6", "Heading 6"]] },
      ],
    },
    lists: {
      file: "plugins/lists.js",
      label: "Bullet list",
      command: "bulletList",
      lazy: true,
      toolbarItems: [
        { name: "bulletList", command: "bulletList", label: "Bullet list", icon: "bulletList" },
        { name: "numberList", command: "numberList", label: "Number list", icon: "numberList" },
        { name: "multilevelList", command: "multilevelList", label: "Multilevel list", icon: "multilevelList" },
        { name: "todoList", command: "todoList", label: "TODO list", icon: "todoList" },
        { name: "decreaseIndent", command: "decreaseIndent", label: "Decrease indent", icon: "outdent" },
        { name: "increaseIndent", command: "increaseIndent", label: "Increase indent", icon: "indent" },
      ],
    },
    structure: {
      file: "plugins/structure.js",
      label: "Emoji",
      command: "insertEmoji",
      lazy: true,
      toolbarItems: [
        { name: "emoji", command: "insertEmoji", label: "Emoji", icon: "emoji" },
        { name: "specialCharacters", command: "special-characters", label: "Special characters", icon: "specialCharacters" },
        { name: "dateTime", command: "insertDateTime", label: "Insert date and time", icon: "dateTime" },
        { name: "codeBlock", command: "insertCodeBlock", label: "Code block", icon: "codeBlock" },
        { name: "horizontalLine", command: "insertHorizontalLine", label: "Horizontal line", icon: "horizontalLine" },
        { name: "pageBreak", command: "insertPageBreak", label: "Page break", icon: "pageBreak" },
        { name: "toc", command: "insertTableOfContents", label: "Table of contents", icon: "toc" },
      ],
    },
    codes: {
      file: "plugins/codes.js",
      label: "Barcode and QR code",
      command: "insertBarcode",
      lazy: true,
      toolbarItems: [
        { name: "insertBarcode", command: "insertBarcode", label: "Barcode", icon: "barcode" },
        { name: "insertQrCode", command: "insertQrCode", label: "QR code", icon: "qrCode" },
      ],
    },
    pagination: {
      file: "plugins/pagination.js",
      label: "Pagination",
      command: "toggleKeepTogether",
      toolbarItems: [
        { name: "keepTogether", command: "toggleKeepTogether", label: "Keep block together", icon: "keepTogether" },
        { name: "keepWithNext", command: "KeepWithNext", label: "Keep with next", icon: "keepWithNext" },
        { name: "paginationPageBreak", command: "InsertPageBreak", label: "Insert page break", icon: "pageBreak" },
      ],
    },
    codeview: {
      file: "plugins/codeview.js",
      label: "HTML code view",
      icon: "codeView",
      command: "toggleCodeView",
      lazy: true,
    },
    paste: {
      file: "plugins/paste.js",
      label: "Paste handling",
      hidden: true,
    },
    uiConfig: {
      file: "plugins/ui-config.js",
      label: "UI configuration",
      hidden: true,
    },
    theme: {
      file: "plugins/theme.js",
      label: "Theme",
      command: "toggleTheme",
      aliases: ["toggle-theme", "setTheme"],
      hidden: true,
    },
    shortcuts: {
      file: "plugins/shortcuts.js",
      label: "Keyboard shortcuts",
      hidden: true,
    },
    ruler: {
      file: "plugins/ruler.js",
      label: "Document ruler",
      command: "toggleRuler",
      hidden: true,
      lazy: true,
    },
    headerfooter: {
      file: "plugins/headerfooter.js",
      label: "Header and footer",
      command: "insertHeader",
      aliases: ["insertFooter", "removeHeader", "removeFooter"],
      hidden: true,
      lazy: true,
    },
    pagesize: {
      file: "plugins/pagesize.js",
      label: "Page size",
      command: "setPageSize",
      aliases: ["setOrientation", "setCustomPageSize", "printContentOnly"],
      hidden: true,
      lazy: true,
      toolbarItems: [
        { name: "pageSize", command: "setPageSize", label: "Page size", type: "select", value: "Letter", options: [["A3", "A3"], ["A4", "A4"], ["A5", "A5"], ["B4", "B4"], ["B5", "B5"], ["Letter", "Letter"], ["Legal", "Legal"], ["Executive", "Executive"], ["Tabloid", "Tabloid"], ["Ledger", "Ledger"], ["Statement", "Statement"], ["Folio", "Folio"], ["Quarto", "Quarto"], ["10x14", "10 × 14"], ["C5 Envelope", "C5 Envelope"]] },
        { name: "orientation", command: "setOrientation", label: "Orientation", type: "select", value: "portrait", options: [["portrait", "Portrait"], ["landscape", "Landscape"]] },
      ],
    },
    margins: {
      file: "plugins/margins.js",
      label: "Page margins",
      command: "setMargin",
      hidden: true,
      lazy: true,
      toolbarItems: [
        { name: "margins", command: "setMargin", label: "Margins", type: "select", value: "normal", options: [["normal", "Normal"], ["narrow", "Narrow"], ["moderate", "Moderate"], ["wide", "Wide"]] },
      ],
    },
    ecosystem: {
      file: "plugins/ecosystem.js",
      label: "Plugin ecosystem",
      command: "installCommunityPlugin",
      aliases: [
        "uninstallCommunityPlugin",
        "getInstalledCommunityPlugins",
        "checkCommunityPluginUpdates",
      ],
      hidden: true,
      lazy: true,
    },
  });

  const DEFAULT_PLUGINS = Object.freeze(Object.keys(PLUGIN_DEFINITIONS));
  const HEAVY_COMMAND_FILES = Object.freeze({
    "export-pdf": "plugins/export.js",
    "export-word": "plugins/export.js",
    exportPDF: "plugins/export.js",
    exportWord: "plugins/export.js",
    exportHTML: "plugins/export.js",
    "import-word": "plugins/export.js",
  });
  const PLUGIN_COMMANDS = Object.freeze({
    insertTable: "table",
    mergeCells: "table",
    splitCell: "table",
    addRow: "table",
    deleteRow: "table",
    addColumn: "table",
    deleteColumn: "table",
    setTableBorder: "table",
    setTableBorderColor: "table",
    setCellBackground: "table",
    setTableAlignment: "table",
    selectTable: "table",
    deleteTable: "table",
    tableStressTest: "table",
    insertImage: "image",
    insertVideo: "video",
    mediaStressTest: "image",
    findReplace: "productivity",
    formatPainter: "productivity",
    insertMergeField: "productivity",
    previewMergeFields: "productivity",
    exportPDF: "export",
    exportWord: "export",
    exportHTML: "export",
    exportDocument: "export",
    exportStressTest: "export",
    exportMarkdown: "productivity",
    importWord: "productivity",
    importHTML: "productivity",
    productivityStressTest: "productivity",
    trackChanges: "collaboration",
    addComment: "collaboration",
    showComments: "collaboration",
    replyComment: "collaboration",
    resolveComment: "collaboration",
    viewRevisionHistory: "collaboration",
    restoreRevision: "collaboration",
    connectCollaboration: "collaboration",
    disconnectCollaboration: "collaboration",
    collaborationStressTest: "collaboration",
    acceptAllChanges: "collaboration",
    rejectAllChanges: "collaboration",
    setFontFamily: "fonts",
    setFontSize: "fonts",
    fontsStressTest: "fonts",
    setLanguage: "languages",
    getLanguages: "languages",
    setForeColor: "formatting",
    setBackgroundColor: "formatting",
    highlightText: "formatting",
    setHeading: "headings",
    applyHeading: "headings",
    headingsStressTest: "headings",
    strikethrough: "formatting",
    superscript: "formatting",
    subscript: "formatting",
    blockQuote: "formatting",
    setAlignment: "formatting",
    setLineHeight: "formatting",
    formattingStressTest: "formatting",
    bulletList: "lists",
    numberList: "lists",
    multilevelList: "lists",
    todoList: "lists",
    increaseIndent: "lists",
    decreaseIndent: "lists",
    listsStressTest: "lists",
    insertEmoji: "structure",
    "special-characters": "structure",
    insertDateTime: "structure",
    insertBarcode: "codes",
    insertQrCode: "codes",
    insertPageBreak: "structure",
    insertHorizontalLine: "structure",
    insertTableOfContents: "structure",
    updateTableOfContents: "structure",
    insertCodeBlock: "structure",
    setCodeBlockBackground: "structure",
    structureStressTest: "structure",
    setPaginationRules: "pagination",
    toggleKeepTogether: "pagination",
    setKeepTogether: "pagination",
    setListItemSplitting: "pagination",
    setTablePagination: "pagination",
    setCodeBlockSplitting: "pagination",
    KeepWithNext: "pagination",
    keepWithNext: "pagination",
    InsertPageBreak: "pagination",
    reflowPagination: "pagination",
    paginationStressTest: "pagination",
    toggleCodeView: "codeview",
    codeViewStressTest: "codeview",
    pasteHTML: "paste",
    sanitizeHTML: "paste",
    setUIConfig: "uiConfig",
    showMenuBar: "uiConfig",
    hideMenuBar: "uiConfig",
    toggleRuler: "ruler",
    setRulerMargins: "ruler",
    setIndent: "ruler",
    setTabStop: "ruler",
    removeTabStop: "ruler",
    rulerStressTest: "ruler",
    insertHeader: "headerfooter",
    insertFooter: "headerfooter",
    removeHeader: "headerfooter",
    removeFooter: "headerfooter",
    headerFooterStressTest: "headerfooter",
    setPageSize: "pagesize",
    setOrientation: "pagesize",
    setCustomPageSize: "pagesize",
    getPageSizes: "pagesize",
    printContentOnly: "pagesize",
    pageSizeStressTest: "pagesize",
    setMargin: "margins",
    getMargins: "margins",
    marginsStressTest: "margins",
    toggleTheme: "theme",
    "toggle-theme": "theme",
    setTheme: "theme",
    getTheme: "theme",
    installCommunityPlugin: "ecosystem",
    uninstallCommunityPlugin: "ecosystem",
    getInstalledCommunityPlugins: "ecosystem",
    checkCommunityPluginUpdates: "ecosystem",
  });
  const SYSTEM_PLUGINS = Object.freeze([
    "paste",
    "uiConfig",
    "theme",
    "shortcuts",
    "ecosystem",
  ]);

  function loadScript(relativePath, securityConfig = null) {
    if (scriptPromises.has(relativePath)) return scriptPromises.get(relativePath);

    const promise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      const url = new URL(relativePath, projectBase);
      const allowedOrigins =
        securityConfig?.allowedPluginOrigins ?? [global.location.origin];
      if (!allowedOrigins.includes(url.origin)) {
        reject(new TypeError(`Editra blocked plugin origin: ${url.origin}`));
        return;
      }
      const integrity = securityConfig?.pluginIntegrity?.[relativePath];
      if (securityConfig?.requirePluginIntegrity && !integrity) {
        reject(
          new TypeError(`Editra requires an integrity hash for ${relativePath}.`),
        );
        return;
      }
      script.src = loaderPolicy?.createScriptURL
        ? loaderPolicy.createScriptURL(url.href)
        : url.href;
      if (integrity) {
        script.integrity = integrity;
        script.crossOrigin = "anonymous";
      }
      if (securityConfig?.pluginNonce) {
        script.nonce = securityConfig.pluginNonce;
      }
      script.async = true;
      script.addEventListener("load", resolve, { once: true });
      script.addEventListener(
        "error",
        () => reject(new Error(`Unable to load Editra module: ${relativePath}`)),
        { once: true },
      );
      document.head.append(script);
    });

    scriptPromises.set(relativePath, promise);
    return promise;
  }

  function loadStyle(relativePath, securityConfig = null) {
    const key = `style:${relativePath}`;
    if (scriptPromises.has(key)) return scriptPromises.get(key);
    const promise = new Promise((resolve, reject) => {
      const url = new URL(relativePath, projectBase);
      const allowedOrigins =
        securityConfig?.allowedPluginOrigins ?? [global.location.origin];
      if (!allowedOrigins.includes(url.origin)) {
        reject(new TypeError(`Editra blocked plugin style origin: ${url.origin}`));
        return;
      }
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = url.href;
      const integrity = securityConfig?.pluginIntegrity?.[relativePath];
      if (securityConfig?.requirePluginIntegrity && !integrity) {
        reject(
          new TypeError(`Editra requires an integrity hash for ${relativePath}.`),
        );
        return;
      }
      if (integrity) {
        link.integrity = integrity;
        link.crossOrigin = "anonymous";
      }
      link.addEventListener("load", resolve, { once: true });
      link.addEventListener(
        "error",
        () => reject(new Error(`Unable to load Editra style: ${relativePath}`)),
        { once: true },
      );
      document.head.append(link);
    });
    scriptPromises.set(key, promise);
    return promise;
  }

class EditraCore {
  static normalizeTheme(value) {
    const name = String(value ?? "Word").trim().toLowerCase();
    if (name === "word") return "Word";
    if (name === "classic") return "Classic";
    throw new RangeError(
      `Unknown Editra theme: ${String(value)}. Use "Word" or "Classic".`,
    );
  }

  static createEditorSurface(host) {
    if (!(host instanceof HTMLTextAreaElement)) {
      return { editor: host, host, initialHTML: host.innerHTML };
    }

    const editor = document.createElement("div");
    editor.className = "editra-textarea-surface";
    editor.dataset.editraContainer = "textarea";
    host.after(editor);
    const originalState = {
      hidden: host.hidden,
      display: host.style.display,
    };
    host.hidden = true;
    host.style.display = "none";
    return {
      editor,
      host,
      initialHTML: host.value,
      textareaState: originalState,
    };
  }

  static async init(config = {}) {
    if (!config || typeof config !== "object" || Array.isArray(config)) {
      throw new TypeError("Editra.init requires a configuration object.");
    }
    if (
      config.communityPlugins !== undefined &&
      !Array.isArray(config.communityPlugins)
    ) {
      throw new TypeError("communityPlugins must be an array of manifests.");
    }

    const selector = config.selector;
    const host =
      typeof selector === "string"
        ? document.querySelector(selector)
        : selector;

    if (!(host instanceof HTMLElement)) {
      throw new TypeError(
        `Editra could not find an editor for selector: ${String(selector)}`,
      );
    }

    if (host.editraInstance && !host.editraInstance.destroyed) {
      return host.editraInstance;
    }

    await loadScript("vendor/purify.min.js");
    await loadScript("core/security.js");
    if (typeof global.EditraSecurity !== "function") {
      throw new Error("Editra security runtime failed to initialize.");
    }
    const securityConfig = global.EditraSecurity.config(config);
    const pluginNames = EditraCore.resolvePluginNames(config);
    const eagerPluginNames = pluginNames.filter(
      (name) => !PLUGIN_DEFINITIONS[name].lazy,
    );
    await Promise.all([
      loadScript("ui/toolbar.js", securityConfig),
      loadScript("ui/menubar.js", securityConfig),
      ...pluginNames
        .map((name) => PLUGIN_DEFINITIONS[name].css)
        .filter(Boolean)
        .map((file) => loadStyle(file, securityConfig)),
      ...eagerPluginNames.map((name) =>
        loadScript(PLUGIN_DEFINITIONS[name].file, securityConfig),
      ),
    ]);

    const missing = eagerPluginNames.filter(
      (name) => typeof global.EditraPlugins?.[name] !== "function",
    );
    if (missing.length) {
      throw new Error(`Plugin registration failed: ${missing.join(", ")}`);
    }

    const plugins = pluginNames.map((name) => {
      const action = global.EditraPlugins?.[name] ?? null;
      return {
        ...PLUGIN_DEFINITIONS[name],
        ...(action?.plugin ?? {}),
        name,
        action,
      };
    });

    const surface = EditraCore.createEditorSurface(host);
    let instance;
    try {
      instance = new EditraCore(surface.editor, {
        ...config,
        theme: EditraCore.normalizeTheme(config.theme),
        plugins,
      }, surface);
    } catch (error) {
      if (host instanceof HTMLTextAreaElement) {
        surface.editor.remove();
        host.hidden = surface.textareaState.hidden;
        host.style.display = surface.textareaState.display;
      }
      throw error;
    }
    host.editraInstance = instance;
    surface.editor.editraInstance = instance;
    const wordTheme = instance.options.theme === "Word";
    if (wordTheme) {
      await instance.ensurePlugin("pagesize");
      await instance.executeCommand("setPageSize", {
        size: config.pageSize ?? instance.options.pageSize,
        orientation: config.orientation ?? instance.options.orientation,
      });
    } else if (
      config.editorWidth !== undefined ||
      config.editorHeight !== undefined
    ) {
      await instance.ensurePlugin("pagesize");
      await instance.executeCommand("setCustomPageSize", {
        width: config.editorWidth ?? instance.options.editorWidth,
        height: config.editorHeight ?? instance.options.editorHeight,
        orientation: config.orientation,
      });
    } else if (
      config.pageSize !== undefined ||
      config.orientation !== undefined
    ) {
      await instance.ensurePlugin("pagesize");
      await instance.executeCommand("setPageSize", {
        size: config.pageSize ?? instance.options.pageSize,
        orientation: config.orientation ?? instance.options.orientation,
      });
    }
    if (config.margins !== undefined) {
      await instance.ensurePlugin("margins");
      await instance.executeCommand("setMargin", config.margins);
    }
    if (config.header !== undefined) {
      await instance.ensurePlugin("headerfooter");
      await instance.executeCommand("insertHeader", config.header);
    }
    if (config.footer !== undefined) {
      await instance.ensurePlugin("headerfooter");
      await instance.executeCommand("insertFooter", config.footer);
    }
    if (config.pagination !== undefined) {
      await instance.ensurePlugin("pagination");
      await instance.executeCommand(
        "setPaginationRules",
        config.pagination,
      );
    }
    if (config.collaboration && instance.plugins.has("collaboration")) {
      await instance.ensurePlugin("collaboration");
      await instance.executeCommand(
        "connectCollaboration",
        config.collaboration,
      );
    }
    if (Array.isArray(config.communityPlugins)) {
      for (const manifest of config.communityPlugins) {
        await instance.installCommunityPlugin(manifest);
      }
    }
    return instance;
  }

  static async stressTest({ paragraphs = 10000 } = {}) {
    const host = document.createElement("div");
    host.style.cssText =
      "position:fixed;left:-100000px;top:0;width:900px;visibility:hidden";
    document.body.append(host);

    const startedAt = performance.now();
    const instance = await EditraCore.init({
      selector: host,
      plugins: ["bold", "italic", "underline"],
      toolbar: "bold italic underline | undo redo",
    });
    const initializedAt = performance.now();
    instance.options.editorHeight = "1000000px";
    instance.toolbar.workspace.style.setProperty(
      "--editra-page-height",
      instance.options.editorHeight,
    );
    const html = Array.from(
      { length: paragraphs },
      (_, index) =>
        `<p>Stress paragraph ${index + 1}: Editra large-document rendering sample.</p>`,
    ).join("");

    instance.setHTML(html);
    await new Promise((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(resolve)),
    );
    const renderedAt = performance.now();

    instance.editor.dispatchEvent(new InputEvent("input", { bubbles: true }));
    await new Promise((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(resolve)),
    );
    const inputSettledAt = performance.now();

    const result = {
      paragraphs,
      htmlBytes: new Blob([html]).size,
      initializationMs: Math.round(initializedAt - startedAt),
      renderMs: Math.round(renderedAt - initializedAt),
      inputFrameMs: Math.round(inputSettledAt - renderedAt),
      historySnapshots: instance.history.length,
    };

    instance.destroy();
    host.remove();
    return result;
  }

  static resolvePluginNames(options) {
    if (options.plugins !== undefined && !Array.isArray(options.plugins)) {
      throw new TypeError("plugins must be an array.");
    }

    const explicitPlugins =
      Array.isArray(options.plugins) && options.plugins.length
        ? options.plugins
        : null;
    let requested = explicitPlugins ?? DEFAULT_PLUGINS;
    if (
      !explicitPlugins &&
      ((typeof options.toolbar === "string" && options.toolbar.trim()) ||
        (options.menu && typeof options.menu === "object"))
    ) {
      const normalize = (value) =>
        String(value ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
      const requestedTokens = new Set();
      String(options.toolbar ?? "")
        .split(/[\s|]+/)
        .filter(Boolean)
        .forEach((token) => requestedTokens.add(normalize(token)));
      Object.entries(options.menu ?? {}).forEach(([menu, items]) => {
        requestedTokens.add(normalize(menu));
        (Array.isArray(items) ? items : []).forEach((item) =>
          requestedTokens.add(normalize(item?.command ?? item?.label ?? item)),
        );
      });
      requested = DEFAULT_PLUGINS.filter((name) => {
        const definition = PLUGIN_DEFINITIONS[name];
        const tokens = [
          name,
          definition.label,
          definition.command,
          ...(definition.aliases ?? []),
          ...(definition.toolbarItems ?? []).flatMap((control) => [
            control.name,
            control.label,
            control.command,
            ...(control.aliases ?? []),
          ]),
        ]
          .filter(Boolean)
          .map(normalize);
        return tokens.some((token) => requestedTokens.has(token));
      });
    }
    const configuredPlugins = [];
    const wordTheme = String(options.theme ?? "Word").toLowerCase() === "word";
    if (
      wordTheme ||
      options.pageSize !== undefined ||
      options.orientation !== undefined ||
      options.editorWidth !== undefined ||
      options.editorHeight !== undefined
    ) {
      configuredPlugins.push("pagesize");
    }
    if (options.margins !== undefined) {
      configuredPlugins.push("margins", "ruler");
    }
    if (options.header !== undefined || options.footer !== undefined) {
      configuredPlugins.push("headerfooter");
    }
    if (options.pagination !== undefined) {
      configuredPlugins.push("pagination");
    }
    requested = [...requested, ...SYSTEM_PLUGINS, ...configuredPlugins];
    const disabled = new Set(options.disabledPlugins ?? []);

    if (!Array.isArray(requested) || !Array.isArray(options.disabledPlugins ?? [])) {
      throw new TypeError("plugins and disabledPlugins must be arrays.");
    }

    const uniqueNames = [...new Set(requested)].filter(
      (name) => !disabled.has(name) || (wordTheme && name === "pagesize"),
    );
    const unknown = uniqueNames.filter(
      (name) => !(name in PLUGIN_DEFINITIONS),
    );

    if (unknown.length) {
      throw new RangeError(`Unknown Editra plugin(s): ${unknown.join(", ")}`);
    }

    return uniqueNames;
  }

  constructor(editor, options, surface = {}) {
    this.editor = editor;
    this.host = surface.host ?? editor;
    this.textareaState = surface.textareaState ?? null;
    const editorHeightFixed =
      options.theme === "Classic" &&
      (options.editorHeightFixed ??
        Object.prototype.hasOwnProperty.call(options, "editorHeight"));
    this.options = {
      historyLimit: 100,
      historyByteLimit: 20 * 1024 * 1024,
      onChange: null,
      onStateChange: null,
      onCommand: null,
      onPaste: null,
      onFocus: null,
      onBlur: null,
      onMenuToggle: null,
      onToolbarBuild: null,
      onRulerAdjust: null,
      onPageChange: null,
      onThemeToggle: null,
      onLanguageChange: null,
      onSecurityViolation: null,
      sanitizePaste: true,
      showMenuBar: true,
      menu: null,
      editorWidth: "8.5in",
      editorHeight: "11in",
      editorHeightFixed,
      pageSize: "Letter",
      orientation: "portrait",
      colorScheme: "light",
      margins: { top: 72, right: 72, bottom: 72, left: 72 },
      printContentOnly: false,
      pagination: {
        keepParagraphsTogether: false,
        keepListItemsTogether: false,
        allowRowSplitting: true,
        keepRowsTogether: false,
        keepTableTogether: false,
        keepCodeBlocksTogether: true,
        repeatTableHeader: true,
      },
      requestUrl: null,
      language: "en",
      direction: "auto",
      translations: {},
      security: {},
      ...options,
    };
    if (
      this.options.placeholder === undefined &&
      this.host instanceof HTMLTextAreaElement &&
      this.host.placeholder
    ) {
      this.options.placeholder = this.host.placeholder;
    }
    this.plugins = new Map(
      options.plugins.map((plugin) => [plugin.name, plugin]),
    );
    this.commands = new Map();
    this.cleanups = new Set();
    this.selection = null;
    this.history = [];
    this.historyBytes = 0;
    this.historyIndex = -1;
    this.frameId = null;
    this.pendingTasks = new Map();
    this.pendingCode = null;
    this.state = Object.create(null);
    this.activeResizeCleanup = null;
    this.objectUrls = new Map();
    this.mediaObserver = null;
    this.pageResizeObserver = null;
    this.pageGuideSignature = "";
    this.destroyed = false;
    this.activeResizeFrame = null;
    this.selectedObject = null;
    this.draggedObject = null;
    this.security = new global.EditraSecurity(this, this.options);
    this.editor.innerHTML = this.security.trustedHTML(
      surface.initialHTML ?? this.editor.innerHTML,
      "initial content",
    );

    this.handleInput = this.handleInput.bind(this);
    this.handlePaste = this.handlePaste.bind(this);
    this.handleKeydown = this.handleKeydown.bind(this);
    this.handleSelectionChange = this.handleSelectionChange.bind(this);
    this.handleResizePointerDown = this.handleResizePointerDown.bind(this);
    this.handleObjectDragStart = this.handleObjectDragStart.bind(this);
    this.handleObjectDragOver = this.handleObjectDragOver.bind(this);
    this.handleObjectDrop = this.handleObjectDrop.bind(this);
    this.handleObjectDragEnd = this.handleObjectDragEnd.bind(this);
    this.handleFocus = this.handleFocus.bind(this);
    this.handleBlur = this.handleBlur.bind(this);
    this.handleFormReset = this.handleFormReset.bind(this);

    this.configureSurface();
    this.registerBuiltInCommands();
    this.plugins.forEach((plugin) => {
      if (typeof plugin.action === "function") {
        this.registerPluginCommand(plugin);
      }
    });
    this.toolbar = new global.EditraToolbar(
      this,
      [...this.plugins.values()],
      this.options.toolbar,
    );
    this.toolbar.card.classList.add(
      `editra-theme-${this.options.theme.toLowerCase()}`,
    );
    this.liveRegion = document.createElement("div");
    this.liveRegion.className = "editra-sr-only";
    this.liveRegion.dataset.editraUi = "true";
    this.liveRegion.setAttribute("role", "status");
    this.liveRegion.setAttribute("aria-live", "polite");
    this.liveRegion.setAttribute("aria-atomic", "true");
    this.toolbar.card.prepend(this.liveRegion);
    this.configurePageLayout();
    this.menubar =
      this.options.showMenuBar === false
        ? null
        : new global.EditraMenuBar(
            this,
            this.toolbar.card,
            this.options.menu,
          );
    if (this.options.showMenuBar === false) {
      this.notifyUI("menuToggle", {
        visible: false,
        reason: "configuration",
      });
    }
    this.bindEvents();
    this.rehydrate();
    this.recordHistory(true);
    this.emitState();
    this.emitChange();
  }

  configureSurface() {
    this.editor.setAttribute("contenteditable", "true");
    this.editor.classList.add("editra-editor");
    this.editor.dataset.editraTheme = this.options.theme;
    this.editor.setAttribute("role", "textbox");
    this.editor.setAttribute("aria-multiline", "true");
    this.editor.setAttribute("aria-label", this.options.label ?? "Document editor");
    this.editor.setAttribute("lang", this.options.language);
    this.editor.setAttribute(
      "dir",
      this.options.direction === "auto"
        ? "auto"
        : this.options.direction === "rtl"
          ? "rtl"
          : "ltr",
    );
    this.editor.setAttribute(
      "data-placeholder",
      this.options.placeholder ?? "Start writing something remarkable…",
    );
    this.editor.spellcheck = this.options.spellcheck ?? true;
  }

  configurePageLayout() {
    const workspace = this.toolbar.workspace;
    if (!workspace) return;
    this.options.editorWidth = this.validEditorDimension(
      this.options.editorWidth,
      "8.5in",
    );
    this.options.editorHeight = this.validEditorDimension(
      this.options.editorHeight,
      "11in",
    );
    workspace.style.setProperty(
      "--editra-page-width",
      this.options.editorWidth,
    );
    workspace.style.setProperty(
      "--editra-page-height",
      this.options.editorHeight,
    );
    this.applyPageMargins(this.options.margins, false);
    this.state.editorWidth = this.options.editorWidth;
    this.state.editorHeight = this.options.editorHeight;
    this.pageGuides = document.createElement("div");
    this.pageGuides.className = "editra-page-guides";
    this.pageGuides.dataset.editraUi = "true";
    this.pageGuides.setAttribute("aria-hidden", "true");
    workspace.prepend(this.pageGuides);
    if (typeof ResizeObserver === "function") {
      this.pageResizeObserver = new ResizeObserver(() =>
        this.scheduleUpdate("page-layout", () => this.refreshPageLayout()),
      );
      this.pageResizeObserver.observe(this.editor);
    }
    this.refreshPageLayout();
  }

  validEditorDimension(value, fallback) {
    const dimension =
      typeof value === "number" && Number.isFinite(value)
        ? `${value}px`
        : String(value ?? "").trim();
    return globalThis.CSS?.supports?.("width", dimension)
      ? dimension
      : fallback;
  }

  resolveEditorPixels(value, fallback) {
    const probe = document.createElement("span");
    probe.style.cssText =
      "position:absolute;visibility:hidden;pointer-events:none";
    probe.style.height = this.validEditorDimension(value, fallback);
    this.toolbar.workspace.append(probe);
    const pixels = probe.getBoundingClientRect().height;
    probe.remove();
    return pixels || Number.parseFloat(fallback);
  }

  measureDocumentContentHeight() {
    const editorRect = this.editor.getBoundingClientRect();
    const editorStyle = getComputedStyle(this.editor);
    const paddingTop = Number.parseFloat(editorStyle.paddingTop) || 0;
    const paddingBottom = Number.parseFloat(editorStyle.paddingBottom) || 0;
    let bottom = paddingTop;

    [...this.editor.childNodes].forEach((node) => {
      if (node.nodeType === Node.ELEMENT_NODE) {
        if (node.hidden || node.matches("[data-editra-document-part]")) return;
        const rect = node.getBoundingClientRect();
        if (!rect.width && !rect.height) return;
        const marginBottom = Number.parseFloat(getComputedStyle(node).marginBottom) || 0;
        bottom = Math.max(
          bottom,
          rect.bottom - editorRect.top + this.editor.scrollTop + marginBottom,
        );
        return;
      }
      if (node.nodeType === Node.TEXT_NODE && node.nodeValue?.trim()) {
        const range = document.createRange();
        range.selectNodeContents(node);
        const rect = range.getBoundingClientRect();
        bottom = Math.max(
          bottom,
          rect.bottom - editorRect.top + this.editor.scrollTop,
        );
      }
    });

    return Math.ceil(bottom + paddingBottom);
  }

  refreshPageLayout() {
    if (this.destroyed || !this.pageGuides?.isConnected) return;
    const pageHeight = this.resolveEditorPixels(
      this.options.editorHeight,
      "1056px",
    );
    const explicitBreaks =
      this.editor.querySelectorAll(".editra-page-break").length;
    const explicitPages = explicitBreaks + 1;
    const classic = this.options.theme === "Classic";
    const contentHeight = classic
      ? Math.max(pageHeight, this.editor.scrollHeight)
      : Math.max(pageHeight, this.measureDocumentContentHeight());
    const pageCount = classic
      ? (explicitBreaks ? explicitPages : null)
      : Math.max(explicitPages, Math.ceil(contentHeight / pageHeight));
    if (!classic) {
      const surfaceHeight = `${pageCount * pageHeight}px`;
      if (this.editor.style.minHeight !== surfaceHeight) {
        this.editor.style.minHeight = surfaceHeight;
      }
    }
    const signature = `${pageCount}:${pageHeight.toFixed(3)}:${this.options.editorWidth}`;
    if (signature === this.pageGuideSignature) return;
    const previousSignature = this.pageGuideSignature;
    this.pageGuideSignature = signature;
    const fragment = document.createDocumentFragment();
    for (let page = 0; page < (pageCount ?? 0); page += 1) {
      const guide = document.createElement("div");
      guide.className = "editra-page-guide";
      guide.style.top = `${page * pageHeight}px`;
      guide.style.height = `${pageHeight}px`;
      const label = document.createElement("span");
      label.textContent = `Page ${page + 1}`;
      guide.append(label);
      fragment.append(guide);
    }
    this.pageGuides.replaceChildren(fragment);
    this.toolbar.workspace.style.setProperty(
      "--editra-page-count",
      String(pageCount ?? 0),
    );
    const detail = {
      pageCount,
      pageWidth: this.options.editorWidth,
      pageHeight: this.options.editorHeight,
      pageSize: this.state.pageSize || this.options.pageSize,
      orientation: this.state.orientation || this.options.orientation,
      margins: { ...(this.state.margins ?? {}) },
      editor: this.editor,
      initial: !previousSignature,
    };
    this.state.pageCount = pageCount;
    if (typeof this.options.onPageChange === "function") {
      this.options.onPageChange(detail);
    }
    this.editor.dispatchEvent(
      new CustomEvent("editra:pageChange", { detail }),
    );
  }

  setEditorSize(width, height, settings = {}) {
    if (this.options.theme === "Word" && settings.standard !== true) {
      return false;
    }
    const dimensions =
      width && typeof width === "object"
        ? { width: width.width, height: width.height }
        : { width, height };
    if (dimensions.width !== undefined) {
      this.options.editorWidth = this.validEditorDimension(
        dimensions.width,
        this.options.editorWidth,
      );
      this.toolbar.workspace.style.setProperty(
        "--editra-page-width",
        this.options.editorWidth,
      );
    }
    if (dimensions.height !== undefined) {
      this.options.editorHeight = this.validEditorDimension(
        dimensions.height,
        this.options.editorHeight,
      );
      this.toolbar.workspace.style.setProperty(
        "--editra-page-height",
        this.options.editorHeight,
      );
    }
    this.pageGuideSignature = "";
    this.scheduleUpdate("page-layout", () => this.refreshPageLayout());
    this.state.editorWidth = this.options.editorWidth;
    this.state.editorHeight = this.options.editorHeight;
    this.emitState();
    return {
      width: this.options.editorWidth,
      height: this.options.editorHeight,
    };
  }

  setPageSize(width, height) {
    return this.setEditorSize(width, height);
  }

  marginValue(value, fallback = 72) {
    const candidate =
      typeof value === "number" && Number.isFinite(value)
        ? `${Math.max(0, value)}px`
        : String(value ?? "").trim();
    return globalThis.CSS?.supports?.("margin", candidate)
      ? candidate
      : `${fallback}px`;
  }

  applyPageMargins(values = {}, refresh = true) {
    const previous = this.state.margins ?? {
      top: "72px",
      right: "72px",
      bottom: "72px",
      left: "72px",
    };
    const margins = {
      top: this.marginValue(values.top, Number.parseFloat(previous.top)),
      right: this.marginValue(values.right, Number.parseFloat(previous.right)),
      bottom: this.marginValue(values.bottom, Number.parseFloat(previous.bottom)),
      left: this.marginValue(values.left, Number.parseFloat(previous.left)),
    };
    this.state.margins = margins;
    this.options.margins = { ...margins };
    Object.entries(margins).forEach(([side, value]) => {
      this.editor.style.setProperty(`--editra-page-margin-${side}`, value);
      this.toolbar?.workspace?.style.setProperty(
        `--editra-page-margin-${side}`,
        value,
      );
    });
    if (refresh) {
      this.pageGuideSignature = "";
      this.scheduleUpdate("page-layout", () => this.refreshPageLayout());
    }
    return { ...margins };
  }

  bindEvents() {
    this.editor.addEventListener("input", this.handleInput);
    this.editor.addEventListener("paste", this.handlePaste);
    this.editor.addEventListener("keydown", this.handleKeydown, true);
    this.editor.addEventListener("pointerdown", this.handleResizePointerDown);
    this.editor.addEventListener("dragstart", this.handleObjectDragStart);
    this.editor.addEventListener("dragover", this.handleObjectDragOver);
    this.editor.addEventListener("drop", this.handleObjectDrop);
    this.editor.addEventListener("dragend", this.handleObjectDragEnd);
    this.editor.addEventListener("focus", this.handleFocus);
    this.editor.addEventListener("blur", this.handleBlur);
    this.host.form?.addEventListener("reset", this.handleFormReset);
    document.addEventListener("selectionchange", this.handleSelectionChange);
    this.mediaObserver = new MutationObserver(() => {
      this.scheduleUpdate("media-removal-cleanup", () =>
        this.releaseRemovedObjectUrls(),
      );
    });
    this.mediaObserver.observe(this.editor, { childList: true, subtree: true });
  }

  registerBuiltInCommands() {
    const register = (name, handler) =>
      this.registerCommand(name, handler, { source: "core" });
    const exec = (command, value = null) => {
      this.restoreSelection();
      this.editor.focus({ preventScroll: true });
      const result = this.execCommand(command, value);
      this.recordHistory();
      this.scheduleUpdate("change", () => this.emitChange());
      return result;
    };

    register("undo", () => this.undo());
    register("redo", () => this.redo());
    register("sanitizeHTML", (html) => this.sanitizeHTML(html));
    register("secureRequest", (url, options) =>
      this.secureRequest(url, options),
    );
    register("setEditorSize", (width, height) =>
      this.setEditorSize(width, height),
    );
    register("selectObject", (element) => this.selectObject(element));
    register("deleteSelectedObject", () => this.deleteSelectedObject());
    register("new", () => this.setHTML(""));
    register("open", () => this.openDocument());
    register("save", () =>
      this.state.codeView && this.commands.has("saveHTMLSource")
        ? this.executeCommand("saveHTMLSource", {
            fileName: "editra-document.html",
          })
        : this.executeCommand("exportHTML", {
            fileName: "editra-document.html",
          }),
    );
    register("print", (options = {}) =>
      this.executeCommand("exportPDF", {
        ...options,
        contentOnly:
          options.contentOnly ?? Boolean(this.options.printContentOnly),
      }),
    );
    register("cut", () => exec("cut"));
    register("copy", () => exec("copy"));
    register("paste", () => {
      const result = exec("paste");
      if (!result) this.dispatchCommand("paste-permission");
      return result;
    });
    register("select-all", () => {
      const range = document.createRange();
      range.selectNodeContents(this.editor);
      const selection = global.getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
      this.selection = range.cloneRange();
      return true;
    });
    register("find-replace", () => {
      const search = global.prompt("Find:");
      if (!search) return false;
      const replacement = global.prompt("Replace with:", "") ?? "";
      return this.replaceAllText(search, replacement);
    });
    register("zoom", () => {
      const current = Number(this.toolbar.card.dataset.zoom || 100);
      const value = Number(global.prompt("Zoom percentage:", String(current)));
      if (!Number.isFinite(value)) return false;
      const zoom = Math.min(200, Math.max(50, value));
      this.toolbar.card.dataset.zoom = String(zoom);
      this.editor.style.fontSize = `${zoom}%`;
      return true;
    });
    register("fullscreen", () => {
      if (document.fullscreenElement) return document.exitFullscreen();
      return this.toolbar.card.requestFullscreen?.() ?? false;
    });
    register("merge-preview", () => this.dispatchCommand("merge-preview"));
    register("toggle-rulers", () => this.executeCommand("toggleRuler"));
    register("link", () => {
      const url = global.prompt("Link URL:");
      return url && this.security.isSafeUrl(url)
        ? exec("createLink", url)
        : false;
    });
    register("footnote", () =>
      exec(
        "insertHTML",
        '<sup class="editra-footnote" contenteditable="true">[1]</sup>',
      ),
    );
    register("bookmark", () =>
      exec(
        "insertHTML",
        `<span id="bookmark-${Date.now()}" class="editra-bookmark">&#8203;</span>`,
      ),
    );
    register("emoji", () => {
      const emoji = global.prompt("Insert emoji:", "✨");
      return emoji ? exec("insertText", emoji) : false;
    });
    register("media", () =>
      this.plugins.has("image")
        ? this.executeCommand("image")
        : this.dispatchCommand("media"),
    );
    register("code-block", () => exec("formatBlock", "pre"));
    register("horizontal-line", () => exec("insertHorizontalRule"));
    register("page-break", () =>
      exec(
        "insertHTML",
        '<div class="editra-page-break" contenteditable="false"></div><p><br></p>',
      ),
    );
    register("text", () => exec("formatBlock", "p"));
    register("font", () => {
      const font = global.prompt("Font family:", "Georgia");
      return font ? exec("fontName", font) : false;
    });
    register("heading", () => exec("formatBlock", "h2"));
    register("lists", () => exec("insertUnorderedList"));
    register("alignment", () => exec("justifyLeft"));
    register("line-height", () => this.dispatchCommand("line-height"));
    register("indentation", () => exec("indent"));
    register("case-change", () => this.dispatchCommand("case-change"));
    register("remove-format", () => exec("removeFormat"));

    ["template", "toc"].forEach((name) =>
      register(name, () => this.dispatchCommand(name)),
    );
    ["accessibility", "about", "documentation", "shortcutKeys"].forEach((name) =>
      register(name, (options = {}) => this.openHelpDialog(name, options)),
    );
  }

  openHelpDialog(type, options = {}) {
    const definitions = {
      accessibility: {
        title: "Accessibility",
        purpose:
          "Explains keyboard navigation, focus indicators, screen-reader labels, RTL support, and accessible editing practices.",
        links: [
          ["Accessibility and compliance", "docs/COMPLIANCE.md"],
          ["Help and keyboard guidance", "docs/HELP.md"],
        ],
      },
      about: {
        title: "About Editra",
        purpose:
          "Editra is a modular, MIT-licensed WYSIWYG editor with centralized release metadata.",
        links: [["Project overview", "docs/ABOUT.md"]],
      },
      documentation: {
        title: "Documentation",
        purpose:
          "Opens the feature guide and developer API reference for configuring and integrating Editra.",
        links: [
          ["User guide", "docs/USER_GUIDE.md"],
          ["API reference", "docs/API_REFERENCE.md"],
        ],
      },
      shortcutKeys: {
        title: "Shortcut Keys",
        purpose:
          "Available shortcuts use Ctrl on Windows and Linux, or Cmd on macOS. Native clipboard behavior remains browser-controlled.",
        links: [
          ["Shortcut reference", "docs/HELP.md"],
          ["Working shortcuts demo", "examples/shortcuts.html"],
        ],
      },
    };
    const definition = definitions[type];
    if (!definition) return false;
    this.toolbar.card
      .querySelector(".editra-help-dialog")
      ?.dispatchEvent(new CustomEvent("editra:close"));

    const dialog = document.createElement("section");
    dialog.className = `editra-help-dialog editra-popup editra-popup--help editra-help-dialog--${type}`;
    dialog.dataset.editraUi = "true";
    dialog.setAttribute("role", "dialog");
    dialog.setAttribute("aria-modal", "false");
    dialog.setAttribute("aria-label", definition.title);
    const header = document.createElement("header");
    const title = document.createElement("h2");
    title.textContent = definition.title;
    const closeButton = document.createElement("button");
    closeButton.type = "button";
    closeButton.setAttribute("aria-label", `Close ${definition.title}`);
    closeButton.textContent = "\u00d7";
    header.append(title, closeButton);
    const purpose = document.createElement("p");
    purpose.textContent = definition.purpose;
    const shortcutData =
      type === "shortcutKeys" ? this.executeCommand("getShortcuts") : null;
    const shortcutList = document.createElement("dl");
    shortcutList.className = "editra-shortcut-list";
    (shortcutData?.reference ?? []).forEach(({ keys, description }) => {
      const term = document.createElement("dt");
      const key = document.createElement("kbd");
      key.textContent = keys;
      term.append(key);
      const detail = document.createElement("dd");
      detail.textContent = description;
      shortcutList.append(term, detail);
    });
    const links = document.createElement("div");
    links.className = "editra-help-links";
    definition.links.forEach(([label, path]) => {
      const link = document.createElement("a");
      link.href = new URL(path, projectBase).href;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.textContent = label;
      links.append(link);
    });
    dialog.append(header, purpose);
    if (shortcutList.childElementCount) dialog.append(shortcutList);
    dialog.append(links);
    this.toolbar.card.append(dialog);

    const anchorRect =
      options.anchorRect ||
      options.anchor?.getBoundingClientRect?.() ||
      this.toolbar.element.getBoundingClientRect();
    const cardRect = this.toolbar.card.getBoundingClientRect();
    const width = Math.min(360, Math.max(260, cardRect.width - 16));
    const preferredLeft = anchorRect.right - cardRect.left + 6;
    dialog.style.left = `${Math.max(
      8,
      Math.min(
        preferredLeft + width <= cardRect.width
          ? preferredLeft
          : anchorRect.left - cardRect.left - width - 6,
        cardRect.width - width - 8,
      ),
    )}px`;
    dialog.style.top = `${Math.max(8, anchorRect.top - cardRect.top)}px`;

    let unregister = () => {};
    let closed = false;
    const close = () => {
      if (closed) return;
      closed = true;
      closeButton.removeEventListener("click", close);
      dialog.removeEventListener("editra:close", close);
      document.removeEventListener("pointerdown", outside, true);
      document.removeEventListener("keydown", keydown);
      dialog.remove();
      unregister();
    };
    const outside = (event) => {
      if (!dialog.contains(event.target)) close();
    };
    const keydown = (event) => {
      if (event.key === "Escape") close();
    };
    closeButton.addEventListener("click", close);
    dialog.addEventListener("editra:close", close);
    document.addEventListener("pointerdown", outside, true);
    document.addEventListener("keydown", keydown);
    unregister = this.registerCleanup(close);
    closeButton.focus({ preventScroll: true });
    return dialog;
  }

  openDocument() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".html,.htm,.txt,.md";
    input.hidden = true;

    input.addEventListener(
      "change",
      () => {
        const file = input.files?.[0];
        input.remove();
        if (!file) return;
        const reader = new FileReader();
        reader.addEventListener(
          "load",
          () => {
            if (!this.destroyed && typeof reader.result === "string") {
              const content = /\.html?$/i.test(file.name)
                ? reader.result
                : reader.result
                    .split(/\r?\n/)
                    .map((line) => {
                      const paragraph = document.createElement("p");
                      paragraph.textContent = line || " ";
                      return paragraph.outerHTML;
                    })
                    .join("");
              this.setHTML(content);
            }
          },
          { once: true },
        );
        reader.readAsText(file);
      },
      { once: true },
    );
    document.body.append(input);
    input.click();
    return true;
  }

  downloadFile(name, content, type) {
    const url = URL.createObjectURL(new Blob([content], { type }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = name;
    anchor.click();
    this.scheduleUpdate(`revoke-${url}`, () => URL.revokeObjectURL(url));
    return true;
  }

  replaceAllText(search, replacement) {
    const walker = document.createTreeWalker(
      this.editor,
      NodeFilter.SHOW_TEXT,
    );
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    let index = 0;
    let replacements = 0;

    return new Promise((resolve) => {
      const processChunk = () => {
        const end = Math.min(index + 250, nodes.length);
        for (; index < end; index += 1) {
          const node = nodes[index];
          if (!node.nodeValue.includes(search)) continue;
          const parts = node.nodeValue.split(search);
          replacements += parts.length - 1;
          node.nodeValue = parts.join(replacement);
        }

        if (index < nodes.length) {
          global.requestAnimationFrame(processChunk);
        } else {
          this.recordHistory();
          this.emitChange();
          resolve(replacements);
        }
      };
      global.requestAnimationFrame(processChunk);
    });
  }

  applyFormat(type) {
    return this.executeCommand(type);
  }

  translate(key, fallback = key) {
    const translations = this.options.translations?.[this.options.language];
    return translations && Object.hasOwn(translations, key)
      ? String(translations[key])
      : String(fallback);
  }

  announce(message) {
    if (!this.liveRegion || this.destroyed) return;
    this.liveRegion.textContent = "";
    this.scheduleUpdate("announcement", () => {
      if (this.liveRegion) this.liveRegion.textContent = String(message);
    });
  }

  sanitizeHTML(html, options = {}) {
    return this.security.sanitize(html, options);
  }

  async secureRequest(url, options = {}) {
    const request = this.security.validateRequest(url, options);
    return global.fetch(request.url, request.init);
  }

  loadRuntimeScript(relativePath) {
    return loadScript(relativePath, this.security.config);
  }

  registerCommand(name, handler, options = {}) {
    if (typeof name !== "string" || !name.trim()) {
      throw new TypeError("Command name must be a non-empty string.");
    }
    if (typeof handler !== "function") {
      throw new TypeError(`Command "${name}" requires a function.`);
    }

    const command = {
      handler,
      plugin: options.plugin ?? null,
      source: options.source ?? "custom",
    };
    this.commands.set(name, command);
    return () => {
      if (this.commands.get(name) === command) this.commands.delete(name);
    };
  }

  registerPluginCommand(plugin) {
    return this.registerCommand(
      plugin.name,
      (...args) => this.runPluginCommand(plugin, ...args),
      { plugin: plugin.name, source: "plugin" },
    );
  }

  async ensurePlugin(name) {
    const plugin = this.plugins.get(name);
    if (!plugin) return false;
    if (typeof plugin.action === "function") return plugin;

    await loadScript(plugin.file, this.security.config);
    const action = global.EditraPlugins?.[name];
    if (typeof action !== "function") {
      throw new Error(`Plugin registration failed: ${name}`);
    }

    Object.assign(plugin, action.plugin ?? {}, { action, lazy: false });
    this.registerPluginCommand(plugin);
    if (typeof action.install === "function") action.install(this);
    if (typeof action.hydrate === "function") action.hydrate(this, this.editor);
    return plugin;
  }

  async ensureHeavyCommand(name) {
    const file = HEAVY_COMMAND_FILES[name];
    if (!file) return false;
    await loadScript(file, this.security.config);
    if (typeof global.EditraExportPlugin === "function") {
      global.EditraExportPlugin(this);
    }
    return this.commands.has(name);
  }

  executeCommand(name, ...args) {
    if (this.destroyed || typeof name !== "string") return false;
    if (!this.security.permitCommand(name)) return false;

    const command = this.commands.get(name);
    if (command) {
      const result = command.handler(...args);
      if (result && typeof result.then === "function") {
        return result.then((value) => {
          this.notifyCommand(name, args, value, command);
          return value;
        });
      }
      this.notifyCommand(name, args, result, command);
      return result;
    }

    const plugin = this.plugins.get(name);
    if (plugin && !plugin.action) {
      return this.ensurePlugin(name).then(() => this.executeCommand(name, ...args));
    }

    const pluginName = PLUGIN_COMMANDS[name];
    const commandPlugin = pluginName ? this.plugins.get(pluginName) : null;
    if (commandPlugin && !commandPlugin.action) {
      return this.ensurePlugin(pluginName).then(() =>
        this.executeCommand(name, ...args),
      );
    }

    if (HEAVY_COMMAND_FILES[name]) {
      return this.ensureHeavyCommand(name).then((loaded) =>
        loaded ? this.executeCommand(name, ...args) : false,
      );
    }

    return this.dispatchCommand(name, { args });
  }

  notifyCommand(name, args, result, command = {}) {
    const detail = {
      command: name,
      args,
      result,
      editor: this,
      source: command.source ?? "custom",
      plugin: command.plugin ?? null,
    };
    this.editor.dispatchEvent(
      new CustomEvent("editra:command-executed", {
        bubbles: true,
        detail,
      }),
    );
    if (typeof this.options.onCommand === "function") {
      this.options.onCommand(detail);
    }
    if (result !== false) {
      this.announce(
        this.translate(`announcement.${name}`, `${name} applied`),
      );
    }
  }

  notifyUI(type, detail = {}) {
    const callback =
      type === "menuToggle"
        ? this.options.onMenuToggle
        : this.options.onToolbarBuild;
    const payload = { type, editor: this, ...detail };
    this.editor.dispatchEvent(
      new CustomEvent(`editra:${type}`, { bubbles: true, detail: payload }),
    );
    if (typeof callback === "function") callback(payload);
  }

  runPluginCommand(plugin, ...args) {
    if (!plugin || plugin.disabled || typeof plugin.action !== "function") {
      return false;
    }

    this.restoreSelection();
    this.editor.focus({ preventScroll: true });
    const result = plugin.action(this, ...args);
    this.captureSelection();
    this.recordHistory();
    this.scheduleUpdate("change", () => this.emitChange());
    return result ?? true;
  }

  dispatchCommand(name, detail = {}) {
    const event = new CustomEvent("editra:command", {
      bubbles: true,
      cancelable: true,
      detail: { command: name, editor: this, ...detail },
    });
    this.editor.dispatchEvent(event);
    if (typeof this.options.onCommand === "function") {
      this.options.onCommand(event.detail);
    }
    return !event.defaultPrevented;
  }

  execCommand(command, value = null) {
    const before = this.editor.innerHTML;
    const result = document.execCommand(command, false, value);
    if (result && this.editor.innerHTML !== before) return result;

    const tag = {
      bold: "strong",
      italic: "em",
      underline: "u",
      strikeThrough: "s",
    }[command];
    const liveSelection = global.getSelection();
    const range =
      liveSelection?.rangeCount &&
      this.editor.contains(liveSelection.getRangeAt(0).commonAncestorContainer)
        ? liveSelection.getRangeAt(0)
        : this.selection;
    if (!tag || !range || range.collapsed) return result;
    if (!this.editor.contains(range.commonAncestorContainer)) return result;

    const anchor =
      range.commonAncestorContainer.nodeType === Node.ELEMENT_NODE
        ? range.commonAncestorContainer
        : range.commonAncestorContainer.parentElement;
    const existing = anchor?.closest(tag);
    if (existing && this.editor.contains(existing)) {
      const first = existing.firstChild;
      const last = existing.lastChild;
      existing.replaceWith(...existing.childNodes);
      if (first && last) {
        range.setStartBefore(first);
        range.setEndAfter(last);
        liveSelection?.removeAllRanges();
        liveSelection?.addRange(range);
        this.selection = range.cloneRange();
      }
      this.recordHistory();
      this.scheduleUpdate("format-change", () => {
        this.emitChange();
        this.emitState();
      });
      return true;
    }

    const wrapper = document.createElement(tag);
    wrapper.append(range.extractContents());
    range.insertNode(wrapper);
    range.selectNodeContents(wrapper);
    liveSelection?.removeAllRanges();
    liveSelection?.addRange(range);
    this.selection = range.cloneRange();
    this.recordHistory();
    this.scheduleUpdate("format-change", () => {
      this.emitChange();
      this.emitState();
    });
    return true;
  }

  insertImage(url, metadata = {}) {
    if (!this.isSafeMediaUrl(url, true)) {
      throw new TypeError("A valid image source is required.");
    }

    const image = document.createElement("img");
    image.src = url;
    image.alt = metadata.alt ?? "";
    image.loading = metadata.loading ?? "eager";
    image.decoding = "async";
    image.draggable = false;
    image.dataset.editraSource =
      metadata.source ?? (url.startsWith("data:") ? "bytes" : "url");
    if (metadata.name) image.dataset.editraName = metadata.name;
    if (metadata.mime) image.dataset.editraMime = metadata.mime;
    const frame = this.makeMediaResizable(image, "image");
    if (/^https:/i.test(url)) {
      frame.classList.add("is-media-loading");
      frame.style.minHeight = "120px";
      const settle = () => {
        if (!frame.isConnected) return;
        if (image.naturalWidth && image.naturalHeight) {
          frame.style.aspectRatio = `${image.naturalWidth} / ${image.naturalHeight}`;
        }
        frame.style.minHeight = "";
        frame.classList.remove("is-media-loading");
        this.scheduleUpdate("remote-image-layout", () =>
          this.refreshPageLayout(),
        );
      };
      image.addEventListener("load", settle, { once: true });
      image.addEventListener("error", settle, { once: true });
    }
    return this.insertNode(frame);
  }

  insertVideo(url, metadata = {}) {
    if (!this.isSafeMediaUrl(url, false)) {
      throw new TypeError("A valid video source is required.");
    }

    const video = document.createElement("video");
    video.src = url;
    video.controls = true;
    video.preload = "metadata";
    video.playsInline = true;
    video.dataset.editraSource = metadata.source ?? "url";
    if (metadata.name) video.dataset.editraName = metadata.name;
    if (metadata.mime) video.dataset.editraMime = metadata.mime;
    const wrapper = this.insertNode(this.makeMediaResizable(video, "video"));
    if (url.startsWith("blob:")) this.registerObjectUrl(url, video);
    return wrapper;
  }

  insertVideoEmbed(url) {
    if (!this.security.isSafeUrl(url, { iframe: true })) {
      throw new TypeError("A valid embedded video source is required.");
    }
    const iframe = document.createElement("iframe");
    iframe.src = url;
    iframe.title = "Embedded video";
    iframe.loading = "lazy";
    iframe.allow =
      "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share";
    iframe.allowFullscreen = true;
    iframe.referrerPolicy = "strict-origin-when-cross-origin";
    iframe.sandbox =
      "allow-scripts allow-same-origin allow-presentation";
    iframe.dataset.editraVideo = "embed";
    iframe.dataset.editraSource = "url";
    return this.insertNode(this.makeMediaResizable(iframe, "video"));
  }

  makeMediaResizable(media, kind) {
    const existingFrame = media.closest?.(".editra-media-frame");
    if (existingFrame) {
      existingFrame.draggable = true;
      existingFrame.dataset.editraSelectable = "true";
      existingFrame.dataset.editraDraggable = "true";
      ["nw", "ne", "sw", "se"].forEach((direction) => {
        if (
          existingFrame.querySelector(
            `:scope > .editra-resize-handle[data-direction="${direction}"]`,
          )
        ) {
          return;
        }
        const handle = document.createElement("span");
        handle.className = `editra-resize-handle editra-resize-${direction}`;
        handle.dataset.direction = direction;
        handle.dataset.editraUi = "true";
        handle.setAttribute("aria-hidden", "true");
        existingFrame.append(handle);
      });
      return existingFrame;
    }

    const frame = document.createElement("figure");
    frame.className = "editra-media-frame";
    frame.dataset.editraMedia = kind;
    frame.dataset.editraSelectable = "true";
    frame.dataset.editraDraggable = "true";
    frame.contentEditable = "false";
    frame.draggable = true;
    frame.style.width = media.style.width || "min(100%, 640px)";

    if (kind === "video") {
      frame.style.aspectRatio = media.dataset.editraAspect || "16 / 9";
    }

    if (media.isConnected) media.before(frame);
    frame.append(media);

    ["nw", "ne", "sw", "se"].forEach((direction) => {
      const handle = document.createElement("span");
      handle.className = `editra-resize-handle editra-resize-${direction}`;
      handle.dataset.direction = direction;
      handle.dataset.editraUi = "true";
      handle.setAttribute("aria-hidden", "true");
      frame.append(handle);
    });

    return frame;
  }

  draggableObject(target) {
    const element = target instanceof Element ? target : target?.parentElement;
    const frame = element?.closest(".editra-media-frame");
    if (frame && this.editor.contains(frame)) return frame;
    const draggable = element?.closest('[data-editra-draggable="true"]');
    return draggable && this.editor.contains(draggable) ? draggable : null;
  }

  handleObjectDragStart(event) {
    if (event.target.closest?.(".editra-resize-handle")) {
      event.preventDefault();
      return;
    }
    const object = this.draggableObject(event.target);
    if (!object) return;
    this.draggedObject = object;
    object.classList.add("is-object-dragging");
    this.selectObject(object);
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", object.textContent || object.dataset.editraMedia || "Editra object");
    }
  }

  handleObjectDragOver(event) {
    if (!this.draggedObject?.isConnected) return;
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = "move";
  }

  rangeFromPoint(x, y) {
    if (document.caretRangeFromPoint) return document.caretRangeFromPoint(x, y);
    const position = document.caretPositionFromPoint?.(x, y);
    if (!position) return null;
    const range = document.createRange();
    range.setStart(position.offsetNode, position.offset);
    range.collapse(true);
    return range;
  }

  handleObjectDrop(event) {
    const object = this.draggedObject;
    if (!object?.isConnected) return;
    event.preventDefault();
    const range = this.rangeFromPoint(event.clientX, event.clientY);
    if (!range || !this.isRangeInside(range) || object.contains(range.startContainer)) {
      this.handleObjectDragEnd();
      return;
    }
    if (object.classList.contains("editra-media-frame")) {
      let block =
        range.startContainer.nodeType === Node.ELEMENT_NODE
          ? range.startContainer
          : range.startContainer.parentElement;
      while (block?.parentElement && block.parentElement !== this.editor) {
        block = block.parentElement;
      }
      if (block && block !== object && block.parentElement === this.editor) {
        const rect = block.getBoundingClientRect();
        block[event.clientY < rect.top + rect.height / 2 ? "before" : "after"](object);
      } else {
        this.editor.append(object);
      }
    } else {
      range.insertNode(object);
    }
    this.selectObject(object);
    this.recordHistory();
    this.scheduleUpdate("object-move", () => {
      this.emitChange();
      this.refreshPageLayout();
    });
    this.handleObjectDragEnd();
  }

  handleObjectDragEnd() {
    this.draggedObject?.classList.remove("is-object-dragging");
    this.draggedObject = null;
  }

  handleResizePointerDown(event) {
    const handle = event.target.closest?.(".editra-resize-handle");
    const frame = handle?.closest(".editra-media-frame");
    if (!handle || !frame || !this.editor.contains(frame)) {
      const selectable = event.target.closest?.(
        ".editra-media-frame, .editra-table-frame, [contenteditable='false'][data-editra-selectable]",
      );
      if (
        selectable &&
        this.editor.contains(selectable) &&
        !event.target.closest("video, audio, button, input, select, textarea, a")
      ) {
        event.preventDefault();
        this.selectObject(selectable);
      } else {
        this.clearObjectSelection();
      }
      return;
    }

    event.preventDefault();
    this.activeResizeCleanup?.();
    this.activeResizeFrame = frame;

    const direction = handle.dataset.direction;
    const startX = event.clientX;
    const startRect = frame.getBoundingClientRect();
    const maxWidth = Math.max(160, this.editor.clientWidth - 32);
    const aspect = startRect.width / Math.max(startRect.height, 1);
    let latestX = startX;

    const applyResize = () => {
      const horizontalDelta = latestX - startX;
      const signedDelta = direction.includes("w")
        ? -horizontalDelta
        : horizontalDelta;
      const width = Math.min(
        maxWidth,
        Math.max(120, startRect.width + signedDelta),
      );
      frame.style.width = `${Math.round(width)}px`;
      if (frame.dataset.editraMedia === "video") {
        frame.style.height = `${Math.round(width / aspect)}px`;
        frame.style.aspectRatio = "auto";
      }
    };

    const handleMove = (moveEvent) => {
      latestX = moveEvent.clientX;
      this.scheduleUpdate("media-resize", applyResize);
    };

    const cleanupDrag = () => {
      document.removeEventListener("pointermove", handleMove);
      document.removeEventListener("pointerup", handleUp);
      document.removeEventListener("pointercancel", handleUp);
      this.pendingTasks.delete("media-resize");
      this.activeResizeCleanup = null;
      this.activeResizeFrame = null;
    };

    const handleUp = (upEvent) => {
      latestX = upEvent.clientX;
      applyResize();
      cleanupDrag();
      this.recordHistory();
      this.scheduleUpdate("change", () => this.emitChange());
    };

    this.activeResizeCleanup = cleanupDrag;
    document.addEventListener("pointermove", handleMove);
    document.addEventListener("pointerup", handleUp);
    document.addEventListener("pointercancel", handleUp);
  }

  selectObject(element) {
    if (!(element instanceof Element) || !this.editor.contains(element)) {
      return false;
    }
    this.clearObjectSelection();
    this.selectedObject = element;
    this.editor.focus({ preventScroll: true });
    element.classList.add("is-object-selected");
    element.setAttribute("aria-selected", "true");
    const range = document.createRange();
    range.selectNode(element);
    const selection = global.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
    this.selection = range.cloneRange();
    this.state.objectSelected = true;
    this.emitState();
    return element;
  }

  clearObjectSelection() {
    if (this.selectedObject) {
      this.selectedObject.classList.remove("is-object-selected");
      this.selectedObject.removeAttribute("aria-selected");
    }
    this.selectedObject = null;
    this.state.objectSelected = false;
  }

  deleteSelectedObject() {
    const target = this.selectedObject;
    if (!target?.isConnected || !this.editor.contains(target)) return false;
    const paragraph = document.createElement("p");
    paragraph.append(document.createElement("br"));
    target.before(paragraph);
    target.remove();
    this.clearObjectSelection();
    const range = document.createRange();
    range.selectNodeContents(paragraph);
    range.collapse(true);
    const selection = global.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
    this.selection = range.cloneRange();
    this.recordHistory();
    this.scheduleUpdate("object-delete", () => {
      this.emitChange();
      this.refreshPageLayout();
    });
    return true;
  }

  insertNode(node) {
    if (this.destroyed) return false;

    this.restoreSelection();
    this.editor.focus({ preventScroll: true });

    const selection = window.getSelection();
    let range;
    if (
      selection &&
      selection.rangeCount &&
      this.isRangeInside(selection.getRangeAt(0))
    ) {
      range = selection.getRangeAt(0);
    } else {
      range = document.createRange();
      range.selectNodeContents(this.editor);
      range.collapse(false);
    }

    range.deleteContents();
    range.insertNode(node);
    range.setStartAfter(node);
    range.collapse(true);
    selection.removeAllRanges();
    selection.addRange(range);

    this.captureSelection();
    this.recordHistory();
    this.scheduleUpdate("change", () => this.emitChange());
    return node;
  }

  requestMediaUrl(kind) {
    if (typeof this.options.requestUrl === "function") {
      return this.options.requestUrl(kind, this);
    }
    return window.prompt(`Enter the ${kind} URL:`)?.trim() ?? "";
  }

  registerCleanup(callback) {
    if (typeof callback !== "function") {
      throw new TypeError("Cleanup must be a function.");
    }
    this.cleanups.add(callback);
    return () => this.cleanups.delete(callback);
  }

  registerObjectUrl(url, node = null) {
    this.objectUrls.set(url, node);
    return url;
  }

  releaseRemovedObjectUrls() {
    if (this.activeResizeFrame && !this.activeResizeFrame.isConnected) {
      this.activeResizeCleanup?.();
    }
    this.objectUrls.forEach((node, url) => {
      if (node && !node.isConnected) {
        URL.revokeObjectURL(url);
        this.objectUrls.delete(url);
      }
    });
  }

  rehydrate() {
    this.editor
      .querySelectorAll("img, video, iframe[data-editra-video]")
      .forEach((media) => {
        const kind = media.tagName === "IMG" ? "image" : "video";
        this.makeMediaResizable(media, kind);
      });
    this.editor
      .querySelectorAll(".editra-barcode, .editra-qr-code")
      .forEach((code) => {
        const kind = code.classList.contains("editra-barcode") ? "barcode" : "qr";
        this.makeMediaResizable(code, kind);
      });
    this.editor.querySelectorAll(".editra-emoji-object").forEach((emoji) => {
      emoji.contentEditable = "false";
      emoji.draggable = true;
      emoji.dataset.editraSelectable = "true";
      emoji.dataset.editraDraggable = "true";
    });

    this.plugins.forEach((plugin) => {
      if (typeof plugin.action?.hydrate === "function") {
        plugin.action.hydrate(this, this.editor);
      }
    });
    if (
      this.editor.querySelector("[data-editra-document-part]") &&
      this.plugins.has("headerfooter") &&
      !this.plugins.get("headerfooter").action
    ) {
      this.ensurePlugin("headerfooter");
    }
    if (
      this.editor.querySelector("[data-editra-ruler-state]") &&
      this.plugins.has("ruler") &&
      !this.plugins.get("ruler").action
    ) {
      this.ensurePlugin("ruler");
    }
  }

  handleInput() {
    this.captureSelection();
    this.scheduleUpdate("input-state", () => {
      try {
        this.security.assertSize(this.editor.innerHTML, "edited document");
      } catch {
        const snapshot = this.history[this.historyIndex] ?? "";
        this.editor.innerHTML = this.security.trustedHTML(
          snapshot,
          "last valid history snapshot",
        );
        this.emitState();
        return;
      }
      this.recordHistory();
      this.emitChange();
      this.refreshPageLayout();
    });
  }

  handlePaste(event) {
    const clipboard = event.clipboardData;
    if (!clipboard) return;

    const imageItem = Array.from(clipboard.items ?? []).find(
      (item) => item.kind === "file" && item.type.startsWith("image/"),
    );

    const imagePlugin = this.plugins.get("image");
    if (imageItem && imagePlugin) {
      event.preventDefault();
      const file = imageItem.getAsFile();
      if (!file) return;
      if (imagePlugin.action?.insertFile) {
        imagePlugin.action.insertFile(this, file);
      } else {
        this.ensurePlugin("image").then((plugin) => {
          if (!this.destroyed) plugin.action.insertFile(this, file);
        });
      }
      return;
    }

    event.preventDefault();
    this.restoreSelection();
    this.execCommand("insertText", clipboard.getData("text/plain"));
  }

  handleKeydown(event) {
    if (
      (event.key === "Delete" || event.key === "Backspace") &&
      this.selectedObject?.isConnected
    ) {
      event.preventDefault();
      event.stopImmediatePropagation();
      this.deleteSelectedObject();
      return;
    }
    const modifier = event.ctrlKey || event.metaKey;
    if (!modifier) return;

    const key = event.key.toLowerCase();
    const shortcutPlugins = [...this.plugins.values()].filter(
      (plugin) => plugin.shortcut === key,
    );

    if (key === "z") {
      event.preventDefault();
      event.shiftKey ? this.redo() : this.undo();
    } else if (key === "y") {
      event.preventDefault();
      this.redo();
    } else if (shortcutPlugins.length) {
      event.preventDefault();
      this.applyFormat(shortcutPlugins[0].name);
    }
  }

  handleSelectionChange() {
    this.scheduleUpdate("selection", () => {
      this.captureSelection();
      this.emitState();
    });
  }

  handleFocus(event) {
    this.state.focused = true;
    this.emitState();
    if (typeof this.options.onFocus === "function") {
      this.options.onFocus({ event, editor: this });
    }
  }

  handleBlur(event) {
    this.state.focused = false;
    this.emitState();
    if (typeof this.options.onBlur === "function") {
      this.options.onBlur({ event, editor: this });
    }
  }

  handleFormReset() {
    setTimeout(() => {
      if (!this.destroyed && this.host instanceof HTMLTextAreaElement) {
        this.setCode(this.host.value);
      }
    }, 0);
  }

  captureSelection() {
    const selection = window.getSelection();
    if (!selection || !selection.rangeCount) return;
    const range = selection.getRangeAt(0);
    if (this.isRangeInside(range)) this.selection = range.cloneRange();
  }

  restoreSelection() {
    if (!this.selection || !this.isRangeInside(this.selection)) return;
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(this.selection);
  }

  isRangeInside(range) {
    return (
      this.editor.contains(range.commonAncestorContainer) ||
      range.commonAncestorContainer === this.editor
    );
  }

  recordHistory(force = false) {
    const html = this.editor.innerHTML;
    if (!force && this.history[this.historyIndex] === html) return;

    const discarded = this.history.splice(this.historyIndex + 1);
    this.historyBytes -= discarded.reduce(
      (total, snapshot) => total + snapshot.length * 2,
      0,
    );
    this.history.push(html);
    this.historyBytes += html.length * 2;
    while (
      this.history.length > 1 &&
      (this.history.length > this.options.historyLimit ||
        this.historyBytes > this.options.historyByteLimit)
    ) {
      const removed = this.history.shift();
      this.historyBytes -= removed.length * 2;
    }
    this.historyIndex = this.history.length - 1;
    this.emitState();
  }

  undo() {
    if (this.destroyed || this.historyIndex <= 0) return false;
    this.historyIndex -= 1;
    this.restoreHistory();
    return true;
  }

  redo() {
    if (
      this.destroyed ||
      this.historyIndex >= this.history.length - 1
    ) {
      return false;
    }
    this.historyIndex += 1;
    this.restoreHistory();
    return true;
  }

  restoreHistory() {
    const snapshot = this.history[this.historyIndex];
    this.scheduleUpdate("history", () => {
      this.editor.innerHTML = this.security.trustedHTML(
        snapshot,
        "history snapshot",
      );
      this.rehydrate();
      this.placeCaretAtEnd();
      this.emitChange();
      this.emitState();
    });
  }

  placeCaretAtEnd() {
    const range = document.createRange();
    range.selectNodeContents(this.editor);
    range.collapse(false);
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
    this.selection = range.cloneRange();
  }

  scheduleUpdate(key, task) {
    if (this.destroyed) return;
    this.pendingTasks.set(key, task);
    if (this.frameId !== null) return;

    this.frameId = window.requestAnimationFrame(() => {
      this.frameId = null;
      const tasks = [...this.pendingTasks.values()];
      this.pendingTasks.clear();
      tasks.forEach((queuedTask) => queuedTask());
    });
  }

  emitChange() {
    const html = this.serializeHTML();
    if (this.host instanceof HTMLTextAreaElement) {
      this.host.value = html;
    }
    if (typeof this.options.onChange === "function") {
      this.options.onChange({
        html,
        text: this.editor.textContent ?? "",
        editor: this.editor,
      });
    }
  }

  emitState() {
    const queryState = (command) => {
      try {
        return document.queryCommandState(command);
      } catch {
        return false;
      }
    };
    const queryValue = (command) => {
      try {
        return document.queryCommandValue(command) || null;
      } catch {
        return null;
      }
    };
    const state = {
      canUndo: this.historyIndex > 0,
      canRedo: this.historyIndex < this.history.length - 1,
      plugins: [...this.plugins.keys()],
      bold: queryState("bold"),
      italic: queryState("italic"),
      underline: queryState("underline"),
      strikethrough: queryState("strikeThrough"),
      superscript: queryState("superscript"),
      subscript: queryState("subscript"),
      bulletList: queryState("insertUnorderedList"),
      numberList: queryState("insertOrderedList"),
      heading: queryValue("formatBlock"),
      alignment: queryState("justifyCenter")
        ? "center"
        : queryState("justifyRight")
          ? "right"
          : queryState("justifyFull")
            ? "justify"
            : "left",
      ...this.state,
    };
    this.toolbar?.update(state);
    if (typeof this.options.onStateChange === "function") {
      this.options.onStateChange(state);
    }
  }

  isSafeMediaUrl(url, allowImageData) {
    return this.security.isSafeUrl(url, { image: Boolean(allowImageData) });
  }

  getHTML() {
    return this.getCode();
  }

  getCode() {
    const source = this.toolbar?.card?.querySelector(".editra-code-view");
    return source
      ? source.value
      : this.pendingCode !== null
        ? this.pendingCode
        : this.serializeHTML();
  }

  getText() {
    const source = this.toolbar?.card?.querySelector(".editra-code-view");
    if (!source && this.pendingCode === null) {
      return this.editor.textContent ?? "";
    }
    const template = document.createElement("template");
    template.innerHTML = this.security.trustedHTML(
      source?.value ?? this.pendingCode ?? "",
      "source view",
    );
    return template.content.textContent ?? "";
  }

  getFormatted() {
    const clone = this.editor.cloneNode(false);
    clone.innerHTML = this.security.trustedHTML(
      this.getCode(),
      "formatted output",
    );
    clone
      .querySelectorAll(
        ".editra-resize-handle, [data-editra-table-handle], [data-editra-ui]",
      )
      .forEach((control) => control.remove());
    clone
      .querySelectorAll(
        ".editra-table-frame.is-table-selected, .is-object-selected",
      )
      .forEach((frame) => {
        frame.classList.remove("is-table-selected", "is-object-selected");
        frame.removeAttribute("aria-selected");
      });
    clone.normalize();
    return clone;
  }

  serializeHTML() {
    const clone = this.editor.cloneNode(true);
    clone
      .querySelectorAll(
        ".editra-resize-handle, [data-editra-table-handle], [data-editra-ui]",
      )
      .forEach((control) => control.remove());
    clone
      .querySelectorAll(
        ".editra-table-frame.is-table-selected, .is-object-selected",
      )
      .forEach((frame) => {
        frame.classList.remove("is-table-selected", "is-object-selected");
        frame.removeAttribute("aria-selected");
      });
    return String(
      this.security.sanitize(clone.innerHTML, {
        trusted: false,
        kind: "serialized output",
      }),
    );
  }

  getMediaData() {
    return {
      images: [...this.editor.querySelectorAll("img")].map((image) => ({
        source: image.dataset.editraSource ?? "url",
        value: image.src,
        bytes: image.src.startsWith("data:")
          ? image.src.slice(image.src.indexOf(",") + 1)
          : null,
        name: image.dataset.editraName ?? null,
        mime: image.dataset.editraMime ?? null,
      })),
      videos: [
        ...this.editor.querySelectorAll(
          "video, iframe[data-editra-video]",
        ),
      ].map((video) => ({
        source: video.dataset.editraSource ?? "url",
        value: video.src,
        name: video.dataset.editraName ?? null,
        mime: video.dataset.editraMime ?? null,
      })),
    };
  }

  setHTML(html) {
    if (this.destroyed) return;
    const code = String(
      this.security.sanitize(html, {
        trusted: false,
        kind: "setHTML input",
      }),
    );
    this.pendingCode = code;
    const source = this.toolbar?.card?.querySelector(".editra-code-view");
    if (source) {
      source.value = code;
      source.dispatchEvent(new Event("input", { bubbles: true }));
    }
    this.scheduleUpdate("content", () => {
      this.editor.innerHTML = this.security.trustedHTML(
        code,
        "setHTML input",
      );
      if (this.pendingCode === code) this.pendingCode = null;
      this.rehydrate();
      this.recordHistory();
      this.emitChange();
    });
    return this;
  }

  setCode(html) {
    if (this.destroyed) return;
    const code = String(
      this.security.sanitize(html, {
        trusted: false,
        kind: "setCode input",
      }),
    );
    this.pendingCode = code;
    const source = this.toolbar?.card?.querySelector(".editra-code-view");
    if (source) {
      source.value = code;
      source.dispatchEvent(new Event("input", { bubbles: true }));
    }
    this.scheduleUpdate("content", () => {
      this.editor.innerHTML = this.security.trustedHTML(
        code,
        "setCode input",
      );
      if (this.pendingCode === code) this.pendingCode = null;
      this.recordHistory();
      this.emitChange();
    });
    return this;
  }

  toggleCodeView(options) {
    return this.executeCommand("toggleCodeView", options);
  }

  async installCommunityPlugin(manifest) {
    await this.ensurePlugin("ecosystem");
    return this.executeCommand("installCommunityPlugin", manifest);
  }

  async uninstallCommunityPlugin(id) {
    await this.ensurePlugin("ecosystem");
    return this.executeCommand("uninstallCommunityPlugin", id);
  }

  async getInstalledCommunityPlugins() {
    await this.ensurePlugin("ecosystem");
    return this.executeCommand("getInstalledCommunityPlugins");
  }

  async checkCommunityPluginUpdates(registryUrl) {
    await this.ensurePlugin("ecosystem");
    return this.executeCommand("checkCommunityPluginUpdates", registryUrl);
  }

  focus() {
    if (!this.destroyed) this.editor.focus();
  }

  destroy() {
    if (this.destroyed) return;
    if (this.host instanceof HTMLTextAreaElement) {
      this.host.value = this.getCode();
    }
    this.destroyed = true;

    this.editor.removeEventListener("input", this.handleInput);
    this.editor.removeEventListener("paste", this.handlePaste);
    this.editor.removeEventListener("keydown", this.handleKeydown, true);
    this.editor.removeEventListener("pointerdown", this.handleResizePointerDown);
    this.editor.removeEventListener("dragstart", this.handleObjectDragStart);
    this.editor.removeEventListener("dragover", this.handleObjectDragOver);
    this.editor.removeEventListener("drop", this.handleObjectDrop);
    this.editor.removeEventListener("dragend", this.handleObjectDragEnd);
    this.editor.removeEventListener("focus", this.handleFocus);
    this.editor.removeEventListener("blur", this.handleBlur);
    this.host.form?.removeEventListener("reset", this.handleFormReset);
    document.removeEventListener("selectionchange", this.handleSelectionChange);
    this.mediaObserver?.disconnect();
    this.pageResizeObserver?.disconnect();
    this.activeResizeCleanup?.();
    this.menubar?.destroy();
    this.toolbar.destroy();
    this.cleanups.forEach((cleanup) => cleanup());
    this.cleanups.clear();
    this.security?.destroy();

    if (this.frameId !== null) window.cancelAnimationFrame(this.frameId);
    this.pendingTasks.clear();
    this.pendingCode = null;
    this.state = Object.create(null);
    this.selection = null;
    this.selectedObject = null;
    this.history.length = 0;
    this.historyBytes = 0;
    this.plugins.clear();
    this.commands.clear();
    this.objectUrls.forEach((_, url) => URL.revokeObjectURL(url));
    this.objectUrls.clear();
    delete this.editor.editraInstance;
    delete this.host.editraInstance;
    if (this.host instanceof HTMLTextAreaElement) {
      this.editor.remove();
      this.host.hidden = this.textareaState?.hidden ?? false;
      this.host.style.display = this.textareaState?.display ?? "";
    }
    this.options.onChange = null;
    this.options.onStateChange = null;
    this.options.onCommand = null;
    this.options.onPaste = null;
    this.options.onFocus = null;
    this.options.onBlur = null;
    this.options.onMenuToggle = null;
    this.options.onToolbarBuild = null;
    this.options.onRulerAdjust = null;
    this.options.onPageChange = null;
    this.options.onThemeToggle = null;
    this.options.onLanguageChange = null;
    this.options.onSecurityViolation = null;
  }
}

  EditraCore.VERSION = "1.0.0";
  EditraCore.PRODUCT = "Editra";
  global.EditraCore = EditraCore;
  global.Editra = EditraCore;
})(window);
