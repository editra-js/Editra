// Version: 2.0.0
/**
 * Product: Editra
 * Version: 2.0.0
 * Purpose: Implements the Editra codeview plugin and its editor commands.
 * Licensing: MIT License (open source)
 */

(function (global) {
  "use strict";

  const installations = new WeakMap();

  function escapeHTML(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }

  function highlightTag(tag) {
    if (tag.startsWith("<!--")) {
      return `<span class="editra-code-comment">${escapeHTML(tag)}</span>`;
    }
    const match = tag.match(/^(<\/?)([A-Za-z][\w:-]*)([\s\S]*?)(\/?>)$/);
    if (!match) return escapeHTML(tag);
    const [, opening, name, attributes, closing] = match;
    let output =
      `<span class="editra-code-punctuation">${escapeHTML(opening)}</span>` +
      `<span class="editra-code-tag">${escapeHTML(name)}</span>`;
    let cursor = 0;
    const expression =
      /([^\s=/>]+)(\s*=\s*)("[^"]*"|'[^']*'|[^\s>]+)/g;
    let attribute;
    while ((attribute = expression.exec(attributes))) {
      output += escapeHTML(attributes.slice(cursor, attribute.index));
      output +=
        `<span class="editra-code-attribute">${escapeHTML(attribute[1])}</span>` +
        `<span class="editra-code-punctuation">${escapeHTML(attribute[2])}</span>` +
        `<span class="editra-code-value">${escapeHTML(attribute[3])}</span>`;
      cursor = attribute.index + attribute[0].length;
    }
    output += escapeHTML(attributes.slice(cursor));
    output += `<span class="editra-code-punctuation">${escapeHTML(closing)}</span>`;
    return output;
  }

  function highlightHTML(source) {
    const expression = /<!--[\s\S]*?-->|<![^>]*>|<\/?[A-Za-z][^>]*>/g;
    let output = "";
    let cursor = 0;
    let match;
    while ((match = expression.exec(source))) {
      output += escapeHTML(source.slice(cursor, match.index));
      output += highlightTag(match[0]);
      cursor = match.index + match[0].length;
    }
    return output + escapeHTML(source.slice(cursor)) + "\n";
  }

  function applySource(core, state, record = true) {
    if (!state.textarea) return false;
    const sanitized = String(
      core.sanitizeHTML(state.textarea.value, {
        kind: "HTML source view",
      }),
    );
    if (sanitized !== state.textarea.value) {
      state.textarea.value = sanitized;
      updateDecorations(state);
    }
    core.editor.innerHTML = core.security.trustedHTML(
      sanitized,
      "HTML source view",
    );
    if (record) core.recordHistory();
    core.scheduleUpdate("codeview-change", () => {
      core.emitChange();
      core.refreshPageLayout();
    });
    return true;
  }

  function saveSource(core, state, options = {}) {
    if (!state.textarea) return false;
    const source = String(
      core.sanitizeHTML(state.textarea.value, {
        kind: "HTML source save",
      }),
    );
    state.textarea.value = source;
    applySource(core, state);
    if (options.download !== false) {
      core.downloadFile(
        options.fileName || "editra-document.html",
        source,
        "text/html;charset=utf-8",
      );
    }
    return { format: "html-source", html: source };
  }

  function updateDecorations(state, sourceChanged = true) {
    if (!state.textarea || state.decorationFrame !== null) return;
    state.decorationFrame = requestAnimationFrame(() => {
      state.decorationFrame = null;
      const source = state.textarea.value;
      if (sourceChanged || !state.sourceLines) {
        state.sourceLines = source.split("\n");
        state.sourceVersion += 1;
        state.lines.textContent = Array.from(
          { length: Math.max(1, state.sourceLines.length) },
          (_, index) => index + 1,
        ).join("\n");
      }
      const virtual = state.sourceLines.length > 1500;
      const lineHeight =
        Number.parseFloat(getComputedStyle(state.textarea).lineHeight) || 20;
      const firstVisible = Math.max(
        0,
        Math.floor(state.textarea.scrollTop / lineHeight),
      );
      const start = virtual
        ? Math.max(0, Math.floor(Math.max(0, firstVisible - 60) / 100) * 100)
        : 0;
      const end = virtual
        ? Math.min(state.sourceLines.length, start + 300)
        : state.sourceLines.length;
      const signature = `${state.sourceVersion}:${start}:${end}`;
      if (signature !== state.highlightSignature) {
        const prefix = virtual ? "\n".repeat(start) : "";
        state.highlight.innerHTML =
          prefix + highlightHTML(state.sourceLines.slice(start, end).join("\n"));
        state.highlightSignature = signature;
      }
      syncScroll(state);
    });
  }

  function syncScroll(state) {
    if (!state.textarea) return;
    const x = state.textarea.scrollLeft;
    const y = state.textarea.scrollTop;
    state.highlight.style.transform = `translate(${-x}px, ${-y}px)`;
    state.lines.style.transform = `translateY(${-y}px)`;
  }

  function insertText(textarea, text, start, end = start) {
    textarea.setRangeText(text, start, end, "end");
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
  }

  function handleIndentation(event, state) {
    const textarea = state.textarea;
    if (event.key === "Tab") {
      event.preventDefault();
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      if (event.shiftKey) {
        const lineStart = textarea.value.lastIndexOf("\n", start - 1) + 1;
        const removable = textarea.value
          .slice(lineStart, lineStart + 2)
          .match(/^(?: {1,2}|\t)/)?.[0];
        if (removable) {
          textarea.setRangeText("", lineStart, lineStart + removable.length);
          textarea.setSelectionRange(
            Math.max(lineStart, start - removable.length),
            Math.max(lineStart, end - removable.length),
          );
          textarea.dispatchEvent(new Event("input", { bubbles: true }));
        }
      } else {
        insertText(textarea, "  ", start, end);
      }
      return true;
    }
    if (event.key !== "Enter") return false;
    event.preventDefault();
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const before = textarea.value.slice(0, start);
    const after = textarea.value.slice(end);
    const lineStart = before.lastIndexOf("\n") + 1;
    const indentation = before.slice(lineStart).match(/^\s*/)?.[0] ?? "";
    const opensElement =
      /<([A-Za-z][\w:-]*)(?:\s[^>]*)?>\s*$/.test(before) &&
      !/<(?:area|base|br|col|embed|hr|img|input|link|meta|source|track|wbr)(?:\s[^>]*)?>\s*$/i.test(
        before,
      );
    const closesElement = /^\s*<\//.test(after);
    if (opensElement && closesElement) {
      const insertion = `\n${indentation}  \n${indentation}`;
      textarea.setRangeText(insertion, start, end);
      const caret = start + indentation.length + 3;
      textarea.setSelectionRange(caret, caret);
      textarea.dispatchEvent(new Event("input", { bubbles: true }));
    } else {
      insertText(
        textarea,
        `\n${indentation}${opensElement ? "  " : ""}`,
        start,
        end,
      );
    }
    return true;
  }

  function updateUI(core, state) {
    core.state.codeView = state.active;
    core.toolbar.card.classList.toggle("editra-code-view-active", state.active);
    const button = core.toolbar.getButton("codeview");
    button?.classList.toggle("is-active", state.active);
    button?.setAttribute("aria-pressed", String(state.active));
    core.emitState();
  }

  function createCodeEditor(core, state) {
    const wrapper = document.createElement("section");
    wrapper.className = "editra-code-editor";
    wrapper.dataset.editraUi = "true";
    wrapper.setAttribute("aria-label", "HTML source editor");
    const header = document.createElement("header");
    header.innerHTML =
      '<span class="editra-code-language">HTML</span><span>Source</span>';
    const body = document.createElement("div");
    body.className = "editra-code-editor-body";
    const gutter = document.createElement("div");
    gutter.className = "editra-code-gutter";
    const lines = document.createElement("pre");
    lines.setAttribute("aria-hidden", "true");
    gutter.append(lines);
    const surface = document.createElement("div");
    surface.className = "editra-code-surface";
    const highlight = document.createElement("pre");
    highlight.className = "editra-code-highlight";
    highlight.setAttribute("aria-hidden", "true");
    const textarea = document.createElement("textarea");
    textarea.className = "editra-code-view";
    textarea.setAttribute("aria-label", "HTML source code");
    textarea.setAttribute("wrap", "off");
    textarea.spellcheck = false;
    textarea.autocomplete = "off";
    textarea.autocapitalize = "off";
    textarea.value = core.getCode();
    surface.append(highlight, textarea);
    body.append(gutter, surface);
    wrapper.append(header, body);
    state.wrapper = wrapper;
    state.textarea = textarea;
    state.highlight = highlight;
    state.lines = lines;
    return wrapper;
  }

  function enable(core, state) {
    if (state.active) return true;
    const wrapper = createCodeEditor(core, state);
    core.editor.hidden = true;
    core.editor.after(wrapper);
    state.active = true;
    state.bindEditor();
    updateDecorations(state);
    updateUI(core, state);
    state.textarea.focus({ preventScroll: true });
    return true;
  }

  function disable(core, state) {
    if (!state.active) return true;
    clearTimeout(state.inputTimer);
    if (state.decorationFrame !== null) {
      cancelAnimationFrame(state.decorationFrame);
      state.decorationFrame = null;
    }
    applySource(core, state);
    state.unbindEditor();
    state.wrapper.remove();
    state.wrapper = null;
    state.textarea = null;
    state.highlight = null;
    state.lines = null;
    state.active = false;
    core.editor.hidden = false;
    updateUI(core, state);
    core.placeCaretAtEnd();
    core.focus();
    return true;
  }

  function toggleCodeView(core, state, options = {}) {
    const enableView =
      typeof options.enabled === "boolean" ? options.enabled : !state.active;
    return enableView ? enable(core, state) : disable(core, state);
  }

  async function codeViewStressTest(core, options = {}) {
    const lines = Math.max(1000, Number(options.lines) || 25000);
    const startedAt = performance.now();
    let source = "";
    for (let start = 0; start < lines; start += 1000) {
      const end = Math.min(start + 1000, lines);
      source += Array.from(
        { length: end - start },
        (_, offset) =>
          `<p class="line" data-index="${start + offset}">Line ${start + offset + 1}</p>\n`,
      ).join("");
      if (end < lines) {
        await new Promise((resolve) => requestAnimationFrame(resolve));
      }
    }
    const highlighted = highlightHTML(source);
    return {
      lines,
      sourceBytes: new Blob([source]).size,
      highlightedBytes: new Blob([highlighted]).size,
      durationMs: Math.round(performance.now() - startedAt),
    };
  }

  function install(core) {
    if (installations.has(core)) return installations.get(core);
    const state = {
      active: false,
      wrapper: null,
      textarea: null,
      highlight: null,
      lines: null,
      inputTimer: null,
      scrollFrame: null,
      decorationFrame: null,
      sourceLines: null,
      sourceVersion: 0,
      highlightSignature: "",
      unregisterCommands: [],
    };
    state.unregisterCommands.push(
      core.registerCommand(
        "toggleCodeView",
        (options) => toggleCodeView(core, state, options),
        { plugin: "codeview", source: "plugin" },
      ),
      core.registerCommand(
        "codeViewStressTest",
        (options) => codeViewStressTest(core, options),
        { plugin: "codeview", source: "plugin" },
      ),
      core.registerCommand(
        "saveHTMLSource",
        (options) => saveSource(core, state, options),
        { plugin: "codeview", source: "plugin" },
      ),
    );

    function handleInput() {
      updateDecorations(state);
      clearTimeout(state.inputTimer);
      state.inputTimer = global.setTimeout(() => {
        core.scheduleUpdate("codeview-sync", () => applySource(core, state));
      }, 300);
    }
    function handleScroll() {
      if (state.scrollFrame !== null) return;
      state.scrollFrame = requestAnimationFrame(() => {
        state.scrollFrame = null;
        syncScroll(state);
        updateDecorations(state, false);
      });
    }
    function handleKeydown(event) {
      if (event.key === "Escape") {
        event.preventDefault();
        disable(core, state);
        return;
      }
      handleIndentation(event, state);
    }
    state.bindEditor = () => {
      state.textarea.addEventListener("input", handleInput);
      state.textarea.addEventListener("scroll", handleScroll, { passive: true });
      state.textarea.addEventListener("keydown", handleKeydown);
    };
    state.unbindEditor = () => {
      state.textarea?.removeEventListener("input", handleInput);
      state.textarea?.removeEventListener("scroll", handleScroll);
      state.textarea?.removeEventListener("keydown", handleKeydown);
    };

    core.registerCleanup(() => {
      clearTimeout(state.inputTimer);
      if (state.decorationFrame !== null) {
        cancelAnimationFrame(state.decorationFrame);
      }
      if (state.scrollFrame !== null) cancelAnimationFrame(state.scrollFrame);
      if (state.textarea) {
        applySource(core, state, false);
        state.unbindEditor();
        state.wrapper.remove();
      }
      core.editor.hidden = false;
      state.unregisterCommands.forEach((unregister) => unregister());
      installations.delete(core);
    });
    installations.set(core, state);
    return state;
  }

  function CodeViewPlugin(core, options) {
    const state = install(core);
    return toggleCodeView(core, state, options);
  }

  CodeViewPlugin.install = install;
  CodeViewPlugin.hydrate = install;
  CodeViewPlugin.highlightHTML = highlightHTML;
  CodeViewPlugin.plugin = Object.freeze({
    name: "codeview",
    label: "HTML code view",
    icon: "codeView",
    command: "toggleCodeView",
  });

  global.CodeViewPlugin = CodeViewPlugin;
  (global.EditraPlugins ??= Object.create(null)).codeview = CodeViewPlugin;
})(window);
