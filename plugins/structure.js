(function (global) {
  "use strict";

  const installations = new WeakMap();
  const EMOJI_GROUPS = Object.freeze({
    Recent: ["😀", "😂", "😍", "🥰", "😊", "👍", "🎉", "✨"],
    People: ["😎", "🤓", "🤔", "😮", "😢", "😡", "👏", "🙏", "💪", "👋"],
    Nature: ["🌿", "🌸", "🌞", "🌙", "⭐", "🔥", "🌈", "❄️", "🌊", "🍀"],
    Objects: ["💡", "📌", "✅", "⚠️", "🚀", "🎯", "📚", "💻", "🔒", "❤️"],
  });
  const SPECIAL_CHARACTER_GROUPS = Object.freeze({
    Emoji: ["\u{1F600}", "\u{1F642}", "\u{1F44D}", "\u{1F389}", "\u2728", "\u2764\uFE0F"],
    Currency: ["$", "\u20AC", "\u00A3", "\u00A5", "\u20B9", "\u20A9", "\u20BD", "\u00A2"],
    Text: ["\u00A9", "\u00AE", "\u2122", "\u00A7", "\u00B6", "\u2020", "\u2021", "\u2026"],
    Mathematical: ["\u00B1", "\u00D7", "\u00F7", "\u2260", "\u2264", "\u2265", "\u221E", "\u221A", "\u03C0", "\u2211"],
    Arrows: ["\u2190", "\u2191", "\u2192", "\u2193", "\u2194", "\u21D0", "\u21D2", "\u21D4"],
    Latin: ["\u00C0", "\u00C1", "\u00C4", "\u00C7", "\u00D1", "\u00D6", "\u00DC", "\u00DF", "\u00E6", "\u00F8"],
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

  function insertInlineNode(core, node) {
    core.restoreSelection();
    core.editor.focus({ preventScroll: true });
    const selection = global.getSelection();
    const range =
      selection?.rangeCount && core.isRangeInside(selection.getRangeAt(0))
        ? selection.getRangeAt(0)
        : null;
    if (!range) return false;
    range.deleteContents();
    range.insertNode(node);
    range.setStartAfter(node);
    range.collapse(true);
    selection.removeAllRanges();
    selection.addRange(range);
    core.selection = range.cloneRange();
    return commit(core);
  }

  function insertEmojiValue(core, emoji) {
    const value = String(emoji || "").trim();
    if (!value || value.length > 16) return false;
    const span = document.createElement("span");
    span.className = "editra-emoji-object";
    span.textContent = value;
    span.contentEditable = "false";
    span.draggable = true;
    span.dataset.editraEmoji = value;
    span.dataset.editraSelectable = "true";
    span.dataset.editraDraggable = "true";
    span.setAttribute("role", "img");
    span.setAttribute("aria-label", `Emoji ${value}`);
    return insertInlineNode(core, span);
  }

  function insertCharacterValue(core, character) {
    const value = String(character || "");
    if (!value || value.length > 8) return false;
    const text = document.createTextNode(value);
    return insertInlineNode(core, text);
  }

  function positionPicker(core, overlay, options) {
    const anchor =
      options.anchor instanceof Element ? options.anchor : core.toolbar.element;
    const anchorRect = options.anchorRect || anchor.getBoundingClientRect();
    const cardRect = core.toolbar.card.getBoundingClientRect();
    const popupWidth = Math.min(350, Math.max(240, cardRect.width - 32));
    overlay.style.right = "auto";
    overlay.style.left = `${Math.max(8, Math.min(anchorRect.left - cardRect.left, Math.max(8, cardRect.width - popupWidth - 8)))}px`;
    overlay.style.top = `${Math.max(8, anchorRect.bottom - cardRect.top + 6)}px`;
  }

  function openSpecialCharacterPicker(core, state, options = {}) {
    if (options.character) return insertCharacterValue(core, options.character);
    const trigger = options.anchor;
    if (
      options.explicit !== true ||
      !(trigger instanceof Element) ||
      !trigger.isConnected ||
      trigger.dataset.command !== "special-characters"
    ) {
      return false;
    }
    state.emojiOverlay?.dispatchEvent(new CustomEvent("editra:close"));
    state.characterOverlay?.dispatchEvent(new CustomEvent("editra:close"));
    const overlay = document.createElement("div");
    overlay.className = "editra-emoji-picker editra-popup editra-popup--characters";
    overlay.dataset.editraUi = "true";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-label", "Special characters");
    const header = document.createElement("header");
    const title = document.createElement("strong");
    title.textContent = "Special characters";
    const closeButton = document.createElement("button");
    closeButton.type = "button";
    closeButton.dataset.characterClose = "true";
    closeButton.setAttribute("aria-label", "Close special characters");
    closeButton.textContent = "\u00d7";
    header.append(title, closeButton);
    const categories = document.createElement("div");
    categories.className = "editra-character-categories";
    const body = document.createElement("div");
    body.className = "editra-emoji-groups";
    overlay.append(header, categories, body);
    core.toolbar.card.append(overlay);
    positionPicker(core, overlay, options);

    let activeCategory = Object.keys(SPECIAL_CHARACTER_GROUPS)[0];
    let unregister = () => {};
    let closed = false;
    const render = () => {
      categories.replaceChildren(
        ...Object.keys(SPECIAL_CHARACTER_GROUPS).map((name) => {
          const button = document.createElement("button");
          button.type = "button";
          button.dataset.characterCategory = name;
          button.classList.toggle("is-active", name === activeCategory);
          button.textContent = name;
          return button;
        }),
      );
      const grid = document.createElement("div");
      SPECIAL_CHARACTER_GROUPS[activeCategory].forEach((character) => {
        const button = document.createElement("button");
        button.type = "button";
        button.dataset.character = character;
        button.setAttribute("aria-label", `Insert ${character}`);
        button.textContent = character;
        grid.append(button);
      });
      const section = document.createElement("section");
      section.append(grid);
      body.replaceChildren(section);
    };
    const close = () => {
      if (closed) return;
      closed = true;
      overlay.removeEventListener("click", click);
      overlay.removeEventListener("keydown", keydown);
      overlay.removeEventListener("editra:close", close);
      document.removeEventListener("pointerdown", outside, true);
      overlay.remove();
      state.characterOverlay = null;
      unregister();
      core.focus();
    };
    const click = (event) => {
      if (event.target.closest("[data-character-close]")) return close();
      const category = event.target.closest("[data-character-category]");
      if (category) {
        activeCategory = category.dataset.characterCategory;
        render();
        return;
      }
      const character = event.target.closest("[data-character]");
      if (!character) return;
      insertCharacterValue(core, character.dataset.character);
      close();
    };
    const keydown = (event) => {
      if (event.key === "Escape") close();
    };
    const outside = (event) => {
      if (!overlay.contains(event.target)) close();
    };
    overlay.addEventListener("click", click);
    overlay.addEventListener("keydown", keydown);
    overlay.addEventListener("editra:close", close);
    document.addEventListener("pointerdown", outside, true);
    unregister = core.registerCleanup(close);
    state.characterOverlay = overlay;
    render();
    categories.querySelector("button")?.focus({ preventScroll: true });
    return overlay;
  }

  function insertDateTime(core, options = {}) {
    const mode = String(typeof options === "string" ? options : options.mode || "datetime");
    const now = options.date instanceof Date ? options.date : new Date();
    const locale = core.options.language || undefined;
    const value =
      mode === "date"
        ? now.toLocaleDateString(locale)
        : mode === "time"
          ? now.toLocaleTimeString(locale)
          : now.toLocaleString(locale);
    const time = document.createElement("time");
    time.dateTime = now.toISOString();
    time.textContent = value;
    return insertInlineNode(core, time);
  }

  function openEmojiPicker(core, state, options = {}) {
    if (options.emoji) return insertEmojiValue(core, options.emoji);
    state.emojiOverlay?.dispatchEvent(new CustomEvent("editra:close"));
    const overlay = document.createElement("div");
    overlay.className =
      "editra-emoji-picker editra-popup editra-popup--emoji";
    overlay.dataset.editraUi = "true";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-label", "Emoji picker");
    const header = document.createElement("header");
    const title = document.createElement("strong");
    title.textContent = "Emoji";
    const closeButton = document.createElement("button");
    closeButton.type = "button";
    closeButton.dataset.emojiClose = "true";
    closeButton.setAttribute("aria-label", "Close emoji picker");
    closeButton.textContent = "\u00d7";
    header.append(title, closeButton);
    const search = document.createElement("input");
    search.type = "search";
    search.placeholder = "Search emoji categories";
    search.setAttribute("aria-label", "Search emoji categories");
    const body = document.createElement("div");
    body.className = "editra-emoji-groups";
    overlay.append(header, search, body);
    core.toolbar.card.append(overlay);
    const anchor =
      options.anchor instanceof Element ? options.anchor : core.toolbar.element;
    const anchorRect = options.anchorRect || anchor.getBoundingClientRect();
    const cardRect = core.toolbar.card.getBoundingClientRect();
    const popupWidth = Math.min(350, Math.max(240, cardRect.width - 32));
    overlay.style.right = "auto";
    overlay.style.left = `${Math.max(
      8,
      Math.min(
        anchorRect.left - cardRect.left,
        Math.max(8, cardRect.width - popupWidth - 8),
      ),
    )}px`;
    overlay.style.top = `${Math.max(
      8,
      anchorRect.bottom - cardRect.top + 6,
    )}px`;
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
      document.removeEventListener("pointerdown", outsidePointer, true);
      core.editor.removeEventListener("beforeinput", editorTyping);
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
    function outsidePointer(event) {
      if (!overlay.contains(event.target)) close();
    }
    function editorTyping() {
      close();
    }
    overlay.addEventListener("click", click);
    search.addEventListener("input", input);
    overlay.addEventListener("keydown", keydown);
    overlay.addEventListener("editra:close", close);
    document.addEventListener("pointerdown", outsidePointer, true);
    core.editor.addEventListener("beforeinput", editorTyping);
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
    pageBreak.dataset.editraSelectable = "true";
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
    line.dataset.editraSelectable = "true";
    return insertAtSelection(core, line);
  }

  function codeBlockAtSelection(core) {
    const selection = global.getSelection();
    if (!selection?.rangeCount) return null;
    const node = selection.getRangeAt(0).startContainer;
    const element =
      node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement;
    const block = element?.closest(".editra-code-block");
    return block && core.editor.contains(block) ? block : null;
  }

  function normalizeCodeBlockOptions(options) {
    if (typeof options !== "string") return options || {};
    if (options === "plain") {
      return { language: "text", highlight: false };
    }
    return { language: options, highlight: true };
  }

  function codeBlockTextColor(background) {
    const match = String(background).match(/^#([\da-f]{6})$/i);
    if (!match) return "";
    const value = Number.parseInt(match[1], 16);
    const red = (value >> 16) & 255;
    const green = (value >> 8) & 255;
    const blue = value & 255;
    const luminance = (red * 299 + green * 587 + blue * 114) / 1000;
    return luminance > 150 ? "#1f2937" : "#f8fafc";
  }

  function syntaxPattern(language) {
    if (language === "html") {
      return /<!--[\s\S]*?-->|<\/?[a-z][^>]*>|&(?:#\d+|#x[\da-f]+|[a-z]+);/gi;
    }
    if (language === "css") {
      return /\/\*[\s\S]*?\*\/|#[\da-f]{3,8}\b|--?[\w-]+(?=\s*:)|"(?:\\.|[^"])*"|'(?:\\.|[^'])*'|\b\d+(?:\.\d+)?(?:px|rem|em|%|s|ms)?\b/gi;
    }
    if (language === "json") {
      return /"(?:\\.|[^"])*"(?=\s*:)|"(?:\\.|[^"])*"|\b(?:true|false|null)\b|-?\b\d+(?:\.\d+)?(?:e[+-]?\d+)?\b/gi;
    }
    return /\/\*[\s\S]*?\*\/|\/\/[^\n]*|"(?:\\.|[^"])*"|'(?:\\.|[^'])*'|`(?:\\.|[^`])*`|\b(?:async|await|break|case|class|const|continue|default|else|export|extends|false|for|from|function|if|import|let|new|null|return|switch|this|throw|true|try|typeof|undefined|var|while)\b|\b\d+(?:\.\d+)?\b/g;
  }

  function syntaxTokenType(value) {
    if (/^(?:\/[/*]|<!--)/.test(value)) return "comment";
    if (/^["'`]/.test(value)) return "string";
    if (/^(?:<\/?|&)/.test(value)) return "tag";
    if (/^-?\d|^#[\da-f]/i.test(value)) return "number";
    if (/^(?:true|false|null|undefined)$/.test(value)) return "literal";
    if (/^--?[\w-]+$/.test(value)) return "property";
    return "keyword";
  }

  function renderSyntax(code, language, highlighted) {
    const source = code.textContent;
    if (!highlighted) {
      code.textContent = source;
      return;
    }
    const pattern = syntaxPattern(language);
    const fragment = document.createDocumentFragment();
    let offset = 0;
    source.replace(pattern, (value, index) => {
      if (index > offset) fragment.append(document.createTextNode(source.slice(offset, index)));
      const token = document.createElement("span");
      token.className = `editra-code-token editra-code-token--${syntaxTokenType(value)}`;
      token.textContent = value;
      fragment.append(token);
      offset = index + value.length;
      return value;
    });
    if (offset < source.length) fragment.append(document.createTextNode(source.slice(offset)));
    code.replaceChildren(fragment);
  }

  function applyCodeBlockPresentation(pre, options = {}) {
    const code = pre.querySelector("code");
    const language = String(options.language || code?.dataset.language || "text");
    const highlighted = options.highlight ?? language !== "text";
    if (code) {
      code.dataset.language = language;
      code.className = highlighted ? `language-${language}` : "";
      renderSyntax(code, language, highlighted);
    }
    pre.dataset.editraCodeLanguage = language;
    pre.dataset.editraSyntax = highlighted ? "highlighted" : "plain";
    pre.classList.toggle("is-syntax-highlighted", highlighted);
    if (options.background) {
      pre.style.backgroundColor = String(options.background);
      pre.dataset.editraCodeBackground = String(options.background);
      const textColor = codeBlockTextColor(options.background);
      if (textColor) pre.style.color = textColor;
    }
    return pre;
  }

  function setCodeBlockBackground(core, color) {
    core.restoreSelection();
    const block = codeBlockAtSelection(core);
    if (!block) return false;
    const value = String(color || "");
    if (value === "transparent") {
      block.style.removeProperty("background-color");
      block.style.removeProperty("color");
      delete block.dataset.editraCodeBackground;
    } else {
      block.style.backgroundColor = value;
      block.dataset.editraCodeBackground = value;
      const textColor = codeBlockTextColor(value);
      if (textColor) block.style.color = textColor;
    }
    return commit(core);
  }

  function insertCodeBlock(core, rawOptions = {}) {
    const options = normalizeCodeBlockOptions(rawOptions);
    core.restoreSelection();
    const selection = global.getSelection();
    const range =
      selection?.rangeCount && core.isRangeInside(selection.getRangeAt(0))
        ? selection.getRangeAt(0)
        : null;
    const existing = codeBlockAtSelection(core);
    if (existing && options.code === undefined) {
      applyCodeBlockPresentation(existing, options);
      return commit(core);
    }
    const codeText = String(
      options.code ?? (range && !range.collapsed ? range.toString() : ""),
    );
    const pre = document.createElement("pre");
    pre.className = "editra-code-block";
    const code = document.createElement("code");
    code.dataset.language = String(options.language || "text");
    code.textContent = codeText || "Enter code here";
    pre.append(code);
    applyCodeBlockPresentation(pre, options);
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
    nav.dataset.editraSelectable = "true";
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
    const state = {
      emojiOverlay: null,
      characterOverlay: null,
      unregisterCommands: [],
    };
    const commands = {
      insertEmoji: (options) =>
        typeof options === "string"
          ? insertEmojiValue(core, options)
          : openEmojiPicker(core, state, options),
      "special-characters": (options) =>
        openSpecialCharacterPicker(core, state, options),
      insertDateTime: (options) => insertDateTime(core, options),
      insertPageBreak: () => insertPageBreak(core),
      insertHorizontalLine: () => insertHorizontalLine(core),
      insertTableOfContents: (options) => insertTableOfContents(core, options),
      updateTableOfContents: (options) => updateTableOfContents(core, options),
      insertCodeBlock: (options) => insertCodeBlock(core, options),
      setCodeBlockBackground: (color) => setCodeBlockBackground(core, color),
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
      state.characterOverlay?.dispatchEvent(new CustomEvent("editra:close"));
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
