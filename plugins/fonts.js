/**
 * Product: Editra
 * Author: Editra Team
 * Version: 1.17.0
 * Purpose: Implements the Editra fonts plugin and its editor commands.
 * Licensing: MIT License (open source)
 */

(function (global) {
  "use strict";

  const installations = new WeakMap();
  const fontSizeGuards = new WeakMap();
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

  function applyInline(core, property, value) {
    const range = selectionRange(core);
    if (!range) return false;
    const blocks = selectedBlocks(core, range);
    if (blocks.length > 1) {
      return new Promise((resolve) => {
        let index = 0;
        const applyChunk = () => {
          const end = Math.min(index + 250, blocks.length);
          for (; index < end; index += 1) blocks[index].style[property] = value;
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
      span.append(range.extractContents());
      range.insertNode(span);
      range.selectNodeContents(span);
    }
    const selection = global.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
    core.selection = range.cloneRange();
    return commit(core);
  }

  function setFontFamily(core, value) {
    const requested = String(value || "").trim();
    const family = FONT_FAMILIES.find(
      (candidate) => candidate.toLowerCase() === requested.toLowerCase(),
    );
    if (!family) return false;
    return applyInline(core, "fontFamily", `"${family}"`);
  }

  function setFontSize(core, value) {
    const numeric = Number.parseInt(String(value || "").replace("px", ""), 10);
    if (!FONT_SIZES.includes(numeric)) return false;
    const now = performance.now();
    const previous = fontSizeGuards.get(core);
    if (previous?.value === numeric && now - previous.time < 150) return true;
    fontSizeGuards.set(core, { value: numeric, time: now });
    requestAnimationFrame(() => {
      if (fontSizeGuards.get(core)?.time === now) fontSizeGuards.delete(core);
    });
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
      fontSizeGuards.delete(core);
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
