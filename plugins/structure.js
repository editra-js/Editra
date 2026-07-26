/**
 * Product: Editra
 * Author: Editra Team
 * Version: 1.16.0
 * Purpose: Implements the Editra structure plugin and its editor commands.
 * Licensing: MIT License (open source)
 */

(function (global) {
  "use strict";

  const installations = new WeakMap();
  const EMOJI_GROUPS = Object.freeze({
    Recent: ["😀", "😂", "😍", "🥰", "😊", "👍", "🎉", "✨"],
    People: ["😎", "🤓", "🤔", "😮", "😢", "😡", "👏", "🙏", "💪", "👋"],
    Nature: ["🌿", "🌸", "🌞", "🌙", "⭐", "🔥", "🌈", "❄️", "🌊", "🍀"],
    Objects: ["💡", "📌", "✅", "⚠️", "🚀", "🎯", "📚", "💻", "🔒", "❤️"],
  });

  function nextFrame() {
    return new Promise((resolve) => requestAnimationFrame(resolve));
  }

  function commit(core) {
    core.captureSelection();
    core.recordHistory();
    core.scheduleUpdate("structure-change", () => core.emitChange());
    return true;
  }

  function insertAtSelection(core, node) {
    core.restoreSelection();
    core.editor.focus({ preventScroll: true });
    const selection = global.getSelection();
    const range =
      selection?.rangeCount && core.isRangeInside(selection.getRangeAt(0))
        ? selection.getRangeAt(0)
        : null;
    if (range && !range.collapsed) range.deleteContents();
    let block =
      range?.startContainer.nodeType === Node.ELEMENT_NODE
        ? range.startContainer
        : range?.startContainer.parentElement;
    while (block?.parentElement && block.parentElement !== core.editor) {
      block = block.parentElement;
    }
    if (block && block !== core.editor && block.parentElement === core.editor) {
      block.after(node);
    } else {
      core.editor.append(node);
    }
    const caret = document.createRange();
    caret.setStartAfter(node);
    caret.collapse(true);
    selection.removeAllRanges();
    selection.addRange(caret);
    core.selection = caret.cloneRange();
    commit(core);
    return node;
  }

  function insertEmojiValue(core, emoji) {
    const value = String(emoji || "").trim();
    if (!value || value.length > 16) return false;
    core.restoreSelection();
    core.editor.focus({ preventScroll: true });
    const result = core.execCommand("insertText", value);
    commit(core);
    return result;
  }

  function openEmojiPicker(core, state, options = {}) {
    if (options.emoji) return insertEmojiValue(core, options.emoji);
    state.emojiOverlay?.dispatchEvent(new CustomEvent("editra:close"));
    const overlay = document.createElement("div");
    overlay.className = "editra-emoji-picker";
    overlay.dataset.editraUi = "true";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-label", "Emoji picker");
    const header = document.createElement("header");
    header.innerHTML =
      '<strong>Emoji</strong><button type="button" data-emoji-close aria-label="Close">×</button>';
    const search = document.createElement("input");
    search.type = "search";
    search.placeholder = "Search emoji categories";
    search.setAttribute("aria-label", "Search emoji categories");
    const body = document.createElement("div");
    body.className = "editra-emoji-groups";
    overlay.append(header, search, body);
    core.toolbar.card.append(overlay);
    let unregister = () => {};
    let closed = false;

    function render(filter = "") {
      const fragment = document.createDocumentFragment();
      Object.entries(EMOJI_GROUPS).forEach(([name, emojis]) => {
        if (filter && !name.toLowerCase().includes(filter.toLowerCase())) return;
        const group = document.createElement("section");
        const heading = document.createElement("strong");
        heading.textContent = name;
        const grid = document.createElement("div");
        emojis.forEach((emoji) => {
          const button = document.createElement("button");
          button.type = "button";
          button.dataset.emoji = emoji;
          button.setAttribute("aria-label", `Insert ${emoji}`);
          button.textContent = emoji;
          grid.append(button);
        });
        group.append(heading, grid);
        fragment.append(group);
      });
      core.scheduleUpdate("emoji-filter", () => body.replaceChildren(fragment));
    }
    function close() {
      if (closed) return;
      closed = true;
      overlay.removeEventListener("click", click);
      search.removeEventListener("input", input);
      overlay.removeEventListener("keydown", keydown);
      overlay.removeEventListener("editra:close", close);
      overlay.remove();
      state.emojiOverlay = null;
      unregister();
      core.focus();
    }
    function click(event) {
      if (event.target.closest("[data-emoji-close]")) return close();
      const button = event.target.closest("[data-emoji]");
      if (!button) return;
      insertEmojiValue(core, button.dataset.emoji);
      close();
    }
    function input() {
      render(search.value);
    }
    function keydown(event) {
      if (event.key === "Escape") close();
    }
    overlay.addEventListener("click", click);
    search.addEventListener("input", input);
    overlay.addEventListener("keydown", keydown);
    overlay.addEventListener("editra:close", close);
    unregister = core.registerCleanup(close);
    state.emojiOverlay = overlay;
    render();
    search.focus({ preventScroll: true });
    return overlay;
  }

  function insertPageBreak(core) {
    const pageBreak = document.createElement("div");
    pageBreak.className = "editra-page-break";
    pageBreak.contentEditable = "false";
    pageBreak.setAttribute("role", "separator");
    pageBreak.setAttribute("aria-label", "Page break");
    const result = insertAtSelection(core, pageBreak);
    if (result) {
      const paragraph = document.createElement("p");
      paragraph.append(document.createElement("br"));
      pageBreak.after(paragraph);
      const caret = document.createRange();
      caret.selectNodeContents(paragraph);
      caret.collapse(true);
      const selection = global.getSelection();
      selection.removeAllRanges();
      selection.addRange(caret);
      core.selection = caret.cloneRange();
      commit(core);
    }
    return result;
  }

  function insertHorizontalLine(core) {
    const line = document.createElement("hr");
    line.className = "editra-horizontal-line";
    line.contentEditable = "false";
    return insertAtSelection(core, line);
  }

  function insertCodeBlock(core, options = {}) {
    core.restoreSelection();
    const selection = global.getSelection();
    const range =
      selection?.rangeCount && core.isRangeInside(selection.getRangeAt(0))
        ? selection.getRangeAt(0)
        : null;
    const codeText = String(
      options.code ?? (range && !range.collapsed ? range.toString() : ""),
    );
    const pre = document.createElement("pre");
    pre.className = "editra-code-block";
    const code = document.createElement("code");
    code.dataset.language = String(options.language || "text");
    code.textContent = codeText || "Enter code here";
    pre.append(code);
    if (range && !range.collapsed) range.deleteContents();
    return insertAtSelection(core, pre);
  }

  function headingSlug(text, index) {
    const base = text
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^\w\s-]/g, "")
      .trim()
      .replace(/\s+/g, "-")
      .slice(0, 70);
    return base || `section-${index + 1}`;
  }

  async function buildTableOfContents(core, options = {}) {
    const headings = [...core.editor.querySelectorAll("h1,h2,h3,h4,h5,h6")]
      .filter((heading) => !heading.closest(".editra-table-of-contents"));
    if (!headings.length) return false;
    const usedIds = new Set();
    const entries = [];
    for (let start = 0; start < headings.length; start += 200) {
      const end = Math.min(start + 200, headings.length);
      for (let index = start; index < end; index += 1) {
        const heading = headings[index];
        let id = heading.id || headingSlug(heading.textContent, index);
        const base = id;
        let suffix = 2;
        while (usedIds.has(id) || (document.getElementById(id) && heading.id !== id)) {
          id = `${base}-${suffix++}`;
        }
        heading.id = id;
        usedIds.add(id);
        entries.push({
          level: Number(heading.tagName.slice(1)),
          id,
          text: heading.textContent.trim() || `Section ${index + 1}`,
        });
      }
      if (end < headings.length) await nextFrame();
    }

    const nav = document.createElement("nav");
    nav.className = "editra-table-of-contents";
    nav.dataset.editraToc = "true";
    nav.contentEditable = "false";
    nav.setAttribute("aria-label", "Table of contents");
    const title = document.createElement("strong");
    title.textContent = options.title || "Table of Contents";
    const rootList = document.createElement("ol");
    nav.append(title, rootList);
    const lists = [{ level: entries[0].level, list: rootList }];
    for (let start = 0; start < entries.length; start += 250) {
      entries.slice(start, start + 250).forEach((entry) => {
        while (entry.level < lists.at(-1).level && lists.length > 1) lists.pop();
        while (entry.level > lists.at(-1).level) {
          const parentList = lists.at(-1).list;
          const parentItem =
            parentList.lastElementChild ||
            parentList.appendChild(document.createElement("li"));
          const nested = document.createElement("ol");
          parentItem.append(nested);
          lists.push({ level: lists.at(-1).level + 1, list: nested });
        }
        const item = document.createElement("li");
        const link = document.createElement("a");
        link.href = `#${entry.id}`;
        link.textContent = entry.text;
        item.append(link);
        lists.at(-1).list.append(item);
      });
      if (start + 250 < entries.length) await nextFrame();
    }
    return nav;
  }

  async function insertTableOfContents(core, options = {}) {
    const nav = await buildTableOfContents(core, options);
    if (!nav) return false;
    const current = core.editor.querySelector("[data-editra-toc]");
    if (current && options.replaceExisting !== false) {
      current.replaceWith(nav);
      commit(core);
      return nav;
    }
    if (options.position === "start") {
      core.editor.prepend(nav);
      commit(core);
      return nav;
    }
    return insertAtSelection(core, nav);
  }

  function updateTableOfContents(core, options = {}) {
    return insertTableOfContents(core, {
      ...options,
      replaceExisting: true,
      position: "start",
    });
  }

  async function structureStressTest(core, options = {}) {
    const headings = Math.max(1000, Number(options.headings) || 10000);
    const container = document.createElement("div");
    const startedAt = performance.now();
    for (let start = 0; start < headings; start += 500) {
      const fragment = document.createDocumentFragment();
      const end = Math.min(start + 500, headings);
      for (let index = start; index < end; index += 1) {
        const heading = document.createElement(`h${(index % 6) + 1}`);
        heading.id = `stress-section-${index}`;
        heading.textContent = `Stress section ${index + 1}`;
        fragment.append(heading);
      }
      container.append(fragment);
      if (end < headings) await nextFrame();
    }
    return {
      headings,
      htmlBytes: new Blob([container.innerHTML]).size,
      durationMs: Math.round(performance.now() - startedAt),
    };
  }

  function install(core) {
    if (installations.has(core)) return installations.get(core);
    const state = { emojiOverlay: null, unregisterCommands: [] };
    const commands = {
      insertEmoji: (options) =>
        typeof options === "string"
          ? insertEmojiValue(core, options)
          : openEmojiPicker(core, state, options),
      insertPageBreak: () => insertPageBreak(core),
      insertHorizontalLine: () => insertHorizontalLine(core),
      insertTableOfContents: (options) => insertTableOfContents(core, options),
      updateTableOfContents: (options) => updateTableOfContents(core, options),
      insertCodeBlock: (options) => insertCodeBlock(core, options),
      structureStressTest: (options) => structureStressTest(core, options),
    };
    Object.entries(commands).forEach(([name, handler]) => {
      state.unregisterCommands.push(
        core.registerCommand(name, handler, {
          plugin: "structure",
          source: "plugin",
        }),
      );
    });
    core.registerCleanup(() => {
      state.emojiOverlay?.dispatchEvent(new CustomEvent("editra:close"));
      state.unregisterCommands.forEach((unregister) => unregister());
      installations.delete(core);
    });
    installations.set(core, state);
    return state;
  }

  function StructurePlugin(core, options) {
    const state = install(core);
    return openEmojiPicker(core, state, options);
  }

  StructurePlugin.install = install;
  StructurePlugin.hydrate = install;
  StructurePlugin.plugin = Object.freeze({
    name: "structure",
    label: "Emoji",
    icon: "emoji",
    command: "insertEmoji",
  });

  global.StructurePlugin = StructurePlugin;
  (global.EditraPlugins ??= Object.create(null)).structure = StructurePlugin;
})(window);
