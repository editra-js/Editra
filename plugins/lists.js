(function (global) {
  "use strict";

  const installations = new WeakMap();
  const LIST_BLOCK_SELECTOR = "p,div,h1,h2,h3,h4,h5,h6,blockquote,pre";
  // These allowlists are shared by toolbar/menu commands. Standard CSS marker
  // names are stored directly; Word-like symbol bullets use theme ::marker CSS.
  const BULLET_STYLES = Object.freeze({
    disc: "disc",
    circle: "circle",
    square: "square",
    dash: "disc",
    arrow: "disc",
    check: "disc",
    diamond: "disc",
    none: "none",
  });
  const NUMBER_STYLES = Object.freeze({
    decimal: "decimal",
    "decimal-leading-zero": "decimal-leading-zero",
    "lower-alpha": "lower-alpha",
    "upper-alpha": "upper-alpha",
    "lower-roman": "lower-roman",
    "upper-roman": "upper-roman",
    "lower-greek": "lower-greek",
    "arabic-indic": "arabic-indic",
  });

  function nextFrame() {
    return new Promise((resolve) => requestAnimationFrame(resolve));
  }

  function commit(core) {
    core.captureSelection();
    core.recordHistory();
    core.scheduleUpdate("lists-change", () => core.emitChange());
    return true;
  }

  function createListFromBlocks(tagName, blocks) {
    if (!blocks.length) return null;
    const list = document.createElement(tagName.toLowerCase());
    const firstBlock = blocks[0];
    firstBlock.before(list);
    blocks.forEach((block) => {
      const item = document.createElement("li");
      // Keep the original block inside the list item. This preserves heading
      // level, alignment, line height, attributes, and inline formatting when
      // a paragraph or H1-H6 is combined with a list.
      item.append(block);
      list.append(item);
    });
    return list;
  }

  function removeEmptyStyle(element) {
    if (!element.getAttribute("style")?.trim()) element.removeAttribute("style");
  }

  function normalizeFontSizeFormatting(list) {
    [list, ...list.querySelectorAll("li")].forEach((element) => {
      element.style.removeProperty("font-size");
      removeEmptyStyle(element);
    });
    list.querySelectorAll("span[style]").forEach((span) => {
      if (!span.style.fontSize || !span.parentElement) return;
      if (getComputedStyle(span).fontSize !== getComputedStyle(span.parentElement).fontSize) {
        return;
      }
      span.style.removeProperty("font-size");
      removeEmptyStyle(span);
      if (!span.attributes.length) span.replaceWith(...span.childNodes);
    });
  }

  function placeCaret(core, selection, container) {
    const target = container.matches?.("li,p")
      ? container
      : container.querySelector?.("li,p") || container;
    if (!target) return;
    const nextRange = document.createRange();
    nextRange.selectNodeContents(target);
    nextRange.collapse(false);
    selection.removeAllRanges();
    selection.addRange(nextRange);
    core.selection = nextRange.cloneRange();
  }

  function replaceListType(list, tagName) {
    const replacement = document.createElement(tagName.toLowerCase());
    [...list.attributes].forEach((attribute) => {
      replacement.setAttribute(attribute.name, attribute.value);
    });
    replacement.append(...list.childNodes);
    list.replaceWith(replacement);
    return replacement;
  }

  /** Applies a validated marker preset without changing list contents. */
  function applyListStyle(list, requestedStyle) {
    const styles = list.tagName === "UL" ? BULLET_STYLES : NUMBER_STYLES;
    const fallback = list.tagName === "UL" ? "disc" : "decimal";
    const style = String(requestedStyle || fallback).trim().toLowerCase();
    if (!Object.hasOwn(styles, style)) return false;
    list.dataset.editraListStyle = style;
    list.style.listStyleType = styles[style];
    return true;
  }

  function removeList(list) {
    const fragment = document.createDocumentFragment();
    const paragraphs = [];
    [...list.children].forEach((item) => {
      if (item.tagName !== "LI") return;
      const directBlock = [...item.children].find((child) =>
        child.matches(LIST_BLOCK_SELECTOR),
      );
      if (directBlock) {
        paragraphs.push(directBlock);
        fragment.append(directBlock);
        // Retain any nested list that was created with Increase Indent.
        [...item.children]
          .filter((child) => child.matches("ul,ol"))
          .forEach((nested) => fragment.append(nested));
        return;
      }
      const paragraph = document.createElement("p");
      paragraph.append(...item.childNodes);
      if (!paragraph.hasChildNodes()) paragraph.append(document.createElement("br"));
      paragraphs.push(paragraph);
      fragment.append(paragraph);
    });
    list.replaceWith(fragment);
    return paragraphs[0] || null;
  }

  /**
   * Browsers may keep the first line typed into an empty contenteditable as a
   * direct text node, then create DIV blocks for later lines. Promote selected
   * root-level text/inline runs to paragraphs so line one joins the same list.
   */
  function promoteSelectedRootInlineContent(container, range) {
    const promoted = [];
    let paragraph = null;
    [...container.childNodes].forEach((node) => {
      const inline = node.nodeType === Node.TEXT_NODE ||
        (node.nodeType === Node.ELEMENT_NODE && node.matches(
          "br,span,b,strong,i,em,u,s,strike,sub,sup,a,mark,small,code",
        ));
      let selected = false;
      if (inline) {
        try {
          selected = range.intersectsNode(node);
        } catch {
          selected = false;
        }
      }
      const meaningful = node.nodeType !== Node.TEXT_NODE ||
        Boolean(node.textContent.trim());
      if (!inline || !selected || (!paragraph && !meaningful)) {
        paragraph = null;
        return;
      }
      if (!paragraph) {
        paragraph = document.createElement("p");
        node.before(paragraph);
        promoted.push(paragraph);
      }
      paragraph.append(node);
    });
    return promoted;
  }

  /** Keeps a list inside its active table cell instead of wrapping the table. */
  function listScope(core, anchor) {
    const cell = anchor?.closest?.("td,th");
    return cell && core.editor.contains(cell) ? cell : core.editor;
  }

  function runListCommand(core, command, options = {}) {
    core.restoreSelection();
    core.editor.focus({ preventScroll: true });
    const tagName =
      command === "insertOrderedList"
        ? "OL"
        : command === "insertUnorderedList"
          ? "UL"
        : null;
    const requestedStyle = String(
      typeof options === "string" ? options : options.style || "",
    ).trim();
    const selection = global.getSelection();
    const range = selection?.rangeCount ? selection.getRangeAt(0) : null;
    const anchor =
      selection?.anchorNode?.nodeType === Node.ELEMENT_NODE
        ? selection.anchorNode
        : selection?.anchorNode?.parentElement;
    const currentList = tagName ? anchor?.closest("ul,ol") : null;
    if (!tagName || !range) {
      commit(core);
      return false;
    }

    if (currentList && core.editor.contains(currentList)) {
      const shouldRemove = currentList.tagName === tagName.toUpperCase();
      if (shouldRemove && requestedStyle) {
        if (!applyListStyle(currentList, requestedStyle)) return false;
        normalizeFontSizeFormatting(currentList);
        placeCaret(core, selection, currentList);
        commit(core);
        return true;
      }
      if (shouldRemove) {
        const paragraph = removeList(currentList);
        if (paragraph) placeCaret(core, selection, paragraph);
        commit(core);
        return true;
      }
      const replacement = replaceListType(currentList, tagName);
      applyListStyle(replacement, requestedStyle);
      normalizeFontSizeFormatting(replacement);
      placeCaret(core, selection, replacement);
      commit(core);
      return true;
    }

    const scope = listScope(core, anchor);
    const promotedBlocks = promoteSelectedRootInlineContent(scope, range);
    const blocks = [
      ...scope.querySelectorAll(LIST_BLOCK_SELECTOR),
    ].filter((block) => {
      if (!scope.contains(block)) return false;
      // Only convert the outermost selected content blocks. This allows the
      // same logic inside editor-owned containers without double-wrapping.
      // An ancestor outside the active table cell is not a content block for
      // this command and must never cause the table wrapper to be selected.
      const selectedAncestor = block.parentElement?.closest(LIST_BLOCK_SELECTOR);
      if (
        selectedAncestor &&
        scope.contains(selectedAncestor) &&
        selectedAncestor !== scope
      ) return false;
      try {
        return range.intersectsNode(block);
      } catch {
        return false;
      }
    });
    const targets = blocks.length || promotedBlocks.length
      ? [...new Set([...blocks, ...promotedBlocks])].sort((left, right) =>
          left.compareDocumentPosition(right) & Node.DOCUMENT_POSITION_PRECEDING
            ? 1
            : -1,
        )
      : [anchor?.closest(LIST_BLOCK_SELECTOR)].filter(
          (block) => block && block !== scope && scope.contains(block),
        );
    if (!targets.length) return false;
    const list = createListFromBlocks(tagName, targets);
    if (!list) return false;
    applyListStyle(list, requestedStyle);
    normalizeFontSizeFormatting(list);
    placeCaret(core, selection, list);
    commit(core);
    return true;
  }

  // Converts selected blocks to a semantic unordered list, or toggles it off.
  function bulletList(core, options) {
    return runListCommand(core, "insertUnorderedList", options);
  }

  // Converts selected blocks to a semantic ordered list, or toggles it off.
  function numberList(core, options) {
    return runListCommand(core, "insertOrderedList", options);
  }

  // Style selectors create a list when needed and only change its marker when
  // already inside one. The adjacent main buttons remain ordinary toggles.
  function setBulletListStyle(core, style) {
    return bulletList(core, { style });
  }

  function setNumberListStyle(core, style) {
    return numberList(core, { style });
  }

  function applyVisualIndent(element, direction) {
    const current = Number.parseFloat(element.style.marginInlineStart) || 0;
    const next = Math.max(0, current + direction * 36);
    if (next === current) return false;
    if (next) element.style.marginInlineStart = `${next}px`;
    else element.style.removeProperty("margin-inline-start");
    return true;
  }

  /**
   * Moves the active list item one level deeper, or visually indents ordinary
   * selected blocks. This is kept independent of deprecated execCommand
   * indent behavior so the toolbar works consistently in every browser.
   */
  function changeIndent(core, direction) {
    core.restoreSelection();
    core.editor.focus({ preventScroll: true });
    const selection = global.getSelection();
    const range = selection?.rangeCount ? selection.getRangeAt(0) : null;
    if (!range || !core.isRangeInside(range)) return false;
    const anchor =
      range.startContainer.nodeType === Node.ELEMENT_NODE
        ? range.startContainer
        : range.startContainer.parentElement;
    const listItem = anchor?.closest("li");

    if (listItem && core.editor.contains(listItem)) {
      const list = listItem.parentElement;
      if (direction > 0) {
        const previous = listItem.previousElementSibling;
        if (previous?.tagName === "LI") {
          let nested = [...previous.children].find(
            (child) => child.tagName === list.tagName,
          );
          if (!nested) {
            nested = document.createElement(list.tagName.toLowerCase());
            previous.append(nested);
          }
          nested.append(listItem);
        } else if (!applyVisualIndent(list, direction)) {
          return false;
        }
      } else {
        const parentItem = list.parentElement;
        if (parentItem?.tagName === "LI") {
          parentItem.after(listItem);
          if (!list.children.length) list.remove();
        } else if (!applyVisualIndent(list, direction)) {
          return false;
        }
      }
      placeCaret(core, selection, listItem);
      return commit(core);
    }

    // Contenteditable can leave the first typed line as raw text, especially
    // in a table cell. Give that line a paragraph before applying indentation
    // so the command never climbs out and indents the table wrapper instead.
    const scope = listScope(core, anchor);
    const promotedBlocks = promoteSelectedRootInlineContent(scope, range);
    const blocks = [
      ...scope.querySelectorAll(LIST_BLOCK_SELECTOR),
    ].filter((block) => {
      if (!scope.contains(block)) return false;
      const selectedAncestor = block.parentElement?.closest(LIST_BLOCK_SELECTOR);
      if (
        selectedAncestor &&
        scope.contains(selectedAncestor) &&
        selectedAncestor !== scope
      ) return false;
      try {
        return range.intersectsNode(block);
      } catch {
        return false;
      }
    });
    blocks.push(...promotedBlocks);
    if (!blocks.length && anchor !== scope) {
      const block = anchor?.closest(LIST_BLOCK_SELECTOR);
      if (block && block !== scope && scope.contains(block)) blocks.push(block);
    }
    if (!blocks.length) return false;
    let changed = false;
    [...new Set(blocks)].forEach((block) => {
      changed = applyVisualIndent(block, direction) || changed;
    });
    if (!changed) return false;
    placeCaret(core, selection, blocks.at(-1));
    return commit(core);
  }

  function increaseIndent(core) {
    return changeIndent(core, 1);
  }

  function decreaseIndent(core) {
    return changeIndent(core, -1);
  }

  function multilevelList(core, options = {}) {
    core.restoreSelection();
    const selection = global.getSelection();
    const node =
      selection?.anchorNode?.nodeType === Node.ELEMENT_NODE
        ? selection.anchorNode
        : selection?.anchorNode?.parentElement;
    const listItem = node?.closest("li");
    if (!listItem) {
      bulletList(core);
      return true;
    }
    const levels = Math.min(8, Math.max(1, Number(options.levels) || 1));
    for (let index = 0; index < levels; index += 1) {
      if (!increaseIndent(core)) break;
    }
    listItem.closest("ul,ol")?.classList.add("editra-multilevel-list");
    return commit(core);
  }

  async function todoList(core, options = {}) {
    core.restoreSelection();
    const selection = global.getSelection();
    if (!selection?.rangeCount) return false;
    const range = selection.getRangeAt(0);
    if (!core.isRangeInside(range)) return false;
    const selectedText =
      String(options.text ?? range.toString()).trim() || "Task";
    const items = selectedText
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
    const anchor =
      range.startContainer.nodeType === Node.ELEMENT_NODE
        ? range.startContainer
        : range.startContainer.parentElement;
    const selectedBlocks = [...core.editor.querySelectorAll(LIST_BLOCK_SELECTOR)]
      .filter((block) => {
        const selectedAncestor = block.parentElement?.closest(LIST_BLOCK_SELECTOR);
        if (selectedAncestor && selectedAncestor !== core.editor) return false;
        try {
          return range.intersectsNode(block);
        } catch {
          return false;
        }
      });
    if (!selectedBlocks.length) {
      const nearest = anchor?.closest(LIST_BLOCK_SELECTOR);
      if (nearest && nearest !== core.editor && core.editor.contains(nearest)) {
        selectedBlocks.push(nearest);
      }
    }

    // Reuse semantic list conversion for selected blocks. Keeping the original
    // H1-H6 or paragraph inside each LI makes TODO + heading combinations valid.
    if (selectedBlocks.length) {
      const list = createListFromBlocks("ul", selectedBlocks);
      list.className = "editra-todo-list";
      [...list.children].forEach((item) => {
        item.className = "editra-todo-item";
        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.contentEditable = "false";
        checkbox.tabIndex = -1;
        checkbox.setAttribute("aria-label", `Mark ${item.textContent.trim() || "task"} complete`);
        item.prepend(checkbox);
      });
      const target = list.lastElementChild?.querySelector(LIST_BLOCK_SELECTOR) ||
        list.lastElementChild;
      if (target) placeCaret(core, selection, target);
      return commit(core);
    }

    const list = document.createElement("ul");
    list.className = "editra-todo-list";
    for (let start = 0; start < items.length; start += 300) {
      const fragment = document.createDocumentFragment();
      items.slice(start, start + 300).forEach((text) => {
        const item = document.createElement("li");
        item.className = "editra-todo-item";
        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.contentEditable = "false";
        checkbox.tabIndex = -1;
        checkbox.setAttribute("aria-label", `Mark ${text} complete`);
        const content = document.createElement("span");
        content.textContent = text;
        item.append(checkbox, content);
        fragment.append(item);
      });
      list.append(fragment);
      if (start + 300 < items.length) await nextFrame();
    }
    range.deleteContents();
    range.insertNode(list);
    const caret = document.createRange();
    caret.selectNodeContents(list.lastElementChild.querySelector("span"));
    caret.collapse(false);
    selection.removeAllRanges();
    selection.addRange(caret);
    core.selection = caret.cloneRange();
    return commit(core);
  }

  async function listsStressTest(core, options = {}) {
    const items = Math.max(1000, Number(options.items) || 10000);
    const container = document.createElement("div");
    const list = document.createElement("ul");
    list.className = "editra-multilevel-list";
    container.append(list);
    const startedAt = performance.now();
    for (let start = 0; start < items; start += 500) {
      const fragment = document.createDocumentFragment();
      const end = Math.min(start + 500, items);
      for (let index = start; index < end; index += 1) {
        const item = document.createElement("li");
        item.textContent = `Large document list item ${index + 1}`;
        item.style.marginInlineStart = `${(index % 4) * 18}px`;
        fragment.append(item);
      }
      list.append(fragment);
      if (end < items) await nextFrame();
    }
    return {
      items,
      htmlBytes: new Blob([container.innerHTML]).size,
      durationMs: Math.round(performance.now() - startedAt),
    };
  }

  function install(core) {
    if (installations.has(core)) return installations.get(core);
    const unregisterCommands = [];
    const commands = {
      bulletList: (options) => bulletList(core, options),
      numberList: (options) => numberList(core, options),
      setBulletListStyle: (style) => setBulletListStyle(core, style),
      setNumberListStyle: (style) => setNumberListStyle(core, style),
      multilevelList: (options) => multilevelList(core, options),
      todoList: (options) => todoList(core, options),
      increaseIndent: () => increaseIndent(core),
      decreaseIndent: () => decreaseIndent(core),
      listsStressTest: (options) => listsStressTest(core, options),
    };
    Object.entries(commands).forEach(([name, handler]) => {
      unregisterCommands.push(
        core.registerCommand(name, handler, {
          plugin: "lists",
          source: "plugin",
        }),
      );
    });

    function handleChange(event) {
      const checkbox = event.target.closest?.(".editra-todo-item input");
      if (!checkbox || !core.editor.contains(checkbox)) return;
      checkbox.closest(".editra-todo-item")?.classList.toggle(
        "is-complete",
        checkbox.checked,
      );
      checkbox.toggleAttribute("checked", checkbox.checked);
      commit(core);
    }

    function handleKeydown(event) {
      if (event.key !== "Tab") return;
      const node =
        global.getSelection()?.anchorNode?.nodeType === Node.ELEMENT_NODE
          ? global.getSelection().anchorNode
          : global.getSelection()?.anchorNode?.parentElement;
      if (!node?.closest("li") || !core.editor.contains(node)) return;
      event.preventDefault();
      if (event.shiftKey) decreaseIndent(core);
      else increaseIndent(core);
    }

    core.editor.addEventListener("change", handleChange);
    core.editor.addEventListener("keydown", handleKeydown);
    const state = { unregisterCommands };
    core.registerCleanup(() => {
      core.editor.removeEventListener("change", handleChange);
      core.editor.removeEventListener("keydown", handleKeydown);
      unregisterCommands.forEach((unregister) => unregister());
      installations.delete(core);
    });
    installations.set(core, state);
    return state;
  }

  function ListsPlugin(core) {
    install(core);
    return bulletList(core);
  }

  ListsPlugin.install = install;
  ListsPlugin.hydrate = install;
  ListsPlugin.plugin = Object.freeze({
    name: "lists",
    label: "Bullet list",
    command: "bulletList",
  });

  global.ListsPlugin = ListsPlugin;
  (global.EditraPlugins ??= Object.create(null)).lists = ListsPlugin;
})(window);
