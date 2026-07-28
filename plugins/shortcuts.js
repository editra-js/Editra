(function (global) {
  "use strict";

  const installations = new WeakMap();
  const SHORTCUTS = Object.freeze({
    b: "bold",
    i: "italic",
    u: "underline",
    s: "save",
    a: "select-all",
    f: "findReplace",
    k: "link",
  });
  const NATIVE_SHORTCUTS = new Set(["c", "x", "v"]);
  const SHORTCUT_REFERENCE = Object.freeze([
    ["Ctrl/Cmd+B", "Bold"],
    ["Ctrl/Cmd+I", "Italic"],
    ["Ctrl/Cmd+U", "Underline"],
    ["Ctrl/Cmd+S", "Save"],
    ["Ctrl/Cmd+A", "Select all"],
    ["Ctrl/Cmd+F", "Find and replace"],
    ["Ctrl/Cmd+K", "Insert link"],
    ["Ctrl/Cmd+P", "Print"],
    ["Ctrl/Cmd+Z", "Undo"],
    ["Ctrl/Cmd+Shift+Z", "Redo"],
    ["Ctrl/Cmd+Y", "Redo"],
    ["Ctrl/Cmd+Shift+7", "Numbered list"],
    ["Ctrl/Cmd+Shift+8", "Bulleted list"],
    ["Ctrl/Cmd+C / X / V", "Native copy, cut, and paste"],
    ["Tab", "Next table cell or insert tab"],
    ["Shift+Tab", "Previous table cell or decrease indent"],
    ["Delete / Backspace", "Delete the selected object or table"],
  ]);

  function cellForSelection(core) {
    const selection = global.getSelection();
    if (!selection?.rangeCount) return null;
    const node = selection.anchorNode;
    const element = node?.nodeType === Node.ELEMENT_NODE ? node : node?.parentElement;
    const cell = element?.closest("td,th");
    return cell && core.editor.contains(cell) ? cell : null;
  }

  function focusCell(core, cell) {
    const range = document.createRange();
    range.selectNodeContents(cell);
    range.collapse(true);
    const selection = global.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
    core.selection = range.cloneRange();
    core.editor.focus({ preventScroll: true });
  }

  function handleTableTab(core, backwards) {
    const cell = cellForSelection(core);
    if (!cell) return false;
    const cells = [...cell.closest("table").querySelectorAll("th,td")];
    const index = cells.indexOf(cell);
    const target = cells[index + (backwards ? -1 : 1)];
    if (target) {
      focusCell(core, target);
      return true;
    }
    if (!backwards) {
      const row = cell.closest("tr");
      const clone = row.cloneNode(true);
      clone.querySelectorAll("th,td").forEach((item) => {
        item.removeAttribute("rowspan");
        item.removeAttribute("colspan");
        item.innerHTML = "<br>";
      });
      row.parentElement.append(clone);
      focusCell(core, clone.querySelector("th,td"));
      core.recordHistory();
      core.scheduleUpdate("shortcut-table-row", () => core.emitChange());
      return true;
    }
    return false;
  }

  function insertTab(core) {
    core.restoreSelection();
    const selection = global.getSelection();
    if (!selection?.rangeCount) return false;
    const range = selection.getRangeAt(0);
    if (!core.isRangeInside(range)) return false;
    range.deleteContents();
    const tab = document.createElement("span");
    tab.className = "editra-tab";
    tab.dataset.editraTab = "true";
    const caretRect = [...range.getClientRects()].at(-1);
    const editorRect = core.editor.getBoundingClientRect();
    const current =
      (caretRect?.left ?? editorRect.left + Number.parseFloat(
        getComputedStyle(core.editor).paddingLeft,
      )) - editorRect.left;
    const stops = [...(core.state.ruler?.tabStops ?? [])].sort(
      (a, b) => a - b,
    );
    const target = stops.find((position) => position > current + 2);
    const width = Math.max(16, (target ?? current + 40) - current);
    tab.style.width = `${Math.round(width)}px`;
    tab.dataset.editraTabStop = String(Math.round(target ?? current + width));
    tab.textContent = "\u00a0";
    range.insertNode(tab);
    range.setStartAfter(tab);
    range.collapse(true);
    selection.removeAllRanges();
    selection.addRange(range);
    core.selection = range.cloneRange();
    core.recordHistory();
    core.scheduleUpdate("shortcut-tab", () => core.emitChange());
    return true;
  }

  function handleKeydown(core, event) {
    if (event.defaultPrevented || event.isComposing) return;
    const modifier = event.ctrlKey || event.metaKey;
    const key = event.key.toLowerCase();

    if (event.key === "Tab") {
      event.preventDefault();
      if (handleTableTab(core, event.shiftKey)) return;
      if (event.shiftKey) {
        const result = core.executeCommand("decreaseIndent");
        if (result !== false) return;
      }
      insertTab(core);
      return;
    }

    if (!modifier || event.altKey) {
      if (
        event.key === "Delete" ||
        event.key === "Backspace"
      ) {
        const selectedTable = core.editor.querySelector(
          ".editra-table-frame.is-table-selected table",
        );
        if (selectedTable) {
          event.preventDefault();
          event.stopImmediatePropagation();
          core.executeCommand("deleteTable", { table: selectedTable });
          return;
        }
      }
      if (
        (event.key === "Delete" || event.key === "Backspace") &&
        !global.getSelection()?.isCollapsed
      ) {
        event.preventDefault();
        core.restoreSelection();
        core.execCommand(event.key === "Delete" ? "forwardDelete" : "delete");
      }
      return;
    }

    // Native clipboard shortcuts retain browser permission and rich clipboard data.
    if (NATIVE_SHORTCUTS.has(key)) return;

    if (event.shiftKey && (key === "7" || key === "8")) {
      event.preventDefault();
      event.stopImmediatePropagation();
      core.executeCommand(key === "7" ? "numberList" : "bulletList");
      return;
    }

    let command = SHORTCUTS[key];
    if (key === "z") command = event.shiftKey ? "redo" : "undo";
    if (key === "y") command = "redo";
    if (key === "p") command = "print";
    if (!command) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    core.executeCommand(command);
  }

  function install(core) {
    if (installations.has(core)) return installations.get(core);
    const listener = (event) => handleKeydown(core, event);
    core.editor.addEventListener("keydown", listener, true);
    const unregisterCommand = core.registerCommand(
      "getShortcuts",
      () => ({
        ...SHORTCUTS,
        z: "undo",
        "shift+z": "redo",
        y: "redo",
        "shift+7": "numberList",
        "shift+8": "bulletList",
        tab: "tab",
        reference: SHORTCUT_REFERENCE.map(([keys, description]) => ({
          keys,
          description,
        })),
      }),
      { plugin: "shortcuts", source: "plugin" },
    );
    const state = { listener, unregisterCommand };
    core.registerCleanup(() => {
      core.editor.removeEventListener("keydown", listener, true);
      unregisterCommand();
      installations.delete(core);
    });
    installations.set(core, state);
    return state;
  }

  function ShortcutsPlugin(core) {
    return install(core);
  }

  ShortcutsPlugin.install = install;
  ShortcutsPlugin.hydrate = install;
  ShortcutsPlugin.plugin = Object.freeze({
    name: "shortcuts",
    label: "Keyboard shortcuts",
  });
  global.ShortcutsPlugin = ShortcutsPlugin;
  (global.EditraPlugins ??= Object.create(null)).shortcuts = ShortcutsPlugin;
})(window);
