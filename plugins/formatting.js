// Version: 2.0.0
/**
 * Product: Editra
 * Author: Editra Team
 * Version: 2.0.0
 * Purpose: Implements the Editra formatting plugin and its editor commands.
 * Licensing: MIT License (open source)
 */

(function (global) {
  "use strict";

  const installations = new WeakMap();
  const BLOCKS = "p,div,h1,h2,h3,h4,h5,h6,li,blockquote,pre,td,th";

  function nextFrame() {
    return new Promise((resolve) => requestAnimationFrame(resolve));
  }

  function selectionRange(core, allowCollapsed = false) {
    core.restoreSelection();
    const selection = global.getSelection();
    if (!selection?.rangeCount) return null;
    const range = selection.getRangeAt(0);
    if (!core.isRangeInside(range) || (!allowCollapsed && range.collapsed)) {
      return null;
    }
    return range;
  }

  function commit(core) {
    core.captureSelection();
    core.recordHistory();
    core.scheduleUpdate("formatting-change", () => core.emitChange());
    return true;
  }

  function markTracked(core, node, detail) {
    if (!core.state.trackChanges) return;
    const user = core.options.collaboration?.user;
    node.classList.add("editra-change-format");
    node.dataset.editraChange = "format";
    node.dataset.changeDetail = detail;
    node.dataset.authorName = user?.name || "Guest";
    node.dataset.changedAt = new Date().toISOString();
    node.title = `Formatting changed by ${node.dataset.authorName}`;
  }

  function validColor(value, fallback) {
    const color = String(value || fallback);
    return global.CSS?.supports?.("color", color) ? color : fallback;
  }

  async function batchBlocks(blocks, callback) {
    for (let start = 0; start < blocks.length; start += 300) {
      blocks.slice(start, start + 300).forEach(callback);
      if (start + 300 < blocks.length) await nextFrame();
    }
  }

  function wrapInlineStyle(core, property, value, detail) {
    const range = selectionRange(core);
    if (!range) return false;
    const blocks = selectedBlocks(core).filter((block) => block !== core.editor);
    if (blocks.length > 1) {
      return batchBlocks(blocks, (block) => {
          block.style[property] = value;
          markTracked(core, block, detail);
        })
        .then(() => commit(core));
    }
    const span = document.createElement("span");
    span.style[property] = value;
    markTracked(core, span, detail);
    span.append(range.extractContents());
    range.insertNode(span);
    const selected = document.createRange();
    selected.selectNodeContents(span);
    const selection = global.getSelection();
    selection.removeAllRanges();
    selection.addRange(selected);
    core.selection = selected.cloneRange();
    return commit(core);
  }

  function promptValue(label, fallback) {
    return global.prompt(label, fallback)?.trim() || "";
  }

  function setFontFamily(core, value) {
    const family =
      String(value || promptValue("Font family:", "Georgia")).trim();
    if (!family || family.length > 100) return false;
    return wrapInlineStyle(core, "fontFamily", family, `font-family:${family}`);
  }

  function setFontSize(core, value) {
    let size = String(value || promptValue("Font size:", "16px")).trim();
    if (/^\d+(?:\.\d+)?$/.test(size)) size += "px";
    if (!global.CSS?.supports?.("font-size", size)) return false;
    return wrapInlineStyle(core, "fontSize", size, `font-size:${size}`);
  }

  function setForeColor(core, value) {
    const color = validColor(
      value || promptValue("Text color:", "#25231f"),
      "#25231f",
    );
    return wrapInlineStyle(core, "color", color, `color:${color}`);
  }

  function setBackgroundColor(core, value) {
    const color = validColor(
      value || promptValue("Background color:", "#fff2a8"),
      "#fff2a8",
    );
    if (color === "transparent") {
      const range = selectionRange(core);
      if (!range) return false;
      const anchor =
        range.commonAncestorContainer.nodeType === Node.ELEMENT_NODE
          ? range.commonAncestorContainer
          : range.commonAncestorContainer.parentElement;
      const styled = anchor?.closest("span[style]");
      if (styled && core.editor.contains(styled)) {
        styled.style.backgroundColor = "";
        if (!styled.getAttribute("style")) {
          styled.replaceWith(...styled.childNodes);
        }
        return commit(core);
      }
      return false;
    }
    return wrapInlineStyle(
      core,
      "backgroundColor",
      color,
      `background-color:${color}`,
    );
  }

  function highlightText(core, value) {
    const color = validColor(
      value || promptValue("Highlighter color:", "#fff176"),
      "#fff176",
    );
    if (color === "transparent") return setBackgroundColor(core, color);
    const result = wrapInlineStyle(
      core,
      "backgroundColor",
      color,
      `highlight:${color}`,
    );
    const selection = global.getSelection();
    const anchor =
      selection?.rangeCount && selection.getRangeAt(0).commonAncestorContainer;
    const element =
      anchor?.nodeType === Node.ELEMENT_NODE ? anchor : anchor?.parentElement;
    element?.closest("span")?.classList.add("editra-highlight");
    return result;
  }

  function strikethrough(core) {
    core.restoreSelection();
    core.editor.focus({ preventScroll: true });
    const result = core.execCommand("strikeThrough");
    commit(core);
    return result;
  }

  function setHeading(core, value) {
    const requested = String(
      value || promptValue("Heading level (H1–H6 or P):", "h2"),
    ).toLowerCase();
    const tag = /^(?:h[1-6]|p)$/.test(requested) ? requested : "p";
    core.restoreSelection();
    core.editor.focus({ preventScroll: true });
    const result = core.execCommand("formatBlock", tag);
    const range = selectionRange(core, true);
    const block =
      (range?.startContainer.nodeType === Node.ELEMENT_NODE
        ? range.startContainer
        : range?.startContainer.parentElement
      )?.closest(BLOCKS);
    if (block) markTracked(core, block, `heading:${tag}`);
    commit(core);
    return result;
  }

  function selectedBlocks(core) {
    const range = selectionRange(core, true);
    if (!range) return [];
    const common =
      range.commonAncestorContainer.nodeType === Node.ELEMENT_NODE
        ? range.commonAncestorContainer
        : range.commonAncestorContainer.parentElement;
    const nearest =
      common === core.editor ? null : common?.closest(BLOCKS);
    const candidates = nearest
      ? [nearest]
      : [...(common?.querySelectorAll(BLOCKS) ?? [])];
    return candidates.filter((block) => {
      try {
        return range.intersectsNode(block);
      } catch {
        return false;
      }
    });
  }

  async function setAlignment(core, value) {
    const requested = String(
      value || promptValue("Alignment: left, center, right or justify", "left"),
    ).toLowerCase();
    const alignment = ["left", "center", "right", "justify"].includes(requested)
      ? requested
      : "left";
    const blocks = selectedBlocks(core);
    if (!blocks.length) {
      const commands = {
        left: "justifyLeft",
        center: "justifyCenter",
        right: "justifyRight",
        justify: "justifyFull",
      };
      core.restoreSelection();
      core.execCommand(commands[alignment]);
    } else {
      await batchBlocks(blocks, (block) => {
        block.style.textAlign = alignment;
        markTracked(core, block, `alignment:${alignment}`);
      });
    }
    return commit(core);
  }

  async function setLineHeight(core, value) {
    const requested = String(
      value || promptValue("Line height:", "1.5"),
    ).trim();
    if (!/^(?:[0-9]*\.)?[0-9]+(?:px|em|rem|%)?$/.test(requested)) {
      return false;
    }
    const blocks = selectedBlocks(core);
    if (!blocks.length) return false;
    await batchBlocks(blocks, (block) => {
      block.style.lineHeight = requested;
      markTracked(core, block, `line-height:${requested}`);
    });
    return commit(core);
  }

  async function formattingStressTest(core, options = {}) {
    const paragraphs = Math.max(1000, Number(options.paragraphs) || 10000);
    const container = document.createElement("div");
    const startedAt = performance.now();
    for (let start = 0; start < paragraphs; start += 500) {
      const fragment = document.createDocumentFragment();
      const end = Math.min(start + 500, paragraphs);
      for (let index = start; index < end; index += 1) {
        const paragraph = document.createElement("p");
        paragraph.style.fontSize = `${12 + (index % 5) * 2}px`;
        paragraph.style.lineHeight = index % 2 ? "1.5" : "1.85";
        paragraph.textContent = `Formatting stress paragraph ${index + 1}`;
        fragment.append(paragraph);
      }
      container.append(fragment);
      if (end < paragraphs) await nextFrame();
    }
    return {
      paragraphs,
      htmlBytes: new Blob([container.innerHTML]).size,
      durationMs: Math.round(performance.now() - startedAt),
    };
  }

  function install(core) {
    if (installations.has(core)) return installations.get(core);
    const unregisterCommands = [];
    const commands = {
      setForeColor: (value) => setForeColor(core, value),
      setBackgroundColor: (value) => setBackgroundColor(core, value),
      highlightText: (value) => highlightText(core, value),
      strikethrough: () => strikethrough(core),
      setAlignment: (value) => setAlignment(core, value),
      setLineHeight: (value) => setLineHeight(core, value),
      formattingStressTest: (options) => formattingStressTest(core, options),
    };
    Object.entries(commands).forEach(([name, handler]) => {
      unregisterCommands.push(
        core.registerCommand(name, handler, {
          plugin: "formatting",
          source: "plugin",
        }),
      );
    });
    const state = { unregisterCommands };
    core.registerCleanup(() => {
      unregisterCommands.forEach((unregister) => unregister());
      installations.delete(core);
    });
    installations.set(core, state);
    return state;
  }

  function FormattingPlugin(core, value) {
    install(core);
    return setForeColor(core, value);
  }

  FormattingPlugin.install = install;
  FormattingPlugin.hydrate = install;
  FormattingPlugin.plugin = Object.freeze({
    name: "formatting",
    label: "Text color",
    command: "setForeColor",
  });

  global.FormattingPlugin = FormattingPlugin;
  (global.EditraPlugins ??= Object.create(null)).formatting = FormattingPlugin;
})(window);
