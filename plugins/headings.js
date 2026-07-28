// Version: 2.0.0
/**
 * Product: Editra
 * Version: 2.0.0
 * Purpose: Implements the Editra headings plugin and its editor commands.
 * Licensing: MIT License (open source)
 */

(function (global) {
  "use strict";

  const installations = new WeakMap();
  const BLOCK_SELECTOR = "p,div,h1,h2,h3,h4,h5,h6,li,blockquote,pre";
  const VALID_TAGS = new Set(["p", "h1", "h2", "h3", "h4", "h5", "h6"]);

  function rangeInside(core) {
    core.restoreSelection();
    const selection = global.getSelection();
    if (!selection?.rangeCount) return null;
    const range = selection.getRangeAt(0);
    return core.isRangeInside(range) ? range : null;
  }

  function selectedBlocks(core, range) {
    const blocks = [...core.editor.querySelectorAll(BLOCK_SELECTOR)];
    const selected = blocks.filter((block) => {
      try {
        const ancestor = block.parentElement?.closest(BLOCK_SELECTOR);
        return (
          range.intersectsNode(block) &&
          (!ancestor || ancestor === core.editor)
        );
      } catch {
        return false;
      }
    });
    if (selected.length) return selected;
    const node =
      range.startContainer.nodeType === Node.ELEMENT_NODE
        ? range.startContainer
        : range.startContainer.parentElement;
    const nearest = node?.closest(BLOCK_SELECTOR);
    return nearest && core.editor.contains(nearest) ? [nearest] : [];
  }

  function replaceTag(block, tag) {
    if (block.tagName.toLowerCase() === tag) return block;
    const replacement = document.createElement(tag);
    [...block.attributes].forEach((attribute) => {
      replacement.setAttribute(attribute.name, attribute.value);
    });
    replacement.append(...block.childNodes);
    block.replaceWith(replacement);
    return replacement;
  }

  async function setHeading(core, value) {
    const tag = String(value || "p").toLowerCase();
    if (!VALID_TAGS.has(tag)) return false;
    const range = rangeInside(core);
    if (!range) return false;
    let blocks = selectedBlocks(core, range);
    if (!blocks.length) {
      core.editor.focus({ preventScroll: true });
      const result = core.execCommand("formatBlock", tag);
      core.recordHistory();
      core.scheduleUpdate("heading-change", () => core.emitChange());
      return result;
    }

    const replacements = [];
    for (let start = 0; start < blocks.length; start += 200) {
      blocks.slice(start, start + 200).forEach((block) => {
        const replacement = replaceTag(block, tag);
        if (core.state.trackChanges) {
          replacement.classList.add("editra-change-format");
          replacement.dataset.editraChange = "format";
          replacement.dataset.changeDetail = `heading:${tag}`;
        }
        replacements.push(replacement);
      });
      if (start + 200 < blocks.length) {
        await new Promise((resolve) => requestAnimationFrame(resolve));
      }
    }

    const selection = global.getSelection();
    const selected = document.createRange();
    selected.setStart(replacements[0], 0);
    selected.setEnd(
      replacements.at(-1),
      replacements.at(-1).childNodes.length,
    );
    selection.removeAllRanges();
    selection.addRange(selected);
    core.selection = selected.cloneRange();
    core.recordHistory();
    core.scheduleUpdate("heading-change", () => {
      core.emitChange();
      core.emitState();
    });
    return true;
  }

  async function headingsStressTest(core, options = {}) {
    const count = Math.max(1000, Number(options.blocks) || 10000);
    const container = document.createElement("div");
    const startedAt = performance.now();
    for (let start = 0; start < count; start += 500) {
      const fragment = document.createDocumentFragment();
      const end = Math.min(start + 500, count);
      for (let index = start; index < end; index += 1) {
        const heading = document.createElement(`h${(index % 6) + 1}`);
        heading.textContent = `Semantic heading ${index + 1}`;
        fragment.append(heading);
      }
      container.append(fragment);
      if (end < count) {
        await new Promise((resolve) => requestAnimationFrame(resolve));
      }
    }
    return {
      blocks: count,
      semanticTags: container.querySelectorAll("h1,h2,h3,h4,h5,h6").length,
      durationMs: Math.round((performance.now() - startedAt) * 100) / 100,
    };
  }

  function install(core) {
    if (installations.has(core)) return installations.get(core);
    const handlers = {
      setHeading: (value) => setHeading(core, value),
      applyHeading: (value) => setHeading(core, value),
      headingsStressTest: (options) => headingsStressTest(core, options),
    };
    const unregister = Object.entries(handlers).map(([name, handler]) =>
      core.registerCommand(name, handler, {
        plugin: "headings",
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

  function HeadingsPlugin(core, value) {
    install(core);
    return setHeading(core, value);
  }

  HeadingsPlugin.install = install;
  HeadingsPlugin.hydrate = install;
  HeadingsPlugin.plugin = Object.freeze({
    name: "headings",
    label: "Heading",
    command: "setHeading",
  });
  global.HeadingsPlugin = HeadingsPlugin;
  (global.EditraPlugins ??= Object.create(null)).headings = HeadingsPlugin;
})(window);
