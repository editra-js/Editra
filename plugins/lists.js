// Version: 2.0.0
/**
 * Product: Editra
 * Author: Editra Team
 * Version: 2.0.0
 * Purpose: Implements the Editra lists plugin and its editor commands.
 * Licensing: MIT License (open source)
 */

(function (global) {
  "use strict";

  const installations = new WeakMap();

  function nextFrame() {
    return new Promise((resolve) => requestAnimationFrame(resolve));
  }

  function commit(core) {
    core.captureSelection();
    core.recordHistory();
    core.scheduleUpdate("lists-change", () => core.emitChange());
    return true;
  }

  function runListCommand(core, command) {
    core.restoreSelection();
    core.editor.focus({ preventScroll: true });
    const tagName =
      command === "insertOrderedList"
        ? "OL"
        : command === "insertUnorderedList"
          ? "UL"
          : null;
    const selection = global.getSelection();
    const range = selection?.rangeCount ? selection.getRangeAt(0) : null;
    const anchor =
      selection?.anchorNode?.nodeType === Node.ELEMENT_NODE
        ? selection.anchorNode
        : selection?.anchorNode?.parentElement;
    const currentList = tagName ? anchor?.closest("ul,ol") : null;
    const before = core.editor.innerHTML;
    const result = core.execCommand(command);
    if (core.editor.innerHTML !== before || !tagName || !range) {
      commit(core);
      return result;
    }

    if (currentList && core.editor.contains(currentList)) {
      if (currentList.tagName !== tagName) {
        const replacement = document.createElement(tagName.toLowerCase());
        replacement.className = currentList.className;
        replacement.append(...currentList.childNodes);
        currentList.replaceWith(replacement);
      } else {
        const fragment = document.createDocumentFragment();
        [...currentList.children].forEach((item) => {
          if (item.tagName !== "LI") return;
          const paragraph = document.createElement("p");
          paragraph.append(...item.childNodes);
          if (!paragraph.hasChildNodes()) paragraph.append(document.createElement("br"));
          fragment.append(paragraph);
        });
        currentList.replaceWith(fragment);
      }
      commit(core);
      return true;
    }

    const blocks = [
      ...core.editor.querySelectorAll("p,div,h1,h2,h3,h4,h5,h6,blockquote,pre"),
    ].filter((block) => {
      if (block.parentElement !== core.editor) return false;
      try {
        return range.intersectsNode(block);
      } catch {
        return false;
      }
    });
    const targets = blocks.length
      ? blocks
      : [anchor?.closest("p,div,h1,h2,h3,h4,h5,h6,blockquote,pre")].filter(
          (block) => block?.parentElement === core.editor,
        );
    if (!targets.length) return result;
    const list = document.createElement(tagName.toLowerCase());
    targets[0].before(list);
    targets.forEach((block) => {
      const item = document.createElement("li");
      item.append(...block.childNodes);
      if (!item.hasChildNodes()) item.append(document.createElement("br"));
      list.append(item);
      block.remove();
    });
    const nextRange = document.createRange();
    nextRange.selectNodeContents(list.firstElementChild);
    nextRange.collapse(false);
    selection.removeAllRanges();
    selection.addRange(nextRange);
    core.selection = nextRange.cloneRange();
    commit(core);
    return true;
  }

  function bulletList(core) {
    return runListCommand(core, "insertUnorderedList");
  }

  function numberList(core) {
    return runListCommand(core, "insertOrderedList");
  }

  function increaseIndent(core) {
    return runListCommand(core, "indent");
  }

  function decreaseIndent(core) {
    return runListCommand(core, "outdent");
  }

  function multilevelList(core, options = {}) {
    const selection = global.getSelection();
    core.restoreSelection();
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
      core.execCommand("indent");
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
      bulletList: () => bulletList(core),
      numberList: () => numberList(core),
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
