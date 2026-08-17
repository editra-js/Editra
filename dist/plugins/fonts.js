(function (global) {
  "use strict";

  const installations = new WeakMap();
  const FONT_FAMILIES = Object.freeze([
    "Segoe UI",
    "Calibri",
    "Arial",
    "Helvetica",
    "Times New Roman",
    "Georgia",
    "Garamond",
    "Verdana",
    "Tahoma",
    "Trebuchet MS",
    "Courier New",
    "Consolas",
    "Cambria",
    "Candara",
    "Century Gothic",
    "Franklin Gothic Medium",
    "Palatino Linotype",
    "Book Antiqua",
    "Lucida Sans Unicode",
    "Impact",
    "Noto Sans",
    "Noto Serif",
    "Arial Unicode MS",
  ]);
  const FONT_SIZES = Object.freeze(
    Array.from({ length: 29 }, (_, index) => index + 8),
  );

  function selectionRange(core) {
    core.restoreSelection();
    const selection = global.getSelection();
    if (!selection?.rangeCount) return null;
    const range = selection.getRangeAt(0);
    return core.isRangeInside(range) ? range : null;
  }

  function commit(core) {
    core.captureSelection();
    core.recordHistory();
    core.scheduleUpdate("font-change", () => {
      core.emitChange();
      core.emitState();
    });
    return true;
  }

  function selectedBlocks(core, range) {
    if (range.collapsed) return [];
    return [...core.editor.querySelectorAll("p,h1,h2,h3,h4,h5,h6,li,blockquote,pre")]
      .filter((block) => {
        try {
          return range.intersectsNode(block);
        } catch {
          return false;
        }
      });
  }

  /** Removes an older copy of one font property that would override a new one. */
  function clearNestedProperty(root, property) {
    root.querySelectorAll?.("[style]").forEach((element) => {
      element.style[property] = "";
      if (!element.getAttribute("style")?.trim()) element.removeAttribute("style");
    });
  }

  /** Returns true when every selected text node already has the requested font. */
  function rangeAlreadyStyled(range, property, value) {
    const root = range.commonAncestorContainer;
    const textNodes = [];
    if (root.nodeType === Node.TEXT_NODE) {
      textNodes.push(root);
    } else {
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      while (walker.nextNode()) textNodes.push(walker.currentNode);
    }
    const selectedText = textNodes.filter((node) => {
      if (!node.nodeValue) return false;
      try {
        return range.intersectsNode(node);
      } catch {
        return false;
      }
    });
    if (!selectedText.length) return false;
    if (property === "fontSize") {
      const expected = Number.parseFloat(value);
      return selectedText.every((node) =>
        Math.abs(Number.parseFloat(getComputedStyle(node.parentElement).fontSize) - expected) < 0.01,
      );
    }
    const expected = String(value).split(",")[0].trim().replace(/^['"]|['"]$/g, "").toLowerCase();
    return selectedText.every((node) =>
      getComputedStyle(node.parentElement).fontFamily
        .split(",")[0]
        .trim()
        .replace(/^['"]|['"]$/g, "")
        .toLowerCase() === expected,
    );
  }

  function applyInline(core, property, value) {
    const range = selectionRange(core);
    if (!range) return false;
    if (range.collapsed) {
      const anchor =
        range.startContainer.nodeType === Node.ELEMENT_NODE
          ? range.startContainer
          : range.startContainer.parentElement;
      const block = anchor?.closest(
        "p,div,h1,h2,h3,h4,h5,h6,li,blockquote,pre,td,th",
      );
      if (block && block !== core.editor && core.editor.contains(block)) {
        // A caret-only toolbar action must produce an immediate visible result.
        // Prefer the innermost inline run so an older nested font value cannot
        // hide the new value; otherwise establish the style on the whole block.
        const inline = anchor?.closest(
          "span,a,strong,b,em,i,u,s,sup,sub,code",
        );
        const target = inline && block.contains(inline) ? inline : block;
        target.style[property] = value;
        if (core.state.trackChanges) {
          target.classList.add("editra-change-format");
          target.dataset.editraChange = "format";
          target.dataset.changeDetail = `${property}:${value}`;
        }
        return commit(core);
      }
    }
    // Repeating an already-applied command is a no-op instead of creating
    // another wrapper, while the same value still applies to a new selection.
    if (!range.collapsed && rangeAlreadyStyled(range, property, value)) {
      return true;
    }
    const blocks = selectedBlocks(core, range);
    if (blocks.length > 1) {
      return new Promise((resolve) => {
        let index = 0;
        const applyChunk = () => {
          const end = Math.min(index + 250, blocks.length);
          for (; index < end; index += 1) {
            clearNestedProperty(blocks[index], property);
            blocks[index].style[property] = value;
          }
          if (index < blocks.length) requestAnimationFrame(applyChunk);
          else resolve(commit(core));
        };
        requestAnimationFrame(applyChunk);
      });
    }
    const span = document.createElement("span");
    span.style[property] = value;
    if (core.state.trackChanges) {
      span.classList.add("editra-change-format");
      span.dataset.editraChange = "format";
      span.dataset.changeDetail = `${property}:${value}`;
    }
    if (range.collapsed) {
      const marker = document.createTextNode("\u200b");
      span.append(marker);
      range.insertNode(span);
      range.setStart(marker, marker.length);
      range.collapse(true);
    } else {
      const contents = range.extractContents();
      // New direct formatting must win over an older nested span carrying the
      // same property (for example 15px text changed to Heading then 24px).
      clearNestedProperty(contents, property);
      span.append(contents);
      range.insertNode(span);
      range.selectNodeContents(span);
    }
    const selection = global.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
    core.selection = range.cloneRange();
    return commit(core);
  }

  // Applies one supported font family to the saved selection or current block.
  function setFontFamily(core, value) {
    const requested = String(value || "").trim();
    const family = FONT_FAMILIES.find(
      (candidate) => candidate.toLowerCase() === requested.toLowerCase(),
    );
    if (!family) return false;
    return applyInline(core, "fontFamily", `"${family}"`);
  }

  // Applies a validated 8–36px size and ignores duplicate change events.
  function setFontSize(core, value) {
    const numeric = Number.parseInt(String(value || "").replace("px", ""), 10);
    if (!FONT_SIZES.includes(numeric)) return false;
    return applyInline(core, "fontSize", `${numeric}px`);
  }

  async function fontsStressTest(core, options = {}) {
    const count = Math.max(1000, Number(options.spans) || 10000);
    const container = document.createElement("div");
    const startedAt = performance.now();
    for (let start = 0; start < count; start += 500) {
      const fragment = document.createDocumentFragment();
      const end = Math.min(start + 500, count);
      for (let index = start; index < end; index += 1) {
        const span = document.createElement("span");
        span.style.fontFamily = FONT_FAMILIES[index % FONT_FAMILIES.length];
        span.style.fontSize = `${FONT_SIZES[index % FONT_SIZES.length]}px`;
        span.textContent = `Font sample ${index + 1} `;
        fragment.append(span);
      }
      container.append(fragment);
      if (end < count) {
        await new Promise((resolve) => requestAnimationFrame(resolve));
      }
    }
    return {
      spans: count,
      htmlBytes: new Blob([container.innerHTML]).size,
      durationMs: Math.round((performance.now() - startedAt) * 100) / 100,
    };
  }

  function install(core) {
    if (installations.has(core)) return installations.get(core);
    const commands = {
      setFontFamily: (value) => setFontFamily(core, value),
      setFontSize: (value) => setFontSize(core, value),
      fontsStressTest: (options) => fontsStressTest(core, options),
    };
    const unregister = Object.entries(commands).map(([name, handler]) =>
      core.registerCommand(name, handler, {
        plugin: "fonts",
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

  function FontsPlugin(core, value) {
    install(core);
    return setFontFamily(core, value);
  }

  FontsPlugin.install = install;
  FontsPlugin.hydrate = install;
  FontsPlugin.plugin = Object.freeze({
    name: "fonts",
    label: "Font family",
    command: "setFontFamily",
  });
  FontsPlugin.families = FONT_FAMILIES;
  FontsPlugin.sizes = FONT_SIZES;
  global.FontsPlugin = FontsPlugin;
  (global.EditraPlugins ??= Object.create(null)).fonts = FontsPlugin;
})(window);
