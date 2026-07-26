/**
 * Product: Editra
 * Author: Editra Team
 * Version: 1.16.0
 * Purpose: Builds the configurable Editra toolbar and its accessible controls.
 * Licensing: MIT License (open source)
 */

(function (global) {
  "use strict";

  const ICONS = Object.freeze({
    bold: '<path d="M7 4h6a4 4 0 0 1 0 8H7zm0 8h7a4 4 0 0 1 0 8H7z"/>',
    italic: '<path d="M10 4h8M6 20h8M14 4 10 20"/>',
    underline:
      '<path d="M7 4v7a5 5 0 0 0 10 0V4M5 21h14"/>',
    table:
      '<rect x="3" y="4" width="18" height="16" rx="1"/><path d="M3 10h18M3 15h18M9 4v16M15 4v16"/>',
    image:
      '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m4 18 5-5 3 3 3-3 5 5"/>',
    video:
      '<rect x="3" y="5" width="14" height="14" rx="2"/><path d="m17 10 4-2v8l-4-2z"/>',
    undo: '<path d="m9 7-5 5 5 5M5 12h8a6 6 0 0 1 6 6"/>',
    redo: '<path d="m15 7 5 5-5 5M19 12h-8a6 6 0 0 0-6 6"/>',
    formatPainter:
      '<path d="M4 4h12v5H4zM7 9v4h6V9M10 13v7M8 20h4"/>',
    trackChanges:
      '<path d="M5 4h10l4 4v12H5zM15 4v5h5M8 13h8M8 17h5"/><path d="m7 8 1.5 1.5L11 7"/>',
    comment:
      '<path d="M4 5h16v12H9l-5 4z"/><path d="M8 9h8M8 13h5"/>',
    textColor: '<path d="M6 19h12M8 16l4-11 4 11M9.5 12h5"/>',
    palette:
      '<path d="M12 3a9 9 0 1 0 0 18h1.5a2 2 0 0 0 0-4H12a2 2 0 0 1 0-4h5a4 4 0 0 0 4-4c0-3.3-4-6-9-6z"/><circle cx="7.5" cy="9" r=".8"/><circle cx="10" cy="6.5" r=".8"/><circle cx="14" cy="6.5" r=".8"/><circle cx="17" cy="9" r=".8"/>',
    highlighter:
      '<path d="m7 14 7-7 4 4-7 7H7zM14 7l2-2 4 4-2 2M4 21h16"/>',
    strikethrough:
      '<path d="M6 8c0-2 2-4 6-4s6 2 6 4M7 16c1 3 9 4 11 0M4 12h16"/>',
    bulletList:
      '<path d="M9 6h11M9 12h11M9 18h11"/><circle cx="4.5" cy="6" r="1"/><circle cx="4.5" cy="12" r="1"/><circle cx="4.5" cy="18" r="1"/>',
    numberList:
      '<path d="M9 6h11M9 12h11M9 18h11M3 5h2v3M3 11h2l-2 3h2M3 17h2v3H3"/>',
    multilevelList: '<path d="M10 6h10M13 12h7M13 18h7M4 6h2M7 12h2M7 18h2"/>',
    todoList:
      '<rect x="3" y="4" width="5" height="5" rx="1"/><path d="m4 6 1.3 1.3L8 4.5M11 6h10M3 14h5v5H3zM11 16h10"/>',
    indent: '<path d="M9 6h11M9 12h11M9 18h11M3 9l4 3-4 3"/>',
    outdent: '<path d="M9 6h11M9 12h11M9 18h11M7 9l-4 3 4 3"/>',
    emoji:
      '<circle cx="12" cy="12" r="9"/><circle cx="9" cy="10" r=".7"/><circle cx="15" cy="10" r=".7"/><path d="M8 14c1 3 7 3 8 0"/>',
    codeBlock: '<path d="m8 8-4 4 4 4M16 8l4 4-4 4M14 5l-4 14"/>',
    horizontalLine: '<path d="M4 12h16"/>',
    pageBreak: '<path d="M4 7h16M4 17h16M8 12h8M12 9v6"/>',
    keepTogether:
      '<path d="M6 4h12v6H6zM6 14h12v6H6zM12 10v4M9 12h6"/>',
    keepWithNext:
      '<path d="M5 4h14v6H5zM5 15h14v5H5zM12 10v5M9 12l3 3 3-3"/>',
    toc: '<path d="M4 5h16M4 10h12M4 15h16M4 20h10"/>',
    codeView: '<path d="m8 7-5 5 5 5M16 7l5 5-5 5M14 4l-4 16"/>',
    borderColor: '<rect x="4" y="4" width="16" height="16"/><path d="M4 17h16"/>',
  });

  class Toolbar {
    constructor(core, plugins, layout) {
      this.core = core;
      this.plugins = plugins;
      this.buttons = new Map();
      this.controls = new Map();
      this.handleClick = this.handleClick.bind(this);
      this.handleChange = this.handleChange.bind(this);
      this.preserveSelection = this.preserveSelection.bind(this);

      this.element = document.createElement("div");
      this.element.className = "editra-toolbar";
      this.element.setAttribute("role", "toolbar");
      this.element.setAttribute("aria-label", "Editor toolbar");

      const available = new Map();
      plugins.forEach((plugin) => {
        available.set(plugin.name, plugin);
        if (plugin.command) available.set(plugin.command, plugin);
        (plugin.toolbarItems ?? []).forEach((control) => {
          const merged = { ...plugin, ...control };
          available.set(control.name, merged);
          if (control.command) {
            available.set(control.command, merged);
          }
          (control.aliases ?? []).forEach((alias) => available.set(alias, merged));
        });
      });
      available.forEach((control) => {
        if (control.command) this.controls.set(control.command, control);
      });
      const defaultItems = plugins
        .filter((plugin) => !plugin.hidden)
        .flatMap((plugin) =>
          plugin.toolbarItems?.length
            ? plugin.toolbarItems.map((control) => control.name)
            : [plugin.name],
        );
      const groups = this.parseLayout(
        layout,
        available,
        defaultItems,
      );
      const fragment = document.createDocumentFragment();

      groups.forEach((group, groupIndex) => {
        if (groupIndex > 0) {
          const separator = document.createElement("span");
          separator.className = "editra-toolbar-separator";
          separator.setAttribute("aria-hidden", "true");
          fragment.append(separator);
        }

        group.forEach((item) => {
          const control = available.get(item) ?? this.coreControl(item);
          if (!control) return;
          const element = this.createControl(control.command ?? item, control);
          this.buttons.set(item, element);
          fragment.append(element);
        });
      });

      this.element.append(fragment);
      this.card = document.createElement("section");
      this.card.className = "editra-card";
      this.card.setAttribute("aria-label", "Editra rich text editor");
      core.editor.before(this.card);
      this.workspace = document.createElement("div");
      this.workspace.className = "editra-page-workspace";
      this.workspace.append(core.editor);
      this.card.append(this.element, this.workspace);

      this.element.addEventListener("mousedown", this.preserveSelection);
      this.element.addEventListener("click", this.handleClick);
      this.element.addEventListener("change", this.handleChange);
      core.notifyUI("toolbarBuild", {
        element: this.element,
        tools: [...this.buttons.keys()],
        visible: true,
      });
    }

    createButton(command, control) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "editra-tool";
      button.dataset.command = command;
      if (control.name) button.dataset.plugin = control.name;
      button.setAttribute("aria-label", control.label);
      button.title = control.shortcut
        ? `${control.label} (${this.shortcutLabel(control.shortcut)})`
        : control.label;

      const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      svg.setAttribute("viewBox", "0 0 24 24");
      svg.setAttribute("aria-hidden", "true");
      svg.setAttribute("focusable", "false");
      svg.classList.add("editra-tool-icon");
      svg.innerHTML = ICONS[control.icon] ?? ICONS[command] ?? ICONS.bold;
      button.append(svg);
      return button;
    }

    createControl(command, control) {
      if (control.type === "select") {
        const select = document.createElement("select");
        select.className = "editra-tool-select";
        select.dataset.command = command;
        if (control.name) select.dataset.plugin = control.name;
        select.setAttribute("aria-label", control.label);
        select.title = control.label;
        (control.options ?? []).forEach(([value, label]) => {
          const option = document.createElement("option");
          option.value = value;
          option.textContent = label;
          option.selected = value === control.value;
          select.append(option);
        });
        return select;
      }
      if (control.type === "color") {
        const label = document.createElement("label");
        label.className = "editra-tool editra-color-tool";
        if (control.name) label.dataset.plugin = control.name;
        label.setAttribute("aria-label", control.label);
        label.title = control.label;
        const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        svg.setAttribute("viewBox", "0 0 24 24");
        svg.setAttribute("aria-hidden", "true");
        svg.classList.add("editra-tool-icon");
        svg.innerHTML = ICONS[control.icon] ?? ICONS.palette;
        const input = document.createElement("input");
        input.type = "color";
        input.value = control.value ?? "#000000";
        input.dataset.command = command;
        input.setAttribute("aria-label", control.label);
        label.append(svg, input);
        return label;
      }
      return this.createButton(command, control);
    }

    parseLayout(layout, available, defaultItems) {
      const fallback = `${defaultItems.join(" ")} | undo redo`;
      const source =
        typeof layout === "string" && layout.trim() ? layout.trim() : fallback;
      const coreControls = new Set(["undo", "redo"]);

      return source
        .split("|")
        .map((group) =>
          group
            .trim()
            .split(/\s+/)
            .filter(
              (item) => available.has(item) || coreControls.has(item),
            ),
        )
        .filter((group) => group.length);
    }

    coreControl(name) {
      return {
        undo: { label: "Undo", icon: "undo", shortcut: "z" },
        redo: { label: "Redo", icon: "redo" },
      }[name];
    }

    shortcutLabel(key) {
      const modifier = /Mac|iPhone|iPad/.test(navigator.platform)
        ? "Cmd+"
        : "Ctrl+";
      return `${modifier}${key.toUpperCase()}`;
    }

    preserveSelection(event) {
      if (event.target.closest("button[data-command]")) event.preventDefault();
    }

    handleClick(event) {
      const control = event.target.closest("[data-command]");
      if (!control || !this.element.contains(control)) return;
      if (control.matches("select, input[type='color']")) return;
      this.core.executeCommand(control.dataset.command);
    }

    handleChange(event) {
      const control = event.target.closest("[data-command]");
      if (!control || !this.element.contains(control)) return;
      this.core.executeCommand(control.dataset.command, control.value);
    }

    update(state) {
      this.buttons.forEach((button, name) => {
        const plugin = this.core.plugins.get(button.dataset.plugin || name);
        if (name === "undo") button.disabled = !state.canUndo;
        else if (name === "redo") button.disabled = !state.canRedo;
        else button.disabled = Boolean(plugin?.disabled);
      });
    }

    getButton(name) {
      return (
        this.buttons.get(name) ||
        this.element.querySelector(`[data-plugin="${name}"]`)
      );
    }

    getControl(command) {
      return this.controls.get(command) ?? null;
    }

    destroy() {
      this.element.removeEventListener("mousedown", this.preserveSelection);
      this.element.removeEventListener("click", this.handleClick);
      this.element.removeEventListener("change", this.handleChange);
      this.buttons.clear();
      this.controls.clear();

      if (this.card?.isConnected) {
        this.card.before(this.core.editor);
        this.card.remove();
      }
    }
  }

  global.EditraToolbar = Toolbar;
})(window);
