(function (global) {
  "use strict";

  const installations = new WeakMap();

  function nextFrame() {
    return new Promise((resolve) => requestAnimationFrame(resolve));
  }

  function escapeRegExp(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  function searchExpression(query, options = {}, globalSearch = true) {
    const source = options.wholeWord
      ? `\\b${escapeRegExp(query)}\\b`
      : escapeRegExp(query);
    return new RegExp(
      source,
      `${globalSearch ? "g" : ""}${options.caseSensitive ? "" : "i"}`,
    );
  }

  async function collectMatches(root, query, options = {}) {
    if (!query) return [];
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        return node.parentElement?.closest(
          "[data-editra-ui], .editra-resize-handle, .editra-table-context-menu",
        )
          ? NodeFilter.FILTER_REJECT
          : NodeFilter.FILTER_ACCEPT;
      },
    });
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);

    const matches = [];
    for (let start = 0; start < nodes.length; start += 300) {
      const end = Math.min(start + 300, nodes.length);
      for (let index = start; index < end; index += 1) {
        const node = nodes[index];
        const expression = searchExpression(query, options);
        let match;
        while ((match = expression.exec(node.nodeValue))) {
          matches.push({
            node,
            start: match.index,
            length: match[0].length,
          });
          if (!match[0].length) expression.lastIndex += 1;
        }
      }
      if (end < nodes.length) await nextFrame();
    }
    return matches;
  }

  function selectMatch(core, match) {
    if (!match?.node?.isConnected) return false;
    const range = document.createRange();
    range.setStart(match.node, match.start);
    range.setEnd(match.node, match.start + match.length);
    const selection = getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
    core.selection = range.cloneRange();
    match.node.parentElement?.scrollIntoView({
      block: "center",
      behavior: "smooth",
    });
    return true;
  }

  async function replaceAll(core, query, replacement, options = {}) {
    if (!query) return 0;
    const walker = document.createTreeWalker(
      core.editor,
      NodeFilter.SHOW_TEXT,
    );
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    let replacements = 0;

    for (let start = 0; start < nodes.length; start += 300) {
      const end = Math.min(start + 300, nodes.length);
      for (let index = start; index < end; index += 1) {
        const node = nodes[index];
        const expression = searchExpression(query, options);
        node.nodeValue = node.nodeValue.replace(expression, () => {
          replacements += 1;
          return replacement;
        });
      }
      if (end < nodes.length) await nextFrame();
    }

    if (replacements) {
      core.recordHistory();
      core.scheduleUpdate("productivity-change", () => core.emitChange());
    }
    return replacements;
  }

  function openFindReplace(core, state, options = {}) {
    state.findOverlay?.dispatchEvent(new CustomEvent("editra:close"));
    const overlay = document.createElement("div");
    overlay.className = "editra-productivity-overlay editra-find-overlay";
    overlay.dataset.editraUi = "true";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-label", "Find and replace");
    overlay.innerHTML = core.security.trustedUIHTML(`
      <div class="editra-productivity-heading">
        <span>Find &amp; Replace</span>
        <button type="button" data-find-action="close" aria-label="Close">×</button>
      </div>
      <label>Find
        <input type="text" data-find-input>
      </label>
      <label>Replace
        <input type="text" data-replace-input>
      </label>
      <div class="editra-find-options">
        <label><input type="checkbox" data-case-sensitive> Match case</label>
        <label><input type="checkbox" data-whole-word> Whole word</label>
      </div>
      <div class="editra-find-actions">
        <button type="button" data-find-action="next">Find next</button>
        <button type="button" data-find-action="replace">Replace</button>
        <button type="button" data-find-action="all">Replace all</button>
      </div>
      <div class="editra-find-status" aria-live="polite">Ready</div>
    `, "find and replace dialog");
    core.toolbar.card.append(overlay);

    const findInput = overlay.querySelector("[data-find-input]");
    const replaceInput = overlay.querySelector("[data-replace-input]");
    const caseInput = overlay.querySelector("[data-case-sensitive]");
    const wholeInput = overlay.querySelector("[data-whole-word]");
    const status = overlay.querySelector(".editra-find-status");
    findInput.value = String(options.find ?? "");
    replaceInput.value = String(options.replace ?? "");
    caseInput.checked = Boolean(options.caseSensitive);
    wholeInput.checked = Boolean(options.wholeWord);

    let matches = [];
    let matchIndex = -1;
    let unregister = () => {};
    let closed = false;

    function searchOptions() {
      return {
        caseSensitive: caseInput.checked,
        wholeWord: wholeInput.checked,
      };
    }

    async function refresh() {
      matches = await collectMatches(
        core.editor,
        findInput.value,
        searchOptions(),
      );
      matchIndex = matches.length ? 0 : -1;
      status.textContent = matches.length
        ? `${matches.length} match${matches.length === 1 ? "" : "es"}`
        : "No matches";
      if (matchIndex >= 0) selectMatch(core, matches[matchIndex]);
    }

    async function handleAction(event) {
      const action = event.target.closest("[data-find-action]")?.dataset
        .findAction;
      if (!action) return;
      if (action === "close") {
        close();
      } else if (action === "next") {
        if (!matches.length) await refresh();
        else {
          matchIndex = (matchIndex + 1) % matches.length;
          selectMatch(core, matches[matchIndex]);
          status.textContent = `${matchIndex + 1} of ${matches.length}`;
        }
      } else if (action === "replace") {
        const match = matches[matchIndex];
        if (!match?.node?.isConnected) {
          await refresh();
          return;
        }
        match.node.deleteData(match.start, match.length);
        match.node.insertData(match.start, replaceInput.value);
        core.recordHistory();
        core.scheduleUpdate("productivity-change", () => core.emitChange());
        await refresh();
      } else if (action === "all") {
        const count = await replaceAll(
          core,
          findInput.value,
          replaceInput.value,
          searchOptions(),
        );
        matches = [];
        matchIndex = -1;
        status.textContent = `Replaced ${count} occurrence${count === 1 ? "" : "s"}`;
      }
    }

    function handleKeydown(event) {
      if (event.key === "Escape") close();
      else if (event.key === "Enter" && event.target === findInput) {
        event.preventDefault();
        refresh();
      }
    }

    function close() {
      if (closed) return;
      closed = true;
      overlay.removeEventListener("click", handleAction);
      overlay.removeEventListener("keydown", handleKeydown);
      overlay.removeEventListener("editra:close", close);
      overlay.remove();
      state.findOverlay = null;
      unregister();
      core.focus();
    }

    overlay.addEventListener("click", handleAction);
    overlay.addEventListener("keydown", handleKeydown);
    overlay.addEventListener("editra:close", close);
    unregister = core.registerCleanup(close);
    state.findOverlay = overlay;
    findInput.focus({ preventScroll: true });
    if (options.find) refresh();
    return overlay;
  }

  function captureFormat(core, state) {
    const selection = getSelection();
    if (!selection?.rangeCount || selection.isCollapsed) return false;
    const range = selection.getRangeAt(0);
    if (!core.isRangeInside(range)) return false;
    const element =
      range.startContainer.nodeType === Node.ELEMENT_NODE
        ? range.startContainer
        : range.startContainer.parentElement;
    const style = getComputedStyle(element);
    state.painter = {
      fontFamily: style.fontFamily,
      fontSize: style.fontSize,
      color: style.color,
      fontWeight: style.fontWeight,
      fontStyle: style.fontStyle,
      textDecoration: style.textDecoration,
      lineHeight: style.lineHeight,
      backgroundColor: style.backgroundColor,
      letterSpacing: style.letterSpacing,
    };

    state.painterToast?.remove();
    const toast = document.createElement("div");
    toast.className = "editra-format-painter-toast";
    toast.dataset.editraUi = "true";
    toast.textContent = "Format copied — select target text";
    core.toolbar.card.append(toast);
    state.painterToast = toast;
    const painterButton =
      core.toolbar.getButton("formatPainter") ||
      core.toolbar.getButton("productivity");
    painterButton?.classList.add("is-active");
    painterButton?.setAttribute("aria-pressed", "true");
    core.announce("Format Painter copied formatting. Select target text.");

    state.painterListener = () => {
      requestAnimationFrame(() => {
        const applied = applyFormatPainter(core, state);
        if (!applied && state.painter) {
          core.editor.addEventListener("pointerup", state.painterListener, {
            once: true,
          });
        }
      });
    };
    core.editor.addEventListener("pointerup", state.painterListener, {
      once: true,
    });
    return true;
  }

  function clearPainter(core, state) {
    if (state.painterListener) {
      core.editor.removeEventListener("pointerup", state.painterListener);
    }
    state.painterListener = null;
    state.painterToast?.remove();
    state.painterToast = null;
    state.painter = null;
    const painterButton =
      core.toolbar.getButton("formatPainter") ||
      core.toolbar.getButton("productivity");
    painterButton?.classList.remove("is-active");
    painterButton?.setAttribute("aria-pressed", "false");
  }

  function applyFormatPainter(core, state) {
    if (!state.painter) return false;
    const selection = getSelection();
    if (!selection?.rangeCount || selection.isCollapsed) return false;
    const range = selection.getRangeAt(0);
    if (!core.isRangeInside(range)) return false;

    const span = document.createElement("span");
    Object.assign(span.style, state.painter);
    span.append(range.extractContents());
    range.insertNode(span);
    selection.removeAllRanges();
    const selected = document.createRange();
    selected.selectNodeContents(span);
    selection.addRange(selected);
    core.selection = selected.cloneRange();
    clearPainter(core, state);
    core.recordHistory();
    core.scheduleUpdate("productivity-change", () => core.emitChange());
    return true;
  }

  function formatPainter(core, state, options = {}) {
    if (options.format) {
      state.painter = options.format;
      return applyFormatPainter(core, state);
    }
    if (state.painter) return applyFormatPainter(core, state);
    return captureFormat(core, state);
  }

  function insertFieldNode(core, field) {
    const cleanField = String(field || "Field")
      .replace(/[{}]/g, "")
      .trim();
    if (!cleanField) return false;
    const placeholder = document.createElement("span");
    placeholder.className = "editra-merge-field";
    placeholder.dataset.field = cleanField;
    placeholder.contentEditable = "false";
    placeholder.textContent = `{{${cleanField}}}`;
    return core.insertNode(placeholder);
  }

  function openMergeField(core, state) {
    state.mergeOverlay?.dispatchEvent(new CustomEvent("editra:close"));
    const overlay = document.createElement("div");
    overlay.className = "editra-productivity-overlay editra-merge-overlay";
    overlay.dataset.editraUi = "true";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-label", "Insert merge field");
    overlay.innerHTML = core.security.trustedUIHTML(`
      <div class="editra-productivity-heading">
        <span>Insert merge field</span>
        <button type="button" data-merge-close aria-label="Close">×</button>
      </div>
      <div class="editra-merge-presets">
        <button type="button" data-merge-field="Name">{{Name}}</button>
        <button type="button" data-merge-field="Date">{{Date}}</button>
        <button type="button" data-merge-field="Email">{{Email}}</button>
        <button type="button" data-merge-field="Company">{{Company}}</button>
      </div>
      <form class="editra-merge-custom">
        <input type="text" placeholder="Custom field name" aria-label="Custom field name" required>
        <button type="submit">Insert</button>
      </form>
    `, "merge field dialog");
    core.toolbar.card.append(overlay);
    const form = overlay.querySelector("form");
    const input = form.querySelector("input");
    let unregister = () => {};
    let closed = false;

    function handleClick(event) {
      if (event.target.closest("[data-merge-close]")) close();
      const field = event.target.closest("[data-merge-field]")?.dataset
        .mergeField;
      if (field) {
        close();
        insertFieldNode(core, field);
      }
    }

    function handleSubmit(event) {
      event.preventDefault();
      const field = input.value.trim();
      if (!field) return;
      close();
      insertFieldNode(core, field);
    }

    function handleKeydown(event) {
      if (event.key === "Escape") close();
    }

    function close() {
      if (closed) return;
      closed = true;
      overlay.removeEventListener("click", handleClick);
      overlay.removeEventListener("keydown", handleKeydown);
      overlay.removeEventListener("editra:close", close);
      form.removeEventListener("submit", handleSubmit);
      overlay.remove();
      state.mergeOverlay = null;
      unregister();
      core.focus();
    }

    overlay.addEventListener("click", handleClick);
    overlay.addEventListener("keydown", handleKeydown);
    overlay.addEventListener("editra:close", close);
    form.addEventListener("submit", handleSubmit);
    unregister = core.registerCleanup(close);
    state.mergeOverlay = overlay;
    input.focus({ preventScroll: true });
    return overlay;
  }

  async function previewMergeFields(core, state, options = {}) {
    const enabled =
      typeof options.enabled === "boolean" ? options.enabled : !state.preview;
    const data = {
      Name: "Ada Lovelace",
      Date: new Date().toLocaleDateString(),
      Email: "ada@example.com",
      Company: "Editra",
      ...(options.data ?? {}),
    };
    const fields = [...core.editor.querySelectorAll(".editra-merge-field")];

    for (let start = 0; start < fields.length; start += 200) {
      const end = Math.min(start + 200, fields.length);
      for (let index = start; index < end; index += 1) {
        const field = fields[index];
        const name = field.dataset.field;
        field.textContent = enabled
          ? String(data[name] ?? `{{${name}}}`)
          : `{{${name}}}`;
        field.classList.toggle("is-preview", enabled);
      }
      if (end < fields.length) await nextFrame();
    }
    state.preview = enabled;
    core.toolbar.card.classList.toggle("editra-merge-preview", enabled);
    return enabled;
  }

  async function serializeAsync(core) {
    const clone = core.editor.cloneNode(true);
    const controls = [
      ...clone.querySelectorAll(
        "[data-editra-ui], .editra-resize-handle, [data-editra-table-handle]",
      ),
    ];
    for (let start = 0; start < controls.length; start += 500) {
      controls
        .slice(start, start + 500)
        .forEach((control) => control.remove());
      if (start + 500 < controls.length) await nextFrame();
    }
    return clone.innerHTML;
  }

  async function exportPDF(core) {
    const html = await serializeAsync(core);
    const frame = document.createElement("iframe");
    frame.className = "editra-print-frame";
    frame.dataset.editraUi = "true";
    document.body.append(frame);
    const documentBody = frame.contentDocument;
    documentBody.open();
    documentBody.write(
      `<!doctype html><html><head><meta charset="utf-8"><title>Editra PDF</title></head><body>${html}</body></html>`,
    );
    documentBody.close();
    await nextFrame();
    frame.contentWindow.focus();
    frame.contentWindow.print();
    const unregister = core.registerCleanup(() => frame.remove());
    setTimeout(() => {
      frame.remove();
      unregister();
    }, 1000);
    return true;
  }

  async function exportWord(core) {
    const html = await serializeAsync(core);
    return core.downloadFile(
      "editra-document.doc",
      `<!doctype html><html><head><meta charset="utf-8"></head><body>${html}</body></html>`,
      "application/msword",
    );
  }

  function markdownForNode(node) {
    if (node.nodeType === Node.TEXT_NODE) return node.nodeValue;
    if (node.nodeType !== Node.ELEMENT_NODE) return "";
    const content = [...node.childNodes].map(markdownForNode).join("");
    const tag = node.tagName.toLowerCase();
    if (/^h[1-6]$/.test(tag)) {
      return `${"#".repeat(Number(tag[1]))} ${content.trim()}\n\n`;
    }
    if (tag === "p") return `${content.trim()}\n\n`;
    if (tag === "strong" || tag === "b") return `**${content}**`;
    if (tag === "em" || tag === "i") return `*${content}*`;
    if (tag === "u") return `<u>${content}</u>`;
    if (tag === "a") return `[${content}](${node.getAttribute("href") || ""})`;
    if (tag === "li") return `- ${content.trim()}\n`;
    if (tag === "blockquote") return `> ${content.trim()}\n\n`;
    if (tag === "pre") return `\`\`\`\n${content.trim()}\n\`\`\`\n\n`;
    if (tag === "br") return "\n";
    if (tag === "hr") return "\n---\n";
    if (tag === "img") return `![${node.getAttribute("alt") || ""}](${node.getAttribute("src") || ""})`;
    if (node.classList.contains("editra-merge-field")) {
      return `{{${node.dataset.field}}}`;
    }
    return content;
  }

  async function exportMarkdown(core) {
    const clone = core.editor.cloneNode(true);
    const children = [...clone.childNodes];
    let markdown = "";
    for (let start = 0; start < children.length; start += 100) {
      markdown += children
        .slice(start, start + 100)
        .map(markdownForNode)
        .join("");
      if (start + 100 < children.length) await nextFrame();
    }
    return core.downloadFile(
      "editra-document.md",
      markdown.trim(),
      "text/markdown",
    );
  }

  function pickFile(core, accept) {
    return new Promise((resolve) => {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = accept;
      input.hidden = true;
      let settled = false;
      let unregister = () => {};

      function finish(file) {
        if (settled) return;
        settled = true;
        input.removeEventListener("change", handleChange);
        global.removeEventListener("focus", handleFocus);
        input.remove();
        unregister();
        resolve(file ?? null);
      }

      function handleChange() {
        finish(input.files?.[0]);
      }

      function handleFocus() {
        setTimeout(() => {
          if (!input.files?.length) finish(null);
        }, 300);
      }

      input.addEventListener("change", handleChange);
      global.addEventListener("focus", handleFocus, { once: true });
      unregister = core.registerCleanup(() => finish(null));
      document.body.append(input);
      input.click();
    });
  }

  function readFile(file, method) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.addEventListener("load", () => resolve(reader.result), {
        once: true,
      });
      reader.addEventListener("error", () => reject(reader.error), {
        once: true,
      });
      reader[method](file);
    });
  }

  const UNSAFE_IMPORTED_CSS =
    /(?:url\s*\(|expression\s*\(|@import|behavior\s*:|-moz-binding|javascript\s*:|vbscript\s*:)/i;

  function safeStyleDeclaration(name, value) {
    const property = String(name || "").trim().toLowerCase();
    const content = String(value || "").trim();
    if (!property || !content || UNSAFE_IMPORTED_CSS.test(content)) return false;
    if (
      ["all", "animation", "animation-name", "behavior", "cursor"].includes(
        property,
      )
    ) {
      return false;
    }
    if (property === "position" && /^(?:fixed|sticky)$/i.test(content)) {
      return false;
    }
    return true;
  }

  function collectStyleRules(cssTexts) {
    if (typeof CSSStyleSheet !== "function") {
      throw new Error("This browser cannot safely preserve imported CSS.");
    }
    const matchedRules = [];
    const outputRules = [];

    function visit(ruleList) {
      [...ruleList].forEach((rule) => {
        if (rule.type === 1 && rule.selectorText && rule.style) {
          const declarations = [...rule.style]
            .filter((property) =>
              safeStyleDeclaration(property, rule.style.getPropertyValue(property)),
            )
            .map((property) => ({
              name: property,
              value: rule.style.getPropertyValue(property),
              priority: rule.style.getPropertyPriority(property),
            }));
          if (!declarations.length) return;
          matchedRules.push({
            selector: rule.selectorText,
            declarations,
          });
          outputRules.push(
            `${rule.selectorText}{${declarations
              .map(
                ({ name, value, priority }) =>
                  `${name}:${value}${priority ? ` !${priority}` : ""}`,
              )
              .join(";")}}`,
          );
        } else if (
          rule.type === 4 &&
          global.matchMedia?.(rule.conditionText).matches
        ) {
          visit(rule.cssRules);
        }
      });
    }

    cssTexts.forEach((cssText) => {
      const sourceSheet = new CSSStyleSheet();
      sourceSheet.replaceSync(String(cssText || ""));
      visit(sourceSheet.cssRules);
    });

    const safeSheet = new CSSStyleSheet();
    safeSheet.replaceSync(outputRules.join("\n"));
    return { matchedRules, safeSheet };
  }

  function normalizeInlineStyles(root) {
    [root, ...root.querySelectorAll("*")].forEach((element) => {
      [...element.style].forEach((property) => {
        const value = element.style.getPropertyValue(property);
        if (!safeStyleDeclaration(property, value)) {
          element.style.removeProperty(property);
        }
      });
      if (!element.getAttribute("style")?.trim()) {
        element.removeAttribute("style");
      }
    });
  }

  function formatCounter(value, format) {
    const number = Math.max(1, Number(value) || 1);
    if (/alpha|letter/i.test(format)) {
      let current = number;
      let result = "";
      while (current > 0) {
        current -= 1;
        result = String.fromCharCode(97 + (current % 26)) + result;
        current = Math.floor(current / 26);
      }
      return /upper/i.test(format) ? result.toUpperCase() : result;
    }
    if (/roman/i.test(format)) {
      const numerals = [
        [1000, "m"], [900, "cm"], [500, "d"], [400, "cd"],
        [100, "c"], [90, "xc"], [50, "l"], [40, "xl"],
        [10, "x"], [9, "ix"], [5, "v"], [4, "iv"], [1, "i"],
      ];
      let current = number;
      let result = "";
      numerals.forEach(([amount, numeral]) => {
        while (current >= amount) {
          result += numeral;
          current -= amount;
        }
      });
      return /upper/i.test(format) ? result.toUpperCase() : result;
    }
    return String(number);
  }

  function decodeCSSString(value) {
    return value.replace(
      /\\([0-9a-f]{1,6})\s?|\\(.)/gi,
      (match, hexadecimal, character) =>
        hexadecimal
          ? String.fromCodePoint(parseInt(hexadecimal, 16))
          : character === "A"
            ? "\n"
            : character,
    );
  }

  function materializePseudoStyles(container, shadow, matchedRules) {
    const counters = new Map();
    matchedRules.forEach(({ selector, declarations }) => {
      const pseudoMatch = selector.match(/::?(before|after)\b/i);
      if (!pseudoMatch) return;
      const baseSelector = selector.replace(/::?(?:before|after)\b/gi, "");
      let matches;
      try {
        matches = shadow.querySelectorAll(baseSelector);
      } catch {
        return;
      }
      const declaration = Object.fromEntries(
        declarations.map((item) => [item.name, item]),
      );
      const rawContent = declaration.content?.value;
      if (!rawContent || /^(?:none|normal)$/i.test(rawContent)) return;

      matches.forEach((element) => {
        if (element !== container && !container.contains(element)) return;
        const increment = declaration["counter-increment"]?.value
          ?.trim()
          .split(/\s+/)[0];
        if (increment && increment !== "none") {
          counters.set(increment, (counters.get(increment) || 0) + 1);
        }
        let text = rawContent.replace(
          /counter\(\s*([^,\s)]+)(?:\s*,\s*([^)]+))?\)/gi,
          (match, counter, format = "decimal") =>
            formatCounter(counters.get(counter) || 1, format.trim()),
        );
        text = text.replace(
          /(["'])((?:\\.|(?!\1)[\s\S])*)\1/g,
          (match, quote, content) => decodeCSSString(content),
        );
        text = text
          .replace(/\u00a0/g, " ")
          .replace(/\s+([.,;:!?])/g, "$1")
          .replace(/ {2,}/g, " ")
          .trimStart();
        if (!text || /(?:var|attr)\(/i.test(text)) return;

        const marker = document.createElement("span");
        marker.dataset.editraImportMarker = "true";
        marker.setAttribute("contenteditable", "false");
        marker.style.whiteSpace = "pre";
        marker.textContent = text;
        const pseudoStyle = global.getComputedStyle(
          element,
          `::${pseudoMatch[1].toLowerCase()}`,
        );
        declarations.forEach(({ name, priority }) => {
          if (["content", "counter-increment", "counter-reset"].includes(name)) {
            return;
          }
          const value = pseudoStyle.getPropertyValue(name);
          if (safeStyleDeclaration(name, value)) {
            marker.style.setProperty(name, value, priority);
          }
        });
        if (pseudoMatch[1].toLowerCase() === "after") element.append(marker);
        else element.prepend(marker);
      });
    });
  }

  async function flattenRenderedDocument(core, container, cssTexts, format) {
    const shadow = container.getRootNode();
    const { matchedRules, safeSheet } = collectStyleRules(cssTexts);
    shadow.adoptedStyleSheets = [safeSheet];
    await nextFrame();

    matchedRules.forEach(({ selector, declarations }) => {
      if (/::?(?:before|after)\b/i.test(selector)) return;
      let matches;
      try {
        matches = shadow.querySelectorAll(selector);
      } catch {
        return;
      }
      matches.forEach((element) => {
        if (element !== container && !container.contains(element)) return;
        const computed = global.getComputedStyle(element);
        declarations.forEach(({ name, priority }) => {
          const value = computed.getPropertyValue(name);
          if (safeStyleDeclaration(name, value)) {
            element.style.setProperty(name, value, priority);
          }
        });
      });
    });

    materializePseudoStyles(container, shadow, matchedRules);

    normalizeInlineStyles(container);
    if (format === "docx") {
      const pages = [
        ...container.querySelectorAll(":scope > .docx-wrapper > section.docx"),
      ];
      if (!pages.length) {
        throw new Error("The DOCX renderer did not produce document pages.");
      }
      core.applyPageMargins(
        { top: 0, right: 0, bottom: 0, left: 0 },
        false,
      );
      pages.forEach((page, index) => {
        page.dataset.editraImportedDocument = "docx";
        page.dataset.editraImportedPage = String(index + 1);
        page.style.width = "100%";
        page.style.maxWidth = "100%";
        page.style.margin = "0";
        page.style.background = "transparent";
        page.style.boxShadow = "none";
        page.style.isolation = "isolate";
      });
      const html = pages.map((page) => page.outerHTML).join("");
      core.security.assertSize(html, "DOCX rendered import");
      return String(core.sanitizeHTML(html, { kind: "docx import" }));
    }

    const wrapper = document.createElement("div");
    wrapper.dataset.editraImportedDocument = format;
    wrapper.style.position = "relative";
    wrapper.style.isolation = "isolate";
    wrapper.style.maxWidth = "100%";
    if (container.style.cssText) {
      [...container.style].forEach((property) => {
        wrapper.style.setProperty(
          property,
          container.style.getPropertyValue(property),
          container.style.getPropertyPriority(property),
        );
      });
    }
    wrapper.append(...container.childNodes);
    const html = wrapper.outerHTML;
    core.security.assertSize(html, `${format.toUpperCase()} rendered import`);
    return String(core.sanitizeHTML(html, { kind: `${format} import` }));
  }

  function createImportSandbox() {
    const host = document.createElement("div");
    host.dataset.editraUi = "true";
    Object.assign(host.style, {
      contain: "strict",
      left: "-100000px",
      position: "fixed",
      top: "0",
      visibility: "hidden",
      width: "1200px",
    });
    const shadow = host.attachShadow({ mode: "closed" });
    document.body.append(host);
    return { host, shadow };
  }

  async function styledHTMLToHTML(core, source) {
    const inspection = core.security.inspectHTMLImport(source);
    if (!inspection.safe) {
      throw new Error(
        `Unsafe HTML file blocked: ${inspection.violations.join("; ")}.`,
      );
    }
    const cssTexts = [...inspection.document.querySelectorAll("style")].map(
      (style) => style.textContent || "",
    );
    inspection.document.querySelectorAll("style").forEach((style) => style.remove());
    const cleanBody = String(
      core.sanitizeHTML(inspection.document.body.innerHTML, {
        kind: "HTML import body",
      }),
    );
    const { host, shadow } = createImportSandbox();
    const body = document.createElement("body");
    body.innerHTML = core.security.trustedHTML(cleanBody, "HTML import sandbox");
    core.security.restoreDeferredStyles(body);
    shadow.append(body);
    try {
      return await flattenRenderedDocument(core, body, cssTexts, "html");
    } finally {
      host.remove();
    }
  }

  function crc32(bytes) {
    let value = 0xffffffff;
    for (const byte of bytes) {
      value ^= byte;
      for (let bit = 0; bit < 8; bit += 1) {
        value = (value >>> 1) ^ (value & 1 ? 0xedb88320 : 0);
      }
    }
    return (value ^ 0xffffffff) >>> 0;
  }

  function normalizePackagePath(path) {
    const parts = [];
    String(path || "")
      .replace(/\\/g, "/")
      .split("/")
      .forEach((part) => {
        if (!part || part === ".") return;
        if (part === "..") {
          if (!parts.length) {
            throw new Error(
              "Unsafe DOCX file blocked: archive path traversal detected.",
            );
          }
          parts.pop();
        } else {
          parts.push(part);
        }
      });
    return parts.join("/");
  }

  function resolvePackagePath(partPath, target) {
    if (/^[a-z][a-z0-9+.-]*:/i.test(target)) return target;
    const base = partPath.split("/").slice(0, -1).join("/");
    return normalizePackagePath(`${base}/${String(target).replace(/^\//, "")}`);
  }

  function createDocxArchive(core, buffer) {
    const bytes = new Uint8Array(buffer);
    const view = new DataView(buffer);
    const maximumBytes =
      core.security.config.maxDocumentBytes +
      core.security.config.maxMediaBytes;
    if (bytes.length > maximumBytes) {
      throw new Error(
        `Unsafe DOCX file blocked: archive exceeds ${maximumBytes} bytes.`,
      );
    }

    let endOffset = -1;
    for (
      let offset = bytes.length - 22;
      offset >= Math.max(0, bytes.length - 65557);
      offset -= 1
    ) {
      if (view.getUint32(offset, true) === 0x06054b50) {
        endOffset = offset;
        break;
      }
    }
    if (endOffset < 0) throw new Error("Unsafe DOCX file blocked: invalid ZIP archive.");
    const entryCount = view.getUint16(endOffset + 10, true);
    if (!entryCount || entryCount > 2000) {
      throw new Error("Unsafe DOCX file blocked: invalid archive entry count.");
    }
    let offset = view.getUint32(endOffset + 16, true);
    const decoder = new TextDecoder();
    const entries = new Map();
    let expandedBytes = 0;

    for (let index = 0; index < entryCount; index += 1) {
      if (offset + 46 > bytes.length || view.getUint32(offset, true) !== 0x02014b50) {
        throw new Error("Unsafe DOCX file blocked: malformed ZIP directory.");
      }
      const flags = view.getUint16(offset + 8, true);
      const compression = view.getUint16(offset + 10, true);
      const checksum = view.getUint32(offset + 16, true);
      const compressedSize = view.getUint32(offset + 20, true);
      const uncompressedSize = view.getUint32(offset + 24, true);
      const nameLength = view.getUint16(offset + 28, true);
      const extraLength = view.getUint16(offset + 30, true);
      const commentLength = view.getUint16(offset + 32, true);
      const localOffset = view.getUint32(offset + 42, true);
      if (flags & 1 || ![0, 8].includes(compression)) {
        throw new Error(
          "Unsafe DOCX file blocked: encrypted or unsupported ZIP entry.",
        );
      }
      const nameEnd = offset + 46 + nameLength;
      if (nameEnd > bytes.length) {
        throw new Error("Unsafe DOCX file blocked: malformed ZIP entry name.");
      }
      const name = normalizePackagePath(
        decoder.decode(bytes.slice(offset + 46, nameEnd)),
      );
      if (
        /(?:^|\/)(?:activex|embeddings)(?:\/|$)|vbaProject\.bin$|\.(?:exe|dll|com|msi|scr)$/i.test(
          name,
        )
      ) {
        throw new Error(
          `Unsafe DOCX file blocked: active or embedded content (${name}).`,
        );
      }
      expandedBytes += uncompressedSize;
      if (expandedBytes > maximumBytes) {
        throw new Error(
          "Unsafe DOCX file blocked: expanded archive exceeds the configured limit.",
        );
      }
      entries.set(name, {
        checksum,
        compressedSize,
        compression,
        localOffset,
        name,
        uncompressedSize,
      });
      offset = nameEnd + extraLength + commentLength;
    }

    async function entryBytes(name) {
      const entry = entries.get(normalizePackagePath(name));
      if (!entry) return null;
      const local = entry.localOffset;
      if (
        local + 30 > bytes.length ||
        view.getUint32(local, true) !== 0x04034b50
      ) {
        throw new Error("Unsafe DOCX file blocked: malformed ZIP local entry.");
      }
      const nameLength = view.getUint16(local + 26, true);
      const extraLength = view.getUint16(local + 28, true);
      const start = local + 30 + nameLength + extraLength;
      const end = start + entry.compressedSize;
      if (end > bytes.length) {
        throw new Error("Unsafe DOCX file blocked: truncated ZIP entry.");
      }
      const compressed = bytes.slice(start, end);
      let result;
      if (entry.compression === 0) {
        result = compressed;
      } else {
        if (typeof DecompressionStream !== "function") {
          throw new Error("This browser cannot decompress DOCX content.");
        }
        const stream = new Blob([compressed])
          .stream()
          .pipeThrough(new DecompressionStream("deflate-raw"));
        result = new Uint8Array(await new Response(stream).arrayBuffer());
      }
      if (
        result.length !== entry.uncompressedSize ||
        crc32(result) !== entry.checksum
      ) {
        throw new Error("Unsafe DOCX file blocked: ZIP integrity check failed.");
      }
      return result;
    }

    return {
      entries,
      async dataURL(name) {
        const data = await entryBytes(name);
        if (!data) return null;
        const extension = name.split(".").at(-1).toLowerCase();
        const mime = {
          apng: "image/apng",
          avif: "image/avif",
          bmp: "image/bmp",
          gif: "image/gif",
          jpeg: "image/jpeg",
          jpg: "image/jpeg",
          png: "image/png",
          svg: "image/svg+xml",
          tif: "image/tiff",
          tiff: "image/tiff",
          webp: "image/webp",
        }[extension];
        if (!mime || mime === "image/svg+xml") return null;
        let binary = "";
        for (let start = 0; start < data.length; start += 0x8000) {
          binary += String.fromCharCode(...data.subarray(start, start + 0x8000));
        }
        return `data:${mime};base64,${global.btoa(binary)}`;
      },
      async text(name) {
        const data = await entryBytes(name);
        return data ? decoder.decode(data) : null;
      },
    };
  }

  function wordChildren(node, localName) {
    return [...(node?.children || [])].filter(
      (child) => child.localName === localName,
    );
  }

  function wordChild(node, localName) {
    return wordChildren(node, localName)[0] || null;
  }

  function wordDescendant(node, localName) {
    return [...(node?.getElementsByTagName("*") || [])].find(
      (child) => child.localName === localName,
    ) || null;
  }

  function wordValue(node, fallback = "") {
    return (
      node?.getAttribute("w:val") ??
      node?.getAttribute("val") ??
      fallback
    );
  }

  function wordOn(node) {
    if (!node) return false;
    return !/^(?:0|false|off|none)$/i.test(wordValue(node, "true"));
  }

  function twips(value) {
    const number = Number(value);
    return Number.isFinite(number) ? `${Math.round(number / 20 * 100) / 100}pt` : "";
  }

  function applyStyle(element, styles) {
    Object.entries(styles || {}).forEach(([property, value]) => {
      if (value !== "" && value !== null && value !== undefined) {
        element.style[property] = value;
      }
    });
    return element;
  }

  function runPropertyStyles(properties) {
    if (!properties) return {};
    const styles = {};
    const fonts = wordChild(properties, "rFonts");
    const font =
      fonts?.getAttribute("w:ascii") ||
      fonts?.getAttribute("ascii") ||
      fonts?.getAttribute("w:hAnsi") ||
      fonts?.getAttribute("hAnsi");
    if (font) styles.fontFamily = `"${font.replace(/["\\]/g, "")}"`;
    const size = Number(wordValue(wordChild(properties, "sz")));
    if (size > 0) styles.fontSize = `${size / 2}pt`;
    const color = wordValue(wordChild(properties, "color"));
    if (/^[0-9a-f]{6}$/i.test(color)) styles.color = `#${color}`;
    const highlight = wordValue(wordChild(properties, "highlight"));
    const shading = wordChild(properties, "shd");
    const fill =
      shading?.getAttribute("w:fill") || shading?.getAttribute("fill") || "";
    if (highlight && highlight !== "none") styles.backgroundColor = highlight;
    else if (/^[0-9a-f]{6}$/i.test(fill)) styles.backgroundColor = `#${fill}`;
    if (wordOn(wordChild(properties, "b"))) styles.fontWeight = "700";
    if (wordOn(wordChild(properties, "i"))) styles.fontStyle = "italic";
    const decorations = [];
    const underline = wordChild(properties, "u");
    if (underline && wordValue(underline, "single") !== "none") {
      decorations.push("underline");
    }
    if (wordOn(wordChild(properties, "strike"))) decorations.push("line-through");
    if (decorations.length) styles.textDecoration = decorations.join(" ");
    const vertical = wordValue(wordChild(properties, "vertAlign"));
    if (vertical === "superscript") {
      styles.verticalAlign = "super";
      styles.fontSize ||= "0.75em";
    } else if (vertical === "subscript") {
      styles.verticalAlign = "sub";
      styles.fontSize ||= "0.75em";
    }
    if (wordOn(wordChild(properties, "caps"))) styles.textTransform = "uppercase";
    if (wordOn(wordChild(properties, "smallCaps"))) {
      styles.fontVariant = "small-caps";
    }
    if (wordOn(wordChild(properties, "rtl"))) styles.direction = "rtl";
    const characterSpacing = Number(wordValue(wordChild(properties, "spacing")));
    if (Number.isFinite(characterSpacing) && characterSpacing !== 0) {
      styles.letterSpacing = twips(characterSpacing);
    }
    const position = Number(wordValue(wordChild(properties, "position")));
    if (Number.isFinite(position) && position !== 0) {
      styles.position = "relative";
      styles.top = `${-position / 2}pt`;
    }
    return styles;
  }

  function mergeWordStyles(base, extra) {
    return { ...(base || {}), ...(extra || {}) };
  }

  function parseWordStyles(xml) {
    const definitions = new Map();
    const documentDefaults = wordChild(
      wordChild(xml?.documentElement, "docDefaults"),
      "pPrDefault",
    );
    const runDefaults = wordChild(
      wordChild(xml?.documentElement, "docDefaults"),
      "rPrDefault",
    );
    const defaults = {
      paragraph: mergeWordStyles(
        { lineHeight: "normal", marginBottom: "0", marginTop: "0" },
        paragraphPropertyStyles(wordChild(documentDefaults, "pPr")),
      ),
      run: runPropertyStyles(wordChild(runDefaults, "rPr")),
    };
    if (!xml) {
      definitions.defaults = defaults;
      definitions.defaultParagraphId = "";
      return definitions;
    }
    let defaultParagraphId = "";
    [...xml.getElementsByTagName("*")]
      .filter((node) => node.localName === "style")
      .forEach((node) => {
        const id =
          node.getAttribute("w:styleId") || node.getAttribute("styleId");
        if (!id) return;
        const type = node.getAttribute("w:type") || node.getAttribute("type") || "";
        if (
          type === "paragraph" &&
          /^(?:1|true|on)$/i.test(
            node.getAttribute("w:default") || node.getAttribute("default") || "",
          )
        ) {
          defaultParagraphId = id;
        }
        definitions.set(id, {
          basedOn: wordValue(wordChild(node, "basedOn")),
          name: wordValue(wordChild(node, "name"), id),
          paragraph: paragraphPropertyStyles(wordChild(node, "pPr")),
          run: runPropertyStyles(wordChild(node, "rPr")),
          type,
        });
      });
    const resolved = new Map();
    function resolve(id, seen = new Set()) {
      if (!id || resolved.has(id)) return resolved.get(id) || {};
      if (seen.has(id)) return {};
      seen.add(id);
      const definition = definitions.get(id);
      if (!definition) return {};
      const parent = definition.basedOn
        ? resolve(definition.basedOn, seen)
        : defaults;
      const result = {
        name: definition.name,
        paragraph: mergeWordStyles(parent.paragraph, definition.paragraph),
        run: mergeWordStyles(parent.run, definition.run),
        type: definition.type,
      };
      resolved.set(id, result);
      return result;
    }
    definitions.forEach((value, id) => resolve(id));
    resolved.defaults = defaults;
    resolved.defaultParagraphId = defaultParagraphId;
    return resolved;
  }

  function paragraphPropertyStyles(properties) {
    if (!properties) return {};
    const styles = {};
    const alignment = wordValue(wordChild(properties, "jc"));
    if (alignment) {
      styles.textAlign = {
        both: "justify",
        center: "center",
        distribute: "justify",
        end: "end",
        left: "left",
        right: "right",
        start: "start",
      }[alignment] || alignment;
    }
    const spacing = wordChild(properties, "spacing");
    const before =
      spacing?.getAttribute("w:before") || spacing?.getAttribute("before");
    const after =
      spacing?.getAttribute("w:after") || spacing?.getAttribute("after");
    if (before !== null && before !== undefined) styles.marginTop = twips(before);
    if (after !== null && after !== undefined) styles.marginBottom = twips(after);
    const line = Number(
      spacing?.getAttribute("w:line") || spacing?.getAttribute("line"),
    );
    const lineRule =
      spacing?.getAttribute("w:lineRule") || spacing?.getAttribute("lineRule");
    if (line > 0) {
      styles.lineHeight = lineRule === "auto" || !lineRule
        ? String(Math.round(line / 240 * 1000) / 1000)
        : twips(line);
    }
    const indentation = wordChild(properties, "ind");
    const left =
      indentation?.getAttribute("w:left") || indentation?.getAttribute("left");
    const right =
      indentation?.getAttribute("w:right") || indentation?.getAttribute("right");
    const firstLine =
      indentation?.getAttribute("w:firstLine") ||
      indentation?.getAttribute("firstLine");
    const hanging =
      indentation?.getAttribute("w:hanging") ||
      indentation?.getAttribute("hanging");
    if (left !== null && left !== undefined) styles.marginLeft = twips(left);
    if (right !== null && right !== undefined) styles.marginRight = twips(right);
    if (firstLine !== null && firstLine !== undefined) {
      styles.textIndent = twips(firstLine);
    } else if (hanging !== null && hanging !== undefined) {
      styles.textIndent = `-${twips(hanging)}`;
    }
    const shading = wordChild(properties, "shd");
    const fill =
      shading?.getAttribute("w:fill") || shading?.getAttribute("fill") || "";
    if (/^[0-9a-f]{6}$/i.test(fill)) styles.backgroundColor = `#${fill}`;
    if (wordOn(wordChild(properties, "bidi"))) styles.direction = "rtl";
    return styles;
  }

  function parseNumbering(xml) {
    const abstracts = new Map();
    const numbers = new Map();
    if (!xml) return { abstracts, numbers };
    [...xml.getElementsByTagName("*")]
      .filter((node) => node.localName === "abstractNum")
      .forEach((abstract) => {
        const id =
          abstract.getAttribute("w:abstractNumId") ||
          abstract.getAttribute("abstractNumId");
        const levels = new Map();
        wordChildren(abstract, "lvl").forEach((level) => {
          const index = Number(
            level.getAttribute("w:ilvl") || level.getAttribute("ilvl") || 0,
          );
          levels.set(index, {
            format: wordValue(wordChild(level, "numFmt"), "decimal"),
            start: Number(wordValue(wordChild(level, "start"), "1")) || 1,
            suffix: wordValue(wordChild(level, "suff"), "tab"),
            text: wordValue(wordChild(level, "lvlText"), `%${index + 1}.`),
            paragraph: paragraphPropertyStyles(wordChild(level, "pPr")),
            run: runPropertyStyles(wordChild(level, "rPr")),
          });
        });
        abstracts.set(id, levels);
      });
    [...xml.getElementsByTagName("*")]
      .filter((node) => node.localName === "num")
      .forEach((number) => {
        const id = number.getAttribute("w:numId") || number.getAttribute("numId");
        numbers.set(id, wordValue(wordChild(number, "abstractNumId")));
      });
    return { abstracts, numbers };
  }

  async function parseRelationships(core, archive, partPath) {
    const pieces = partPath.split("/");
    const file = pieces.pop();
    const relationshipPath = [...pieces, "_rels", `${file}.rels`].join("/");
    const source = await archive.text(relationshipPath);
    const relationships = new Map();
    if (!source) return relationships;
    const xml = core.security.parseXML(source);
    for (const node of xml.getElementsByTagName("Relationship")) {
      const id = node.getAttribute("Id");
      const target = node.getAttribute("Target") || "";
      const type = node.getAttribute("Type") || "";
      const external = node.getAttribute("TargetMode") === "External";
      if (external && (!/\/hyperlink$/i.test(type) || !core.security.isSafeUrl(target))) {
        throw new Error(
          "Unsafe DOCX file blocked: external package relationship detected.",
        );
      }
      relationships.set(id, {
        external,
        target: external ? target : resolvePackagePath(partPath, target),
        type,
      });
    }
    return relationships;
  }

  function imageDimensions(node) {
    const extent = wordDescendant(node, "extent");
    const width = Number(extent?.getAttribute("cx"));
    const height = Number(extent?.getAttribute("cy"));
    return {
      height: height > 0 ? Math.round(height / 914400 * 96) : null,
      width: width > 0 ? Math.round(width / 914400 * 96) : null,
    };
  }

  async function renderWordRun(context, run, inheritedStyle = {}, tabState = null) {
    const output = [];
    const properties = wordChild(run, "rPr");
    const styleId = wordValue(wordChild(properties, "rStyle"));
    const style = mergeWordStyles(
      mergeWordStyles(
        mergeWordStyles(context.styles.defaults?.run, inheritedStyle),
        context.styles.get(styleId)?.run,
      ),
      runPropertyStyles(properties),
    );
    let wrapper = document.createElement("span");
    applyStyle(wrapper, style);

    async function flush() {
      if (!wrapper.childNodes.length) return;
      output.push(wrapper);
      wrapper = document.createElement("span");
      applyStyle(wrapper, style);
    }

    for (const child of run.children) {
      if (["t", "delText"].includes(child.localName)) {
        const text = child.textContent || "";
        if (
          child.getAttribute("xml:space") === "preserve" &&
          /\s/.test(text)
        ) {
          const preserved = document.createElement("span");
          preserved.style.whiteSpace = "pre-wrap";
          preserved.textContent = text;
          wrapper.append(preserved);
        } else {
          wrapper.append(text);
        }
      } else if (child.localName === "tab") {
        const tab = document.createElement("span");
        tab.className = "editra-tab";
        tab.dataset.editraWordTab = "true";
        if (tabState?.stops?.length) {
          tab.dataset.editraWordTabStops = tabState.stops
            .map((stop) => `${stop.position}:${stop.alignment}`)
            .join(",");
        }
        tab.textContent = "";
        wrapper.append(tab);
      } else if (child.localName === "br") {
        const type =
          child.getAttribute("w:type") ||
          child.getAttribute("type") ||
          "textWrapping";
        if (type === "page") {
          await flush();
          output.push({ pageBreak: true });
        } else {
          wrapper.append(document.createElement("br"));
        }
      } else if (child.localName === "lastRenderedPageBreak") {
        await flush();
        output.push({ pageBreak: true, saved: true });
      } else if (child.localName === "noBreakHyphen") {
        wrapper.append("‑");
      } else if (child.localName === "softHyphen") {
        wrapper.append("\u00ad");
      } else if (child.localName === "sym") {
        const hexadecimal =
          child.getAttribute("w:char") || child.getAttribute("char");
        if (/^[0-9a-f]{4,6}$/i.test(hexadecimal || "")) {
          wrapper.append(String.fromCodePoint(parseInt(hexadecimal, 16)));
        }
      } else if (["drawing", "pict", "object"].includes(child.localName)) {
        const imageNode =
          wordDescendant(child, "blip") || wordDescendant(child, "imagedata");
        const relationshipId =
          imageNode?.getAttribute("r:embed") ||
          imageNode?.getAttribute("embed") ||
          imageNode?.getAttribute("r:id") ||
          imageNode?.getAttribute("id");
        const relationship = context.relationships.get(relationshipId);
        if (relationship && !relationship.external) {
          const source = await context.archive.dataURL(relationship.target);
          if (source) {
            const image = document.createElement("img");
            image.src = source;
            image.alt = "";
            const dimensions = imageDimensions(child);
            if (dimensions.width) image.width = dimensions.width;
            if (dimensions.height) image.height = dimensions.height;
            image.style.maxWidth = "100%";
            wrapper.append(image);
          }
        }
      } else if (child.localName === "instrText") {
        const instruction = (child.textContent || "").trim().toUpperCase();
        if (/^PAGE\b/.test(instruction)) wrapper.append("{{page}}");
        else if (/^NUMPAGES\b/.test(instruction)) wrapper.append("{{pages}}");
      }
    }
    await flush();
    return output;
  }

  function numberingMarker(context, properties) {
    const numberProperties = wordChild(properties, "numPr");
    if (!numberProperties) return null;
    const numberId = wordValue(wordChild(numberProperties, "numId"));
    const levelIndex = Number(wordValue(wordChild(numberProperties, "ilvl"), "0"));
    const abstractId = context.numbering.numbers.get(numberId);
    const levels = context.numbering.abstracts.get(abstractId);
    const level = levels?.get(levelIndex);
    if (!level) return null;
    const counters = context.counters.get(numberId) || [];
    counters[levelIndex] = (counters[levelIndex] || level.start - 1) + 1;
    counters.length = levelIndex + 1;
    context.counters.set(numberId, counters);
    let label = level.text;
    levels.forEach((definition, index) => {
      label = label.replaceAll(
        `%${index + 1}`,
        formatCounter(counters[index] || definition.start, definition.format),
      );
    });
    if (level.format === "bullet") label = level.text;
    label += level.suffix === "space" ? " " : level.suffix === "nothing" ? "" : "\t";
    return { label, level };
  }

  async function renderWordParagraph(context, paragraph) {
    const properties = wordChild(paragraph, "pPr");
    const styleId = wordValue(wordChild(properties, "pStyle"));
    const effectiveStyleId = styleId || context.styles.defaultParagraphId;
    const styleDefinition = context.styles.get(effectiveStyleId) || {
      paragraph: context.styles.defaults?.paragraph,
      run: context.styles.defaults?.run,
    };
    const headingMatch = String(styleDefinition.name || styleId).match(
      /^Heading\s*([1-6])$/i,
    );
    const tag = headingMatch ? `h${headingMatch[1]}` : "p";
    let current = document.createElement(tag);
    const marker = numberingMarker(context, properties);
    const paragraphStyle = mergeWordStyles(
      styleDefinition.paragraph,
      paragraphPropertyStyles(properties),
    );
    const paragraphRunStyle = mergeWordStyles(
      styleDefinition.run,
      runPropertyStyles(wordChild(properties, "rPr")),
    );
    if (marker) Object.assign(paragraphStyle, marker.level.paragraph);
    const tabs = wordChildren(wordChild(properties, "tabs"), "tab")
      .map((tab) => ({
        alignment: wordValue(tab, "left"),
        position: Number(
          tab.getAttribute("w:pos") || tab.getAttribute("pos") || 0,
        ),
      }))
      .filter((tab) => tab.position > 0 && tab.alignment !== "clear")
      .sort((left, right) => left.position - right.position);
    const tabState = { stops: tabs };
    function styleParagraph(element) {
      applyStyle(element, mergeWordStyles(paragraphStyle, paragraphRunStyle));
      applyWordBorders(element, properties, "pBdr");
      return element;
    }
    styleParagraph(current);
    if (wordChild(properties, "keepNext")) {
      current.dataset.editraKeepWithNext = "true";
    }
    if (wordChild(properties, "pageBreakBefore")) {
      current.dataset.editraPageBreakBefore = "true";
    }
    const output = [];
    function finish(pageBreak = false) {
      if (!current.childNodes.length) current.append(document.createElement("br"));
      output.push({ element: current, pageBreak });
      current = document.createElement(tag);
      styleParagraph(current);
    }
    if (marker) {
      const markerElement = document.createElement("span");
      markerElement.dataset.editraImportMarker = "true";
      markerElement.setAttribute("contenteditable", "false");
      markerElement.style.whiteSpace = "pre";
      applyStyle(markerElement, marker.level.run);
      markerElement.textContent = marker.label;
      current.append(markerElement);
    }

    async function renderContainer(container, link = null) {
      for (const child of container.children) {
        if (child.localName === "r") {
          const pieces = await renderWordRun(
            context,
            child,
            paragraphRunStyle,
            tabState,
          );
          for (const piece of pieces) {
            if (piece.pageBreak) finish(true);
            else if (link) link.append(piece);
            else current.append(piece);
          }
        } else if (child.localName === "hyperlink") {
          const relationshipId =
            child.getAttribute("r:id") || child.getAttribute("id");
          const relationship = context.relationships.get(relationshipId);
          const anchor = document.createElement("a");
          if (relationship?.external) anchor.href = relationship.target;
          const bookmark =
            child.getAttribute("w:anchor") || child.getAttribute("anchor");
          if (bookmark) anchor.href = `#${bookmark}`;
          await renderContainer(child, anchor);
          if (anchor.childNodes.length) current.append(anchor);
        } else if (child.localName === "ins") {
          await renderContainer(child, link);
        }
      }
    }
    await renderContainer(paragraph);
    if (current.childNodes.length || !output.length) finish(false);
    return output;
  }

  function applyWordBorders(element, properties, borderName) {
    const borders = wordChild(properties, borderName);
    if (!borders) return;
    ["top", "right", "bottom", "left", "insideH", "insideV"].forEach(
      (side) => {
        const border = wordChild(borders, side);
        if (!border || wordValue(border, "nil") === "nil") return;
        const size = Number(
          border.getAttribute("w:sz") || border.getAttribute("sz") || 8,
        );
        const color =
          border.getAttribute("w:color") || border.getAttribute("color") || "000000";
        const cssColor = /^[0-9a-f]{6}$/i.test(color)
          ? `#${color}`
          : color === "auto"
            ? "#000000"
            : color;
        const cssSide = side.startsWith("inside") ? "" : side;
        if (cssSide) {
          element.style[`border${cssSide[0].toUpperCase()}${cssSide.slice(1)}`] =
            `${Math.max(1, size / 8)}px solid ${cssColor}`;
        }
      },
    );
  }

  async function renderWordTable(context, tableNode) {
    const table = document.createElement("table");
    table.style.borderCollapse = "collapse";
    table.style.maxWidth = "100%";
    const properties = wordChild(tableNode, "tblPr");
    applyWordBorders(table, properties, "tblBorders");
    const gridColumns = wordChildren(wordChild(tableNode, "tblGrid"), "gridCol")
      .map((column) =>
        Number(column.getAttribute("w:w") || column.getAttribute("w") || 0),
      )
      .filter((width) => width > 0);
    if (gridColumns.length) {
      const columnGroup = document.createElement("colgroup");
      gridColumns.forEach((width) => {
        const column = document.createElement("col");
        column.style.width = twips(width);
        columnGroup.append(column);
      });
      table.append(columnGroup);
    }
    const widthNode = wordChild(properties, "tblW");
    const width = Number(
      widthNode?.getAttribute("w:w") || widthNode?.getAttribute("w") || 0,
    );
    const widthType =
      widthNode?.getAttribute("w:type") || widthNode?.getAttribute("type");
    if (width > 0) {
      table.style.width = widthType === "pct" ? `${width / 50}%` : twips(width);
    } else if (gridColumns.length) {
      table.style.width = twips(
        gridColumns.reduce((total, columnWidth) => total + columnWidth, 0),
      );
    }
    const layoutNode = wordChild(properties, "tblLayout");
    const tableLayout =
      layoutNode?.getAttribute("w:type") ||
      layoutNode?.getAttribute("type") ||
      wordValue(layoutNode);
    if (tableLayout === "fixed") {
      table.style.tableLayout = "fixed";
    }
    const tableIndent = Number(
      wordChild(properties, "tblInd")?.getAttribute("w:w") ||
        wordChild(properties, "tblInd")?.getAttribute("w") ||
        0,
    );
    if (tableIndent) table.style.marginLeft = twips(tableIndent);
    const alignment = wordValue(wordChild(properties, "jc"));
    if (alignment === "center") table.style.marginInline = "auto";
    else if (alignment === "right" || alignment === "end") {
      table.style.marginLeft = "auto";
    }
    const body = table.createTBody();
    for (const rowNode of wordChildren(tableNode, "tr")) {
      const row = body.insertRow();
      const rowProperties = wordChild(rowNode, "trPr");
      const rowHeight = Number(wordValue(wordChild(rowProperties, "trHeight")));
      if (rowHeight > 0) row.style.height = twips(rowHeight);
      for (const cellNode of wordChildren(rowNode, "tc")) {
        const cell = row.insertCell();
        const cellProperties = wordChild(cellNode, "tcPr");
        const span = Number(wordValue(wordChild(cellProperties, "gridSpan"), "1"));
        if (span > 1) cell.colSpan = span;
        const cellWidth = wordChild(cellProperties, "tcW");
        const cellWidthValue = Number(
          cellWidth?.getAttribute("w:w") || cellWidth?.getAttribute("w") || 0,
        );
        if (cellWidthValue > 0) cell.style.width = twips(cellWidthValue);
        const shading = wordChild(cellProperties, "shd");
        const fill =
          shading?.getAttribute("w:fill") || shading?.getAttribute("fill") || "";
        if (/^[0-9a-f]{6}$/i.test(fill)) cell.style.backgroundColor = `#${fill}`;
        const vertical = wordValue(wordChild(cellProperties, "vAlign"));
        if (vertical) cell.style.verticalAlign = vertical;
        applyWordBorders(cell, cellProperties, "tcBorders");
        const margin =
          wordChild(cellProperties, "tcMar") || wordChild(properties, "tblCellMar");
        ["top", "right", "bottom", "left"].forEach((side) => {
          const item = wordChild(margin, side);
          const value = Number(
            item?.getAttribute("w:w") || item?.getAttribute("w") || 0,
          );
          if (value > 0) cell.style[`padding${side[0].toUpperCase()}${side.slice(1)}`] = twips(value);
        });
        for (const child of cellNode.children) {
          if (child.localName === "p") {
            const paragraphs = await renderWordParagraph(context, child);
            paragraphs.forEach(({ element }) => cell.append(element));
          } else if (child.localName === "tbl") {
            cell.append(await renderWordTable(context, child));
          }
        }
        if (!cell.childNodes.length) cell.append(document.createElement("br"));
      }
    }
    return table;
  }

  function layoutWordTabs(root) {
    root
      .querySelectorAll?.('[data-editra-word-tab="true"]')
      .forEach((tab) => {
        const paragraph = tab.closest("p,h1,h2,h3,h4,h5,h6");
        if (!paragraph) return;
        tab.style.width = "1px";
        const paragraphLeft = paragraph.getBoundingClientRect().left;
        const current = Math.max(
          0,
          tab.getBoundingClientRect().left - paragraphLeft,
        );
        const stops = String(tab.dataset.editraWordTabStops || "")
          .split(",")
          .map((entry) => {
            const [position, alignment = "left"] = entry.split(":");
            return {
              alignment,
              pixels: Number(position) / 1440 * 96,
            };
          })
          .filter((stop) => stop.pixels > current + 0.5);
        const defaultStop = 720 / 1440 * 96;
        const target = stops[0]?.pixels ||
          (Math.floor(current / defaultStop) + 1) * defaultStop;
        tab.dataset.editraTabStop = String(Math.round(target * 100) / 100);
        tab.dataset.editraTabAlignment = stops[0]?.alignment || "left";
        tab.style.width = `${Math.max(1, target - current)}px`;
        tab.style.minWidth = "1px";
      });
  }

  function sectionLayout(properties) {
    const pageSize = wordChild(properties, "pgSz");
    let width = Number(
      pageSize?.getAttribute("w:w") || pageSize?.getAttribute("w") || 12240,
    );
    let height = Number(
      pageSize?.getAttribute("w:h") || pageSize?.getAttribute("h") || 15840,
    );
    const orientation =
      pageSize?.getAttribute("w:orient") || pageSize?.getAttribute("orient") || "portrait";
    if (orientation === "landscape" && width < height) [width, height] = [height, width];
    const margins = wordChild(properties, "pgMar");
    const margin = (name, fallback) =>
      Number(
        margins?.getAttribute(`w:${name}`) ||
          margins?.getAttribute(name) ||
          fallback,
      );
    return {
      footer: margin("footer", 720),
      header: margin("header", 720),
      height,
      marginBottom: margin("bottom", 1440),
      marginLeft: margin("left", 1440),
      marginRight: margin("right", 1440),
      marginTop: margin("top", 1440),
      orientation,
      width,
    };
  }

  async function renderRelatedPart(context, relationshipId) {
    const relationship = context.relationships.get(relationshipId);
    if (!relationship || relationship.external) return null;
    const source = await context.archive.text(relationship.target);
    if (!source) return null;
    const xml = context.core.security.parseXML(source);
    const partRelationships = await parseRelationships(
      context.core,
      context.archive,
      relationship.target,
    );
    const partContext = { ...context, relationships: partRelationships };
    const container = document.createElement("div");
    const root = xml.documentElement;
    for (const child of root.children) {
      if (child.localName === "p") {
        const paragraphs = await renderWordParagraph(partContext, child);
        paragraphs.forEach(({ element }) => container.append(element));
      } else if (child.localName === "tbl") {
        container.append(await renderWordTable(partContext, child));
      }
    }
    return container.innerHTML;
  }

  async function measureWordPages(blocks, layout) {
    const contentHeight = Math.max(
      1,
      (layout.height - layout.marginTop - layout.marginBottom) / 1440 * 96,
    );
    const contentWidth = Math.max(
      1,
      (layout.width - layout.marginLeft - layout.marginRight) / 1440 * 96,
    );
    const host = document.createElement("div");
    Object.assign(host.style, {
      boxSizing: "border-box",
      contain: "layout style",
      left: "-100000px",
      position: "fixed",
      top: "0",
      visibility: "hidden",
      width: `${contentWidth}px`,
    });
    document.body.append(host);
    const pages = [[]];
    try {
      for (const block of blocks) {
        if (block.breakBefore && pages.at(-1).length) {
          pages.push([]);
          host.replaceChildren();
        }
        host.append(block.element);
        layoutWordTabs(block.element);
        if (host.scrollHeight > contentHeight && pages.at(-1).length) {
          block.element.remove();
          pages.push([]);
          host.replaceChildren(block.element);
          layoutWordTabs(block.element);
        }
        pages.at(-1).push(block.element);
        if (block.pageBreak) {
          pages.push([]);
          host.replaceChildren();
        }
      }
    } finally {
      host.remove();
    }
    if (!pages.at(-1).length && pages.length > 1) pages.pop();
    return pages;
  }

  async function renderDocxToHTML(core, buffer) {
    const archive = createDocxArchive(core, buffer);
    const documentSource = await archive.text("word/document.xml");
    if (!documentSource) {
      throw new Error("Unsafe DOCX file blocked: word/document.xml is missing.");
    }
    const documentXML = core.security.parseXML(documentSource);
    if (documentXML.querySelector("parsererror")) {
      throw new Error("Unsafe DOCX file blocked: malformed WordprocessingML.");
    }
    const relationships = await parseRelationships(
      core,
      archive,
      "word/document.xml",
    );
    const stylesRelationship = [...relationships.values()].find((item) =>
      /\/styles$/i.test(item.type),
    );
    const numberingRelationship = [...relationships.values()].find((item) =>
      /\/numbering$/i.test(item.type),
    );
    const stylesSource = stylesRelationship
      ? await archive.text(stylesRelationship.target)
      : null;
    const numberingSource = numberingRelationship
      ? await archive.text(numberingRelationship.target)
      : null;
    const context = {
      archive,
      core,
      counters: new Map(),
      numbering: parseNumbering(
        numberingSource ? core.security.parseXML(numberingSource) : null,
      ),
      relationships,
      styles: parseWordStyles(
        stylesSource ? core.security.parseXML(stylesSource) : null,
      ),
    };
    const body = [...documentXML.getElementsByTagName("*")].find(
      (node) => node.localName === "body",
    );
    if (!body) throw new Error("Unsafe DOCX file blocked: document body is missing.");
    const finalSectionProperties = wordChild(body, "sectPr");
    const sectionSources = [];
    let sectionBlocks = [];
    for (const child of body.children) {
      if (child.localName === "sectPr") continue;
      sectionBlocks.push(child);
      const paragraphSection =
        child.localName === "p"
          ? wordChild(wordChild(child, "pPr"), "sectPr")
          : null;
      if (paragraphSection) {
        sectionSources.push({ blocks: sectionBlocks, properties: paragraphSection });
        sectionBlocks = [];
      }
    }
    if (sectionBlocks.length || !sectionSources.length) {
      sectionSources.push({
        blocks: sectionBlocks,
        properties: finalSectionProperties,
      });
    }

    const pages = [];
    for (const sectionSource of sectionSources) {
      const layout = sectionLayout(sectionSource.properties);
      const blocks = [];
      for (const node of sectionSource.blocks) {
        if (node.localName === "p") {
          const paragraphs = await renderWordParagraph(context, node);
          paragraphs.forEach(({ element, pageBreak }) => {
            blocks.push({
              breakBefore: element.dataset.editraPageBreakBefore === "true",
              element,
              pageBreak,
            });
            delete element.dataset.editraPageBreakBefore;
          });
        } else if (node.localName === "tbl") {
          blocks.push({ element: await renderWordTable(context, node) });
        }
      }
      const measuredPages = await measureWordPages(blocks, layout);
      const headerReference = wordChildren(sectionSource.properties, "headerReference")[0];
      const footerReference = wordChildren(sectionSource.properties, "footerReference")[0];
      const headerId =
        headerReference?.getAttribute("r:id") || headerReference?.getAttribute("id");
      const footerId =
        footerReference?.getAttribute("r:id") || footerReference?.getAttribute("id");
      const header = await renderRelatedPart(context, headerId);
      const footer = await renderRelatedPart(context, footerId);
      measuredPages.forEach((pageBlocks) => {
        pages.push({ footer, header, layout, nodes: pageBlocks });
      });
    }

    core.applyPageMargins({ top: 0, right: 0, bottom: 0, left: 0 }, false);
    const html = pages
      .map((page, index) => {
        const section = document.createElement("section");
        section.dataset.editraImportedDocument = "docx";
        section.dataset.editraImportedPage = String(index + 1);
        section.dataset.editraPageOrientation = page.layout.orientation;
        Object.assign(section.style, {
          background: "#fff",
          boxSizing: "border-box",
          color: "#000",
          isolation: "isolate",
          margin: "0 auto",
          minHeight: twips(page.layout.height),
          overflow: "hidden",
          paddingBottom: twips(page.layout.marginBottom),
          paddingLeft: twips(page.layout.marginLeft),
          paddingRight: twips(page.layout.marginRight),
          paddingTop: twips(page.layout.marginTop),
          position: "relative",
          width: twips(page.layout.width),
        });
        if (page.header) {
          const header = document.createElement("header");
          header.dataset.editraImportedHeader = "true";
          header.style.position = "absolute";
          header.style.top = twips(page.layout.header);
          header.style.left = twips(page.layout.marginLeft);
          header.style.right = twips(page.layout.marginRight);
          header.innerHTML = core.security.trustedHTML(page.header, "DOCX header");
          core.security.restoreDeferredStyles(header);
          section.append(header);
        }
        const article = document.createElement("article");
        article.dataset.editraImportedBody = "true";
        article.append(...page.nodes);
        section.append(article);
        if (page.footer) {
          const footer = document.createElement("footer");
          footer.dataset.editraImportedFooter = "true";
          footer.style.position = "absolute";
          footer.style.bottom = twips(page.layout.footer);
          footer.style.left = twips(page.layout.marginLeft);
          footer.style.right = twips(page.layout.marginRight);
          footer.innerHTML = core.security.trustedHTML(page.footer, "DOCX footer");
          core.security.restoreDeferredStyles(footer);
          section.append(footer);
        }
        return section.outerHTML;
      })
      .join("");
    core.security.assertSize(html, "DOCX rendered import");
    return String(core.sanitizeHTML(html, { kind: "DOCX import" }));
  }

  async function importHTML(core, options = {}) {
    const file = options.file ?? (await pickFile(core, ".html,.htm"));
    if (!file) return false;
    const html = await readFile(file, "readAsText");
    core.setHTML(await styledHTMLToHTML(core, html));
    return true;
  }

  async function importWord(core, options = {}) {
    const file = options.file ?? (await pickFile(core, ".doc,.docx,.html"));
    if (!file) return false;
    if (/\.html?$/i.test(file.name)) {
      const content = await readFile(file, "readAsText");
      core.setHTML(await styledHTMLToHTML(core, content));
      return true;
    }

    const bytes = await readFile(file, "readAsArrayBuffer");
    const signature = new Uint8Array(bytes, 0, Math.min(8, bytes.byteLength));
    const legacyBinaryWord =
      signature.length === 8 &&
      [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1].every(
        (value, index) => signature[index] === value,
      );
    if (legacyBinaryWord) {
      throw new Error(
        "Legacy binary .doc files are not supported. Save the document as .docx and try again.",
      );
    }
    if (/\.doc$/i.test(file.name)) {
      const legacyHTML = new TextDecoder().decode(new Uint8Array(bytes));
      if (!/<(?:!doctype|html|head|body|div|p|table)\b/i.test(legacyHTML)) {
        throw new Error(
          "Legacy binary .doc files are not supported. Save the document as .docx and try again.",
        );
      }
      core.setHTML(
        await styledHTMLToHTML(core, legacyHTML),
      );
      return true;
    }
    try {
      core.setHTML(await renderDocxToHTML(core, bytes));
      return true;
    } catch (error) {
      core.dispatchCommand("importWordData", {
        file,
        bytes,
        error,
      });
      throw error;
    }
  }

  async function productivityStressTest(core, options = {}) {
    const paragraphs = Math.max(1000, Number(options.paragraphs) || 10000);
    const container = document.createElement("div");
    container.innerHTML = core.security.trustedUIHTML(
      Array.from(
        { length: paragraphs },
        (_, index) =>
          `<p>Productivity stress sample ${index + 1}: Name and Date fields.</p>`,
      ).join(""),
      "productivity stress fixture",
    );
    const startedAt = performance.now();
    const matches = await collectMatches(container, "Name", {
      caseSensitive: true,
      wholeWord: true,
    });
    const htmlBytes = new Blob([container.innerHTML]).size;
    return {
      paragraphs,
      matches: matches.length,
      htmlBytes,
      searchMs: Math.round(performance.now() - startedAt),
    };
  }

  function install(core) {
    if (installations.has(core)) return installations.get(core);
    const state = {
      findOverlay: null,
      mergeOverlay: null,
      painter: null,
      painterListener: null,
      painterToast: null,
      preview: false,
      unregisterCommands: [],
    };
    const commands = {
      findReplace: (options = {}) =>
        options.replaceAll
          ? replaceAll(
              core,
              options.find,
              options.replace ?? "",
              options,
            )
          : openFindReplace(core, state, options),
      formatPainter: (options) => formatPainter(core, state, options),
      insertMergeField: (options = {}) =>
        options.field
          ? insertFieldNode(core, options.field)
          : openMergeField(core, state),
      previewMergeFields: (options) =>
        previewMergeFields(core, state, options),
      exportMarkdown: () => exportMarkdown(core),
      importWord: (options) => importWord(core, options),
      importHTML: (options) => importHTML(core, options),
      productivityStressTest: (options) =>
        productivityStressTest(core, options),
    };
    Object.entries(commands).forEach(([name, handler]) => {
      state.unregisterCommands.push(
        core.registerCommand(name, handler, {
          plugin: "productivity",
          source: "plugin",
        }),
      );
    });

    function handleEscape(event) {
      if (event.key === "Escape" && state.painter) clearPainter(core, state);
    }
    document.addEventListener("keydown", handleEscape);
    core.registerCleanup(() => {
      state.findOverlay?.dispatchEvent(new CustomEvent("editra:close"));
      state.mergeOverlay?.dispatchEvent(new CustomEvent("editra:close"));
      clearPainter(core, state);
      document.removeEventListener("keydown", handleEscape);
      state.unregisterCommands.forEach((unregister) => unregister());
      installations.delete(core);
    });

    installations.set(core, state);
    return state;
  }

  function ProductivityPlugin(core, options) {
    const state = install(core);
    return formatPainter(core, state, options);
  }

  ProductivityPlugin.install = install;
  ProductivityPlugin.hydrate = function hydrate(core) {
    install(core);
  };
  ProductivityPlugin.plugin = Object.freeze({
    name: "productivity",
    label: "Format Painter",
    icon: "formatPainter",
    command: "formatPainter",
  });

  global.ProductivityPlugin = ProductivityPlugin;
  (global.EditraPlugins ??= Object.create(null)).productivity =
    ProductivityPlugin;
})(window);
