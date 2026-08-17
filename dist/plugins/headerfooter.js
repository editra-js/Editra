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

  function updatePreviews(core, state) {
    if (state?.editing?.preview?.isConnected) return;
    const guides = [...(core.pageGuides?.querySelectorAll(".editra-page-guide") ?? [])];
    const pageCount = guides.length;
    const header = readDefinition(sourceFor(core, "header"));
    const footer = readDefinition(sourceFor(core, "footer"));
    if (core.pageGuides) {
      if (header || footer) core.pageGuides.removeAttribute("aria-hidden");
      else core.pageGuides.setAttribute("aria-hidden", "true");
    }
    guides.forEach((guide, index) => {
      guide.querySelector(":scope > span")?.setAttribute("aria-hidden", "true");
      guide
        .querySelectorAll(".editra-page-header-preview,.editra-page-footer-preview")
        .forEach((preview) => preview.remove());
      if (header) {
        const preview = document.createElement("div");
        preview.className = "editra-page-header-preview";
        preview.dataset.editraPartPreview = "header";
        preview.dataset.editraPage = String(index + 1);
        preview.contentEditable = "false";
        preview.tabIndex = 0;
        preview.setAttribute("role", "textbox");
        preview.setAttribute("aria-label", `Edit header on page ${index + 1}`);
        preview.title = "Click to edit header";
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
        preview.dataset.editraPartPreview = "footer";
        preview.dataset.editraPage = String(index + 1);
        preview.contentEditable = "false";
        preview.tabIndex = 0;
        preview.setAttribute("role", "textbox");
        preview.setAttribute("aria-label", `Edit footer on page ${index + 1}`);
        preview.title = "Click to edit footer";
        preview.innerHTML = core.security.trustedHTML(
          resolveDefinition(footer, index + 1, pageCount),
          "footer preview",
        );
        core.security.restoreDeferredStyles(preview);
        guide.append(preview);
      }
    });
  }

  /** Stores a sanitized definition used by page previews and all exports. */
  function storePart(core, state, part, definition, options = {}) {
    definition = { ...definition };
    let source = sourceFor(core, part);
    if (!source) {
      source = document.createElement(part);
      source.hidden = true;
      source.className = `editra-document-${part}`;
      source.dataset.editraDocumentPart = part;
      source.contentEditable = "false";
      core.editor.prepend(source);
    }
    source.innerHTML = core.security.trustedHTML(
      definition.template,
      `${part} content`,
    );
    core.security.restoreDeferredStyles(source);
    // Persist only the sanitized markup. Preview resolution must never read
    // the original unsanitized string back from the data attribute.
    definition.template = source.innerHTML;
    source.dataset.editraDefinition = JSON.stringify(definition);
    core.state[part] = { ...definition };
    if (options.record !== false) core.recordHistory();
    core.scheduleUpdate("header-footer", () => {
      if (options.refresh !== false) updatePreviews(core, state);
      core.emitChange();
      core.emitState();
    });
    return { ...definition };
  }

  /** Positions an Editra-owned dialog near the center of the editor card. */
  function positionDialog(core, dialog) {
    const rect = core.toolbar?.card?.getBoundingClientRect();
    const width = Math.min(430, innerWidth - 24);
    dialog.style.width = `${width}px`;
    dialog.style.left = `${Math.max(12, Math.min(
      (rect?.left ?? 0) + ((rect?.width ?? innerWidth) - width) / 2,
      innerWidth - width - 12,
    ))}px`;
    dialog.style.top = `${Math.max(12, Math.min(
      (rect?.top ?? 0) + 72,
      innerHeight - 310,
    ))}px`;
  }

  /** Opens the same accessible Editra modal for inserting and editing a part. */
  function openPartDialog(core, state, part) {
    document
      .querySelector(".editra-media-dialog")
      ?.dispatchEvent(new CustomEvent("editra:close"));
    core.captureSelection();
    const label = part === "header" ? "Header" : "Footer";
    const existing = readDefinition(sourceFor(core, part));
    const dialog = document.createElement("div");
    dialog.className = "editra-header-footer-dialog editra-media-dialog";
    dialog.dataset.editraUi = "true";
    dialog.setAttribute("role", "dialog");
    dialog.setAttribute("aria-modal", "true");
    dialog.setAttribute("aria-label", `${existing ? "Edit" : "Insert"} ${part}`);
    dialog.innerHTML = core.security.trustedUIHTML(`
      <div class="editra-dialog-heading">${existing ? "Edit" : "Insert"} ${label}</div>
      <form class="editra-header-footer-form">
        <label>
          <span>${label} content</span>
          <textarea rows="4" data-editra-part-value required></textarea>
        </label>
        <p class="editra-header-footer-hint">Use {{page}}, {{pages}}, or {{date}} for automatic fields.</p>
        <div class="editra-header-footer-actions">
          <button type="button" data-editra-cancel>Cancel</button>
          <button type="submit">${existing ? "Save" : "Insert"}</button>
        </div>
      </form>
    `, "header footer dialog");
    const backdrop = document.createElement("div");
    backdrop.className = "editra-dialog-backdrop";
    backdrop.dataset.editraUi = "true";
    backdrop.setAttribute("aria-hidden", "true");
    document.body.append(backdrop, dialog);
    positionDialog(core, dialog);

    const form = dialog.querySelector("form");
    const input = dialog.querySelector("[data-editra-part-value]");
    input.value = existing
      ? sourceFor(core, part).textContent || ""
      : part === "footer"
        ? "Page {{page}} of {{pages}}"
        : "Document title";
    let closed = false;
    let unregister = () => {};
    const close = (restore = true) => {
      if (closed) return;
      closed = true;
      dialog.removeEventListener("editra:close", close);
      dialog.removeEventListener("keydown", handleKeydown);
      form.removeEventListener("submit", handleSubmit);
      document.removeEventListener("pointerdown", handleOutside, true);
      backdrop.remove();
      dialog.remove();
      unregister();
      if (restore) core.restoreSelection();
    };
    const handleSubmit = (event) => {
      event.preventDefault();
      const text = input.value.trim();
      if (!text) {
        input.setAttribute("aria-invalid", "true");
        input.focus();
        return;
      }
      storePart(core, state, part, normalize({ text }, part));
      close(false);
    };
    const handleKeydown = (event) => {
      if (event.key === "Escape") close();
      if (event.key === "Tab") {
        const controls = [...dialog.querySelectorAll("textarea,button")];
        const first = controls[0];
        const last = controls.at(-1);
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    const handleOutside = (event) => {
      if (!dialog.contains(event.target)) close();
    };
    dialog.querySelector("[data-editra-cancel]").addEventListener("click", () => close());
    dialog.addEventListener("editra:close", close);
    dialog.addEventListener("keydown", handleKeydown);
    form.addEventListener("submit", handleSubmit);
    document.addEventListener("pointerdown", handleOutside, true);
    unregister = core.registerCleanup(close);
    input.focus({ preventScroll: true });
    input.select();
    return dialog;
  }

  function insertPart(core, state, part, value) {
    if (value === undefined) return openPartDialog(core, state, part);
    return storePart(core, state, part, normalize(value, part));
  }

  /** Enters Word-like direct editing on one page preview. */
  function beginPreviewEdit(core, state, preview) {
    if (!preview || state.editing?.preview === preview) return;
    if (state.editing) finishPreviewEdit(core, state, false);
    const part = preview.dataset.editraPartPreview;
    const definition = readDefinition(sourceFor(core, part));
    if (!definition) return;
    state.editing = {
      part,
      preview,
      initialTemplate: definition.template,
      currentTemplate: definition.template,
    };
    preview.innerHTML = core.security.trustedHTML(
      definition.template,
      `${part} inline editor`,
    );
    core.security.restoreDeferredStyles(preview);
    preview.contentEditable = "true";
    preview.classList.add("is-editing");
    preview.setAttribute("aria-label", `Editing ${part}`);
    preview.focus({ preventScroll: true });
    const range = document.createRange();
    range.selectNodeContents(preview);
    range.collapse(false);
    const selection = global.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
  }

  /** Synchronizes direct typing without rebuilding the preview being edited. */
  function syncPreviewEdit(core, state) {
    const editing = state.editing;
    if (!editing?.preview?.isConnected) return false;
    const definition = readDefinition(sourceFor(core, editing.part)) ||
      normalize({}, editing.part);
    const sanitizer = document.createElement("div");
    sanitizer.innerHTML = core.security.trustedHTML(
      editing.preview.innerHTML,
      `${editing.part} inline edit`,
    );
    core.security.restoreDeferredStyles(sanitizer);
    definition.template = sanitizer.innerHTML;
    editing.currentTemplate = definition.template;
    core.pageGuides
      ?.querySelectorAll(`[data-editra-part-preview="${editing.part}"]`)
      .forEach((preview) => {
        if (preview === editing.preview) return;
        preview.innerHTML = core.security.trustedHTML(
          resolveDefinition(
            definition,
            Number(preview.dataset.editraPage) || 1,
            core.pageGuides.querySelectorAll(".editra-page-guide").length,
          ),
          `${editing.part} synchronized preview`,
        );
        core.security.restoreDeferredStyles(preview);
      });
    return true;
  }

  /** Finishes direct editing, or restores its starting template on Escape. */
  function finishPreviewEdit(core, state, cancel = false) {
    const editing = state.editing;
    if (!editing) return false;
    if (!cancel) {
      syncPreviewEdit(core, state);
      const definition = readDefinition(sourceFor(core, editing.part)) ||
        normalize({}, editing.part);
      definition.template = editing.currentTemplate;
      storePart(core, state, editing.part, definition, {
        refresh: false,
      });
    }
    editing.preview.contentEditable = "false";
    editing.preview.classList.remove("is-editing");
    state.editing = null;
    updatePreviews(core, state);
    core.emitChange();
    core.emitState();
    return true;
  }

  /** Inserts pasted header/footer content as text to keep inline editing safe. */
  function pastePlainText(event) {
    const text = event.clipboardData?.getData("text/plain") || "";
    if (!text) return;
    event.preventDefault();
    const selection = global.getSelection();
    if (!selection?.rangeCount) return;
    const range = selection.getRangeAt(0);
    range.deleteContents();
    const node = document.createTextNode(text);
    range.insertNode(node);
    range.setStartAfter(node);
    range.collapse(true);
    selection.removeAllRanges();
    selection.addRange(range);
    event.target.dispatchEvent(new Event("input", { bubbles: true }));
  }

  function removePart(core, state, part) {
    if (state.editing?.part === part) finishPreviewEdit(core, state, true);
    const source = sourceFor(core, part);
    if (!source) return false;
    source.remove();
    delete core.state[part];
    core.recordHistory();
    core.scheduleUpdate("header-footer", () => {
      updatePreviews(core, state);
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
    const state = {
      editing: null,
      unregister: [],
      pageListener: null,
    };
    const pageListener = () =>
      core.scheduleUpdate("header-footer-preview", () => updatePreviews(core, state));
    state.pageListener = pageListener;
    core.editor.addEventListener("editra:pageChange", pageListener);
    const handlers = {
      insertHeader: (value) => insertPart(core, state, "header", value),
      insertFooter: (value) => insertPart(core, state, "footer", value),
      removeHeader: () => removePart(core, state, "header"),
      removeFooter: () => removePart(core, state, "footer"),
      headerFooterStressTest: (options) =>
        headerFooterStressTest(core, options),
    };
    const unregister = Object.entries(handlers).map(([name, handler]) =>
      core.registerCommand(name, handler, {
        plugin: "headerfooter",
        source: "plugin",
      }),
    );
    state.unregister = unregister;
    const previewFor = (event) =>
      event.target.closest?.("[data-editra-part-preview]");
    const handlePreviewClick = (event) => {
      const preview = previewFor(event);
      if (preview && core.pageGuides?.contains(preview)) {
        beginPreviewEdit(core, state, preview);
      }
    };
    const handlePreviewInput = (event) => {
      if (previewFor(event) === state.editing?.preview) syncPreviewEdit(core, state);
    };
    const handlePreviewKeydown = (event) => {
      const preview = previewFor(event);
      if (!preview) return;
      if (!state.editing && (event.key === "Enter" || event.key === "F2")) {
        event.preventDefault();
        beginPreviewEdit(core, state, preview);
      } else if (state.editing?.preview === preview && event.key === "Escape") {
        event.preventDefault();
        finishPreviewEdit(core, state, true);
      } else if (
        state.editing?.preview === preview &&
        event.key === "Enter" &&
        (event.ctrlKey || event.metaKey)
      ) {
        event.preventDefault();
        finishPreviewEdit(core, state, false);
      }
    };
    const handlePreviewFocusOut = (event) => {
      const preview = previewFor(event);
      if (preview !== state.editing?.preview) return;
      setTimeout(() => {
        if (state.editing?.preview === preview && !preview.contains(document.activeElement)) {
          finishPreviewEdit(core, state, false);
        }
      }, 0);
    };
    const handlePreviewPaste = (event) => {
      if (previewFor(event) === state.editing?.preview) pastePlainText(event);
    };
    core.pageGuides?.addEventListener("click", handlePreviewClick);
    core.pageGuides?.addEventListener("input", handlePreviewInput);
    core.pageGuides?.addEventListener("keydown", handlePreviewKeydown);
    core.pageGuides?.addEventListener("focusout", handlePreviewFocusOut);
    core.pageGuides?.addEventListener("paste", handlePreviewPaste);
    core.registerCleanup(() => {
      if (state.editing) finishPreviewEdit(core, state, true);
      core.editor.removeEventListener("editra:pageChange", pageListener);
      core.pageGuides?.removeEventListener("click", handlePreviewClick);
      core.pageGuides?.removeEventListener("input", handlePreviewInput);
      core.pageGuides?.removeEventListener("keydown", handlePreviewKeydown);
      core.pageGuides?.removeEventListener("focusout", handlePreviewFocusOut);
      core.pageGuides?.removeEventListener("paste", handlePreviewPaste);
      unregister.forEach((remove) => remove());
      installations.delete(core);
    });
    installations.set(core, state);
    updatePreviews(core, state);
    return state;
  }

  function HeaderFooterPlugin(core, value) {
    const state = install(core);
    return insertPart(core, state, "header", value);
  }

  HeaderFooterPlugin.install = install;
  HeaderFooterPlugin.hydrate = function hydrate(core) {
    const state = install(core);
    ["header", "footer"].forEach((part) => {
      const definition = readDefinition(sourceFor(core, part));
      if (definition) core.state[part] = definition;
    });
    updatePreviews(core, state);
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
