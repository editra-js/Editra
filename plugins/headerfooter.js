(function (global) {
  "use strict";

  const installations = new WeakMap();

  function escapeHTML(value) {
    const element = document.createElement("span");
    element.textContent = String(value ?? "");
    return element.innerHTML;
  }

  function normalize(value, part) {
    const options =
      typeof value === "string" || typeof value === "number"
        ? { text: String(value) }
        : value ?? {};
    const pieces = [];
    if (options.html) pieces.push(String(options.html));
    else if (options.text !== undefined) pieces.push(escapeHTML(options.text));
    if (options.pageNumber) {
      pieces.push(
        escapeHTML(
          typeof options.pageNumber === "string"
            ? options.pageNumber
            : "Page {{page}} of {{pages}}",
        ),
      );
    }
    if (options.dateTime) {
      pieces.push(
        escapeHTML(
          typeof options.dateTime === "string"
            ? options.dateTime
            : "{{date}}",
        ),
      );
    }
    const template = pieces.join('<span class="editra-part-separator"> · </span>');
    return {
      part,
      template: template || escapeHTML(part === "header" ? "Header" : "Footer"),
      fields:
        options.fields && typeof options.fields === "object"
          ? { ...options.fields }
          : {},
      dateLocale: options.dateLocale || undefined,
    };
  }

  function sourceFor(core, part) {
    return core.editor.querySelector(
      `[data-editra-document-part="${part}"]`,
    );
  }

  function readDefinition(source) {
    if (!source) return null;
    try {
      return JSON.parse(source.dataset.editraDefinition || "null");
    } catch {
      return {
        part: source.dataset.editraDocumentPart,
        template: source.innerHTML,
        fields: {},
      };
    }
  }

  function resolveDefinition(definition, page, pages) {
    if (!definition) return "";
    const values = {
      page: String(page),
      pages: String(pages),
      date: new Date().toLocaleString(definition.dateLocale),
      ...Object.fromEntries(
        Object.entries(definition.fields || {}).map(([name, value]) => [
          name,
          String(value),
        ]),
      ),
    };
    return String(definition.template).replace(
      /\{\{\s*([^{}]+?)\s*\}\}/g,
      (match, name) =>
        Object.hasOwn(values, name) ? escapeHTML(values[name]) : match,
    );
  }

  function updatePreviews(core) {
    const guides = [...(core.pageGuides?.querySelectorAll(".editra-page-guide") ?? [])];
    const pageCount = guides.length;
    const header = readDefinition(sourceFor(core, "header"));
    const footer = readDefinition(sourceFor(core, "footer"));
    guides.forEach((guide, index) => {
      guide
        .querySelectorAll(".editra-page-header-preview,.editra-page-footer-preview")
        .forEach((preview) => preview.remove());
      if (header) {
        const preview = document.createElement("div");
        preview.className = "editra-page-header-preview";
        preview.innerHTML = core.security.trustedHTML(
          resolveDefinition(header, index + 1, pageCount),
          "header preview",
        );
        core.security.restoreDeferredStyles(preview);
        guide.append(preview);
      }
      if (footer) {
        const preview = document.createElement("div");
        preview.className = "editra-page-footer-preview";
        preview.innerHTML = core.security.trustedHTML(
          resolveDefinition(footer, index + 1, pageCount),
          "footer preview",
        );
        core.security.restoreDeferredStyles(preview);
        guide.append(preview);
      }
    });
  }

  function insertPart(core, part, value) {
    if (value === undefined) {
      const text = global.prompt(
        `${part === "header" ? "Header" : "Footer"} text:`,
        part === "footer" ? "Page {{page}} of {{pages}}" : "Document title",
      );
      if (text === null) return false;
      value = { text };
    }
    const definition = normalize(value, part);
    let source = sourceFor(core, part);
    if (!source) {
      source = document.createElement(part);
      source.hidden = true;
      source.className = `editra-document-${part}`;
      source.dataset.editraDocumentPart = part;
      source.contentEditable = "false";
      core.editor.prepend(source);
    }
    source.dataset.editraDefinition = JSON.stringify(definition);
    source.innerHTML = core.security.trustedHTML(
      definition.template,
      `${part} content`,
    );
    core.security.restoreDeferredStyles(source);
    core.state[part] = { ...definition };
    core.recordHistory();
    core.scheduleUpdate("header-footer", () => {
      updatePreviews(core);
      core.emitChange();
      core.emitState();
    });
    return { ...definition };
  }

  function removePart(core, part) {
    const source = sourceFor(core, part);
    if (!source) return false;
    source.remove();
    delete core.state[part];
    core.recordHistory();
    core.scheduleUpdate("header-footer", () => {
      updatePreviews(core);
      core.emitChange();
      core.emitState();
    });
    return true;
  }

  async function headerFooterStressTest(core, options = {}) {
    const pages = Math.max(100, Number(options.pages) || 500);
    const definition = normalize(
      {
        text: "Editra document",
        pageNumber: true,
        dateTime: true,
        fields: { Department: "Editorial" },
      },
      "header",
    );
    const startedAt = performance.now();
    let bytes = 0;
    for (let start = 1; start <= pages; start += 100) {
      const end = Math.min(start + 99, pages);
      for (let page = start; page <= end; page += 1) {
        bytes += new Blob([
          resolveDefinition(definition, page, pages),
        ]).size;
      }
      if (end < pages) {
        await new Promise((resolve) => requestAnimationFrame(resolve));
      }
    }
    return {
      pages,
      bytes,
      durationMs: Math.round((performance.now() - startedAt) * 100) / 100,
    };
  }

  function install(core) {
    if (installations.has(core)) return installations.get(core);
    const pageListener = () =>
      core.scheduleUpdate("header-footer-preview", () => updatePreviews(core));
    core.editor.addEventListener("editra:pageChange", pageListener);
    const handlers = {
      insertHeader: (value) => insertPart(core, "header", value),
      insertFooter: (value) => insertPart(core, "footer", value),
      removeHeader: () => removePart(core, "header"),
      removeFooter: () => removePart(core, "footer"),
      headerFooterStressTest: (options) =>
        headerFooterStressTest(core, options),
    };
    const unregister = Object.entries(handlers).map(([name, handler]) =>
      core.registerCommand(name, handler, {
        plugin: "headerfooter",
        source: "plugin",
      }),
    );
    const state = { unregister, pageListener };
    core.registerCleanup(() => {
      core.editor.removeEventListener("editra:pageChange", pageListener);
      unregister.forEach((remove) => remove());
      installations.delete(core);
    });
    installations.set(core, state);
    updatePreviews(core);
    return state;
  }

  function HeaderFooterPlugin(core, value) {
    install(core);
    return insertPart(core, "header", value);
  }

  HeaderFooterPlugin.install = install;
  HeaderFooterPlugin.hydrate = function hydrate(core) {
    install(core);
    ["header", "footer"].forEach((part) => {
      const definition = readDefinition(sourceFor(core, part));
      if (definition) core.state[part] = definition;
    });
    updatePreviews(core);
  };
  HeaderFooterPlugin.resolve = resolveDefinition;
  HeaderFooterPlugin.plugin = Object.freeze({
    name: "headerfooter",
    label: "Header and footer",
    command: "insertHeader",
  });
  global.HeaderFooterPlugin = HeaderFooterPlugin;
  (global.EditraPlugins ??= Object.create(null)).headerfooter =
    HeaderFooterPlugin;
})(window);
