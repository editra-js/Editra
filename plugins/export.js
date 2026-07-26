/**
 * © Minsoft. All rights reserved.
 * Product: Editra (Minsoft product)
 * Author: Editra Team
 * Version: 1.15.0
 * Purpose: Implements the Editra export plugin and its editor commands.
 * Licensing: MIT License (open source)
 */

(function (global) {
  "use strict";

  const installations = new WeakMap();

  function nextFrame() {
    return new Promise((resolve) => requestAnimationFrame(resolve));
  }

  function escapeHTML(value) {
    return String(value).replace(
      /[&<>"']/g,
      (character) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[character],
    );
  }

  function coveredContentHeight(core, style) {
    const editorTop = core.editor.getBoundingClientRect().top;
    let bottom = Number.parseFloat(style.paddingTop) || 0;
    [...core.editor.children].forEach((child) => {
      if (
        child.hidden ||
        child.matches("[data-editra-document-part],.editra-page-break")
      ) {
        return;
      }
      bottom = Math.max(
        bottom,
        child.getBoundingClientRect().bottom - editorTop,
      );
    });
    return Math.ceil(bottom + (Number.parseFloat(style.paddingBottom) || 0));
  }

  function pageMetrics(core, options = {}) {
    const editorStyle = getComputedStyle(core.editor);
    const width = core.editor.getBoundingClientRect().width ||
      Number.parseFloat(core.options.editorWidth) || 816;
    const configuredHeight = core.resolveEditorPixels(
      core.options.editorHeight,
      "1056px",
    );
    const height = options.contentOnly
      ? Math.max(1, coveredContentHeight(core, editorStyle))
      : configuredHeight;
    const explicit = core.editor.querySelectorAll(".editra-page-break").length + 1;
    const pageCount = options.contentOnly
      ? 1
      : Math.max(
          explicit,
          Number(core.state.pageCount) || 1,
          Math.ceil(Math.max(height, core.editor.scrollHeight) / height),
        );
    return {
      width,
      height,
      pageCount,
      widthCSS: `${Math.round(width * 100) / 100}px`,
      heightCSS: `${Math.round(height * 100) / 100}px`,
      paddingTop: editorStyle.paddingTop,
      paddingRight: editorStyle.paddingRight,
      paddingBottom: editorStyle.paddingBottom,
      paddingLeft: editorStyle.paddingLeft,
      fontFamily: editorStyle.fontFamily,
      fontSize: editorStyle.fontSize,
      lineHeight: editorStyle.lineHeight,
      textIndent: editorStyle.textIndent,
      color: editorStyle.color,
      contentOnly: Boolean(options.contentOnly),
      pageSize: core.state.pageSize || core.options.pageSize || "Custom",
      orientation:
        core.state.orientation || core.options.orientation || "portrait",
    };
  }

  function cleanClone(node) {
    const clone = node.cloneNode(true);
    if (clone.nodeType !== Node.ELEMENT_NODE) return clone;
    if (
      clone.matches(
        "[data-editra-ui], [data-editra-document-part], [data-editra-ruler-state], .editra-resize-handle, [data-editra-table-handle]",
      )
    ) {
      return null;
    }
    clone
      .querySelectorAll(
        "[data-editra-ui], [data-editra-document-part], [data-editra-ruler-state], .editra-resize-handle, [data-editra-table-handle]",
      )
      .forEach((control) => control.remove());
    clone.removeAttribute("contenteditable");
    clone.querySelectorAll("[contenteditable]").forEach((element) => {
      element.removeAttribute("contenteditable");
    });
    clone.classList.remove("is-table-selected");
    clone
      .querySelectorAll(".editra-table-frame.is-table-selected")
      .forEach((frame) => frame.classList.remove("is-table-selected"));
    return clone;
  }

  function readPart(core, part) {
    const source = core.editor.querySelector(
      `[data-editra-document-part="${part}"]`,
    );
    if (!source) return null;
    try {
      return JSON.parse(source.dataset.editraDefinition || "null");
    } catch {
      return { template: source.innerHTML, fields: {} };
    }
  }

  function resolvePart(definition, page, pages) {
    if (!definition) return "";
    const values = {
      page: String(page),
      pages: String(pages),
      date: new Date().toLocaleString(definition.dateLocale),
      ...(definition.fields || {}),
    };
    return String(definition.template || "").replace(
      /\{\{\s*([^{}]+?)\s*\}\}/g,
      (match, name) =>
        Object.hasOwn(values, name) ? escapeHTML(values[name]) : match,
    );
  }

  async function paginate(core, options = {}) {
    await nextFrame();
    core.refreshPageLayout();
    const metrics = pageMetrics(core, options);
    const pages = Array.from({ length: metrics.pageCount }, () => []);
    const nodes = [...core.editor.childNodes];
    let forcedPage = 0;

    for (let start = 0; start < nodes.length; start += 250) {
      const chunk = nodes.slice(start, start + 250);
      chunk.forEach((node) => {
        if (
          node.nodeType === Node.ELEMENT_NODE &&
          node.classList.contains("editra-page-break")
        ) {
          forcedPage = Math.min(forcedPage + 1, pages.length - 1);
          return;
        }
        let naturalPage = forcedPage;
        if (node.nodeType === Node.ELEMENT_NODE) {
          naturalPage = Math.max(
            forcedPage,
            Math.floor(Math.max(0, node.offsetTop) / metrics.height),
          );
        }
        const pageIndex = Math.min(naturalPage, pages.length - 1);
        const clone = cleanClone(node);
        if (clone) pages[pageIndex].push(clone);
      });
      if (start + 250 < nodes.length) await nextFrame();
    }

    return {
      pages,
      metrics,
      parts: {
        header: readPart(core, "header"),
        footer: readPart(core, "footer"),
      },
    };
  }

  function exportCSS(metrics) {
    const width = escapeHTML(metrics.widthCSS);
    const height = escapeHTML(metrics.heightCSS);
    return `
      @page { size: ${width} ${height}; margin: 0; }
      * { box-sizing: border-box; }
      html, body { margin: 0; padding: 0; background: #e9eaed; }
      body { color: ${metrics.color}; font-family: ${metrics.fontFamily}; font-size: ${metrics.fontSize}; line-height: ${metrics.lineHeight}; }
      .editra-export-page {
        position: relative; width: ${width}; height: ${height}; min-width: ${width};
        min-height: ${height}; margin: 0 auto 18px; overflow: hidden; color: inherit;
        padding: ${metrics.paddingTop} ${metrics.paddingRight} ${metrics.paddingBottom} ${metrics.paddingLeft};
        background: #fff; page-break-after: always; break-after: page;
        text-indent: ${metrics.textIndent};
      }
      .editra-export-page:last-child { margin-bottom: 0; page-break-after: auto; break-after: auto; }
      .editra-export-header,.editra-export-footer {
        position: absolute; right: ${metrics.paddingRight}; left: ${metrics.paddingLeft};
        overflow: hidden; color: inherit; font-size: .86em; line-height: 1.25;
        text-indent: 0; white-space: nowrap;
      }
      .editra-export-header { top: calc(${metrics.paddingTop} / 3); }
      .editra-export-footer { bottom: calc(${metrics.paddingBottom} / 3); }
      h1 { font-size: 2em; } h2 { font-size: 1.5em; } h3 { font-size: 1.17em; }
      h4 { font-size: 1em; } h5 { font-size: .83em; } h6 { font-size: .67em; }
      h1,h2,h3,h4,h5,h6 { line-height: 1.2; break-after: avoid; }
      table { border-collapse: collapse; max-width: 100%; } td,th { border: 1px solid #111; }
      img,video,iframe { max-width: 100%; } .editra-page-break { display: none; }
      .editra-tab { display: inline-block; min-width: 2.5em; white-space: pre; }
      .editra-tab[data-editra-tab-stop] { min-width: 1px; }
      @media print {
        html, body { background: #fff; }
        .editra-export-page { margin: 0; border: 0; box-shadow: none; }
      }
    `;
  }

  function documentHTML(
    pages,
    metrics,
    title = "Editra document",
    parts = {},
  ) {
    const sections = pages
      .map((nodes, index) => {
        const content = nodes
          .map((node) =>
            node.nodeType === Node.TEXT_NODE
              ? escapeHTML(node.nodeValue)
              : node.outerHTML,
          )
          .join("");
        const header = resolvePart(parts.header, index + 1, pages.length);
        const footer = resolvePart(parts.footer, index + 1, pages.length);
        return `<section class="editra-export-page" data-editra-page="${index + 1}" aria-label="Page ${index + 1}">${header ? `<header class="editra-export-header">${header}</header>` : ""}<div class="editra-export-content">${content}</div>${footer ? `<footer class="editra-export-footer">${footer}</footer>` : ""}</section>`;
      })
      .join("");
    return `<!doctype html><html><head><meta charset="utf-8"><meta name="generator" content="Editra"><title>${escapeHTML(title)}</title><style>${exportCSS(metrics)}</style></head><body data-editra-page-size="${escapeHTML(metrics.pageSize)}" data-editra-orientation="${escapeHTML(metrics.orientation)}">${sections}</body></html>`;
  }

  async function createExport(core, options = {}) {
    const result = await paginate(core, options);
    return {
      ...result,
      html: documentHTML(
        result.pages,
        result.metrics,
        options.title || "Editra document",
        result.parts,
      ),
    };
  }

  async function exportHTML(core, options = {}) {
    const result = await createExport(core, options);
    core.downloadFile(
      options.fileName || "editra-document.html",
      result.html,
      "text/html;charset=utf-8",
    );
    return { format: "html", pageCount: result.metrics.pageCount };
  }

  async function exportWord(core, options = {}) {
    const result = await createExport(core, options);
    const wordHTML = result.html.replace(
      "</style>",
      `.editra-export-page{mso-page-break-after:always;} .editra-export-page:last-child{mso-page-break-after:auto;} @page EditraSection{size:${result.metrics.widthCSS} ${result.metrics.heightCSS};margin:0;} .editra-export-page{page:EditraSection;}</style>`,
    );
    core.downloadFile(
      options.fileName || "editra-document.doc",
      wordHTML,
      "application/msword",
    );
    return { format: "word", pageCount: result.metrics.pageCount };
  }

  async function exportPDF(core, options = {}) {
    const result = await createExport(core, options);
    const frame = document.createElement("iframe");
    frame.className = "editra-print-frame";
    frame.dataset.editraUi = "true";
    frame.setAttribute("aria-hidden", "true");
    document.body.append(frame);
    const frameDocument = frame.contentDocument;
    frameDocument.open();
    frameDocument.write(result.html);
    frameDocument.close();
    await new Promise((resolve) => {
      if (frameDocument.readyState === "complete") resolve();
      else frame.addEventListener("load", resolve, { once: true });
    });
    const removeFrame = () => frame.remove();
    frame.contentWindow.addEventListener("afterprint", removeFrame, {
      once: true,
    });
    const unregister = core.registerCleanup(removeFrame);
    frame.contentWindow.focus();
    frame.contentWindow.print();
    setTimeout(() => {
      removeFrame();
      unregister();
    }, 30000);
    return { format: "pdf", pageCount: result.metrics.pageCount };
  }

  function exportDocument(core, options = {}) {
    const format = String(options.format || "html").toLowerCase();
    if (format === "pdf") return exportPDF(core, options);
    if (format === "word" || format === "doc") return exportWord(core, options);
    return exportHTML(core, options);
  }

  async function exportStressTest(core, options = {}) {
    const startedAt = performance.now();
    const result = await createExport(core, options);
    return {
      pageCount: result.metrics.pageCount,
      htmlBytes: new Blob([result.html]).size,
      durationMs: Math.round((performance.now() - startedAt) * 100) / 100,
      pageWidth: result.metrics.widthCSS,
      pageHeight: result.metrics.heightCSS,
    };
  }

  function install(core) {
    if (installations.has(core)) return installations.get(core);
    const handlers = {
      exportPDF: (options) => exportPDF(core, options),
      exportWord: (options) => exportWord(core, options),
      exportHTML: (options) => exportHTML(core, options),
      exportDocument: (options) => exportDocument(core, options),
      exportStressTest: (options) => exportStressTest(core, options),
      "export-pdf": (options) => exportPDF(core, options),
      "export-word": (options) => exportWord(core, options),
      "import-word": async (options) => {
        const plugin = await core.ensurePlugin("productivity");
        return plugin ? core.executeCommand("importWord", options) : false;
      },
    };
    const unregister = Object.entries(handlers).map(([name, handler]) =>
      core.registerCommand(name, handler, {
        plugin: "export",
        source: "plugin",
      }),
    );
    const state = { unregister };
    core.registerCleanup(() => {
      unregister.forEach((remove) => remove());
      installations.delete(core);
    });
    installations.set(core, state);
    return state;
  }

  function ExportPlugin(core, options) {
    install(core);
    return options === undefined ? true : exportDocument(core, options);
  }

  ExportPlugin.install = install;
  ExportPlugin.hydrate = install;
  ExportPlugin.plugin = Object.freeze({
    name: "export",
    label: "Page-fidelity export",
    command: "exportPDF",
  });

  global.EditraExportPlugin = ExportPlugin;
  (global.EditraPlugins ??= Object.create(null)).export = ExportPlugin;
})(window);
