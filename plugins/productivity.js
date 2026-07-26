/**
 * Product: Editra
 * Author: Editra Team
 * Version: 1.16.0
 * Purpose: Implements the Editra productivity plugin and its editor commands.
 * Licensing: MIT License (open source)
 */

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
    overlay.innerHTML = `
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
    `;
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

    state.painterListener = () => {
      requestAnimationFrame(() => {
        const applied = applyFormatPainter(core, state);
        if (!applied && state.painter) {
          core.editor.addEventListener("mouseup", state.painterListener, {
            once: true,
          });
        }
      });
    };
    core.editor.addEventListener("mouseup", state.painterListener, {
      once: true,
    });
    return true;
  }

  function clearPainter(core, state) {
    if (state.painterListener) {
      core.editor.removeEventListener("mouseup", state.painterListener);
    }
    state.painterListener = null;
    state.painterToast?.remove();
    state.painterToast = null;
    state.painter = null;
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
    overlay.innerHTML = `
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
    `;
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

  async function extractZipEntry(buffer, wantedName) {
    const view = new DataView(buffer);
    const bytes = new Uint8Array(buffer);
    let eocd = -1;
    for (
      let index = Math.max(0, bytes.length - 65557);
      index <= bytes.length - 22;
      index += 1
    ) {
      if (view.getUint32(index, true) === 0x06054b50) eocd = index;
    }
    if (eocd < 0) throw new Error("Invalid DOCX archive.");

    const entries = view.getUint16(eocd + 10, true);
    let offset = view.getUint32(eocd + 16, true);
    const decoder = new TextDecoder();

    for (let entry = 0; entry < entries; entry += 1) {
      if (view.getUint32(offset, true) !== 0x02014b50) break;
      const compression = view.getUint16(offset + 10, true);
      const compressedSize = view.getUint32(offset + 20, true);
      const nameLength = view.getUint16(offset + 28, true);
      const extraLength = view.getUint16(offset + 30, true);
      const commentLength = view.getUint16(offset + 32, true);
      const localOffset = view.getUint32(offset + 42, true);
      const name = decoder.decode(
        bytes.slice(offset + 46, offset + 46 + nameLength),
      );

      if (name === wantedName) {
        const localNameLength = view.getUint16(localOffset + 26, true);
        const localExtraLength = view.getUint16(localOffset + 28, true);
        const dataStart =
          localOffset + 30 + localNameLength + localExtraLength;
        const compressed = bytes.slice(
          dataStart,
          dataStart + compressedSize,
        );
        if (compression === 0) return compressed;
        if (compression !== 8 || typeof DecompressionStream !== "function") {
          throw new Error("This browser cannot decompress DOCX content.");
        }
        const stream = new Blob([compressed])
          .stream()
          .pipeThrough(new DecompressionStream("deflate-raw"));
        return new Uint8Array(await new Response(stream).arrayBuffer());
      }

      offset += 46 + nameLength + extraLength + commentLength;
    }
    throw new Error("DOCX document.xml was not found.");
  }

  function wordRunToFragment(run) {
    const fragment = document.createDocumentFragment();
    const properties = [...run.children].find(
      (child) => child.localName === "rPr",
    );
    let wrapper = document.createElement("span");
    [...run.children].forEach((child) => {
      if (child.localName === "t") wrapper.append(child.textContent);
      else if (child.localName === "tab") wrapper.append("\t");
      else if (child.localName === "br") wrapper.append(document.createElement("br"));
    });
    if (!wrapper.childNodes.length) return fragment;

    if ([...properties?.children ?? []].some((item) => item.localName === "b")) {
      const strong = document.createElement("strong");
      strong.append(wrapper);
      wrapper = strong;
    }
    if ([...properties?.children ?? []].some((item) => item.localName === "i")) {
      const emphasis = document.createElement("em");
      emphasis.append(wrapper);
      wrapper = emphasis;
    }
    if (
      [...properties?.children ?? []].some(
        (item) => item.localName === "u",
      )
    ) {
      const underline = document.createElement("u");
      underline.append(wrapper);
      wrapper = underline;
    }
    fragment.append(wrapper);
    return fragment;
  }

  function wordParagraphToElement(paragraph) {
    const styleNode = [...paragraph.children]
      .find((child) => child.localName === "pPr")
      ?.querySelector('[val], [w\\:val]');
    const styleName =
      styleNode?.getAttribute("w:val") || styleNode?.getAttribute("val") || "";
    const headingMatch = styleName.match(/^Heading([1-6])$/i);
    const element = document.createElement(
      headingMatch ? `h${headingMatch[1]}` : "p",
    );
    paragraph
      .querySelectorAll("w\\:r, r")
      .forEach((run) => element.append(wordRunToFragment(run)));
    if (!element.childNodes.length) element.append(document.createElement("br"));
    return element;
  }

  function wordTableToElement(tableNode) {
    const table = document.createElement("table");
    const body = table.createTBody();
    [...tableNode.children]
      .filter((child) => child.localName === "tr")
      .forEach((rowNode) => {
        const row = body.insertRow();
        [...rowNode.children]
          .filter((child) => child.localName === "tc")
          .forEach((cellNode) => {
            const cell = row.insertCell();
            [...cellNode.children]
              .filter((child) => child.localName === "p")
              .forEach((paragraph) =>
                cell.append(wordParagraphToElement(paragraph)),
              );
            if (!cell.childNodes.length) cell.append(document.createElement("br"));
          });
      });
    return table;
  }

  async function docxToHTML(buffer) {
    const xmlBytes = await extractZipEntry(buffer, "word/document.xml");
    const xml = new DOMParser().parseFromString(
      new TextDecoder().decode(xmlBytes),
      "application/xml",
    );
    if (xml.querySelector("parsererror")) {
      throw new Error("Unable to parse DOCX XML.");
    }
    const body = [...xml.getElementsByTagName("*")].find(
      (node) => node.localName === "body",
    );
    if (!body) throw new Error("DOCX body was not found.");

    const container = document.createElement("div");
    const children = [...body.children];
    for (let start = 0; start < children.length; start += 100) {
      children.slice(start, start + 100).forEach((child) => {
        if (child.localName === "p") {
          container.append(wordParagraphToElement(child));
        } else if (child.localName === "tbl") {
          container.append(wordTableToElement(child));
        }
      });
      if (start + 100 < children.length) await nextFrame();
    }
    return container.innerHTML;
  }

  async function importHTML(core, options = {}) {
    const file = options.file ?? (await pickFile(core, ".html,.htm"));
    if (!file) return false;
    const html = await readFile(file, "readAsText");
    core.setHTML(html);
    return true;
  }

  async function importWord(core, options = {}) {
    const file = options.file ?? (await pickFile(core, ".doc,.docx,.html"));
    if (!file) return false;
    if (/\.html?$/i.test(file.name) || /\.doc$/i.test(file.name)) {
      const content = await readFile(file, "readAsText");
      core.setHTML(content);
      return true;
    }

    const bytes = await readFile(file, "readAsArrayBuffer");
    try {
      core.setHTML(await docxToHTML(bytes));
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
    container.innerHTML = Array.from(
      { length: paragraphs },
      (_, index) =>
        `<p>Productivity stress sample ${index + 1}: Name and Date fields.</p>`,
    ).join("");
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
