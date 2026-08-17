/**
 * Builds the editor toolbar from active plugin definitions.
 * Selection is captured before toolbar interaction and restored before command
 * execution so clicking a control does not lose the formatting target.
 */
(function (global) {
  "use strict";

  const toolbarScript = document.currentScript;
  const defaultIconBase = new URL(
    "../assets/icons/",
    toolbarScript?.src || document.baseURI,
  );
  const ICONS = Object.freeze({
    bold: "bold.svg",
    italic: "italic.svg",
    underline: "underline.svg",
    table: "table.svg",
    image: "image.svg",
    video: "video.svg",
    undo: "undo.svg",
    redo: "redo.svg",
    formatPainter: "format-painter.svg",
    trackChanges: "track-changes.svg",
    comment: "comment.svg",
    textColor: "text-color.svg",
    palette: "palette.svg",
    highlighter: "highlighter.svg",
    strikethrough: "strikethrough.svg",
    superscript: "superscript.svg",
    subscript: "subscript.svg",
    blockQuote: "block-quote.svg",
    bulletList: "bullet-list.svg",
    numberList: "number-list.svg",
    multilevelList: "multilevel-list.svg",
    todoList: "todo-list.svg",
    indent: "indent.svg",
    outdent: "outdent.svg",
    emoji: "emoji.svg",
    specialCharacters: "special-characters.svg",
    dateTime: "date-time.svg",
    barcode: "barcode.svg",
    qrCode: "qr-code.svg",
    codeBlock: "code-block.svg",
    horizontalLine: "horizontal-line.svg",
    pageBreak: "page-break.svg",
    keepTogether: "keep-together.svg",
    keepWithNext: "keep-with-next.svg",
    toc: "toc.svg",
    codeView: "code-view.svg",
    borderColor: "border-color.svg",
  });

  /** Creates an accessible SVG icon from the shared icon definition. */
  function createIcon(core, name) {
    const image = document.createElement("img");
    const configuredBase = core.options.iconBaseUrl
      ? new URL(core.options.iconBaseUrl, document.baseURI)
      : defaultIconBase;
    image.className = "editra-tool-icon";
    image.src = new URL(ICONS[name] ?? ICONS.bold, configuredBase).href;
    image.alt = "";
    image.setAttribute("aria-hidden", "true");
    image.setAttribute("draggable", "false");
    image.dataset.icon = name;
    return image;
  }

  class Toolbar {
    /** Builds toolbar controls for one editor and the requested plugin layout. */
    constructor(core, plugins, layout) {
      this.core = core;
      this.plugins = plugins;
      this.buttons = new Map();
      this.controls = new Map();
      this.handleClick = this.handleClick.bind(this);
      this.handleInput = this.handleInput.bind(this);
      this.handleChange = this.handleChange.bind(this);
      this.handleFocusOut = this.handleFocusOut.bind(this);
      this.preserveSelection = this.preserveSelection.bind(this);
      this.interactingControl = null;
      this.pendingControlValues = new WeakMap();
      this.controlsWithPointerSelection = new WeakSet();
      this.pointerSelections = new WeakMap();

      this.element = document.createElement("div");
      this.element.className = "editra-toolbar";
      this.element.setAttribute("role", "toolbar");
      this.element.setAttribute(
        "aria-label",
        core.translate("toolbar.label", "Editor toolbar"),
      );
      this.element.setAttribute("aria-orientation", "horizontal");

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

      // Capture on pointerdown, before mouse, pen, or touch focus can replace
      // the document range. Every formatting control relies on this saved range.
      this.element.addEventListener("pointerdown", this.preserveSelection);
      this.element.addEventListener("click", this.handleClick);
      this.element.addEventListener("input", this.handleInput);
      this.element.addEventListener("change", this.handleChange);
      this.element.addEventListener("focusout", this.handleFocusOut);
      core.notifyUI("toolbarBuild", {
        element: this.element,
        tools: [...this.buttons.keys()],
        visible: true,
      });
    }

    /** Creates one command button with label, icon, and shortcut metadata. */
    createButton(command, control) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "editra-tool";
      button.dataset.command = command;
      if (control.name) button.dataset.plugin = control.name;
      const label = this.core.translate(
        `toolbar.${command}`,
        control.label,
      );
      button.setAttribute("aria-label", label);
      button.title = control.shortcut
        ? `${label} (${this.shortcutLabel(control.shortcut)})`
        : label;

      button.append(createIcon(this.core, control.icon ?? command));
      return button;
    }

    /** Creates a button, select, or color control from plugin metadata. */
    createControl(command, control) {
      if (control.type === "select") {
        const select = document.createElement("select");
        select.className = "editra-tool-select";
        select.dataset.command = command;
        if (control.name) select.dataset.plugin = control.name;
        const label = this.core.translate(
          `toolbar.${command}`,
          control.label,
        );
        select.setAttribute("aria-label", label);
        select.title = label;
        const selectedValue =
          command === "setLanguage"
            ? this.core.options.language
            : control.value;
        (control.options ?? []).forEach(([value, label]) => {
          const option = document.createElement("option");
          option.value = value;
          option.textContent = this.core.translate(
            `option.${command}.${value}`,
            label,
          );
          option.selected = value === selectedValue;
          select.append(option);
        });
        return select;
      }
      if (control.type === "color") {
        const colorControl = document.createElement("div");
        colorControl.className = "editra-tool editra-color-tool";
        colorControl.dataset.command = command;
        if (control.name) colorControl.dataset.plugin = control.name;
        const translatedLabel = this.core.translate(
          `toolbar.${command}`,
          control.label,
        );
        colorControl.setAttribute("aria-label", translatedLabel);
        colorControl.title = translatedLabel;
        const icon = createIcon(this.core, control.icon ?? "palette");
        const input = document.createElement("input");
        input.type = "color";
        input.value = control.value ?? "#000000";
        input.dataset.command = command;
        input.setAttribute("aria-label", translatedLabel);
        colorControl.append(icon, input);
        return colorControl;
      }
      return this.createButton(command, control);
    }

    /** Converts the toolbar layout string into controls and separators. */
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

    /** Returns metadata for a control implemented directly by the core. */
    coreControl(name) {
      return {
        undo: { label: "Undo", icon: "undo", shortcut: "z" },
        redo: { label: "Redo", icon: "redo" },
      }[name];
    }

    /** Formats a platform-appropriate keyboard shortcut for a tooltip. */
    shortcutLabel(key) {
      const modifier = /Mac|iPhone|iPad/.test(navigator.platform)
        ? "Cmd+"
        : "Ctrl+";
      return `${modifier}${key.toUpperCase()}`;
    }

    /** Saves selection before a mouse, pen, or touch action moves toolbar focus. */
    preserveSelection(event) {
      const control = event.target.closest("[data-command]");
      if (!control || !this.element.contains(control)) return;
      this.core.captureSelection();
      const stateControl = control.closest(".editra-color-tool") || control;
      if (
        stateControl.matches("select, .editra-color-tool")
      ) {
        // State updates may run while a native picker is open. Remember the
        // active control so they cannot replace the user's pending choice.
        this.interactingControl = stateControl;
        this.controlsWithPointerSelection.add(stateControl);
        if (this.core.selection && this.core.isRangeInside(this.core.selection)) {
          this.pointerSelections.set(stateControl, this.core.selection.cloneRange());
        }
      }
      if (control.closest("button[data-command]")) event.preventDefault();
    }

    /** Resolves and executes a toolbar button command. */
    handleClick(event) {
      const control = event.target.closest("[data-command]");
      if (!control || !this.element.contains(control)) return;
      if (control.matches("select, input[type='color']")) return;
      const command = control.dataset.command;
      if (control.classList.contains("editra-color-tool")) {
        const definition = this.controls.get(command);
        if (this.core.menubar && definition) {
          this.core.menubar.openChooser(control, definition);
        } else {
          control.querySelector("input[type='color']")?.click();
        }
        return;
      }
      this.core.restoreSelection();
      this.core.executeCommand(
        command,
        command === "insertEmoji" || command === "special-characters"
          ? {
              anchor: control,
              explicit: command === "special-characters",
            }
          : undefined,
      );
    }

    /** Saves the value before a queued state refresh can rewrite the control. */
    handleInput(event) {
      const control = event.target.closest("[data-command]");
      if (!control || !this.element.contains(control)) return;
      const stateControl = control.closest(".editra-color-tool") || control;
      this.interactingControl = stateControl;
      this.pendingControlValues.set(stateControl, control.value);
    }

    /** Executes the command associated with a select or color input. */
    handleChange(event) {
      const control = event.target.closest("[data-command]");
      if (!control || !this.element.contains(control)) return;
      const stateControl = control.closest(".editra-color-tool") || control;
      const value = this.pendingControlValues.get(stateControl) ?? control.value;
      const hasPointerSelection = this.controlsWithPointerSelection.has(stateControl);
      const pointerSelection = this.pointerSelections.get(stateControl) || null;
      this.pendingControlValues.delete(stateControl);
      this.controlsWithPointerSelection.delete(stateControl);
      this.pointerSelections.delete(stateControl);
      this.interactingControl = null;
      // A native select can collapse the visible editor range while its popup
      // is open. Never replace the range captured on pointerdown with that
      // browser-created caret; it is the reason list/font options sometimes
      // affected only the second line. Keyboard/programmatic changes without a
      // pointer capture may still use their current live editor selection.
      const selection = global.getSelection();
      if (pointerSelection && this.core.isRangeInside(pointerSelection)) {
        this.core.selection = pointerSelection.cloneRange();
      } else if (
        !hasPointerSelection &&
        selection?.rangeCount &&
        this.core.isRangeInside(selection.getRangeAt(0))
      ) {
        this.core.captureSelection();
      }
      this.core.restoreSelection();
      this.core.executeCommand(control.dataset.command, value);
    }

    /** Releases a cancelled select/color interaction after focus moves away. */
    handleFocusOut(event) {
      if (
        this.interactingControl &&
        (this.interactingControl === event.target ||
          this.interactingControl.contains?.(event.target))
      ) {
        this.pendingControlValues.delete(this.interactingControl);
        this.controlsWithPointerSelection.delete(this.interactingControl);
        this.pointerSelections.delete(this.interactingControl);
        this.interactingControl = null;
      }
    }

    /** Synchronizes enabled, pressed, selected, and property UI with editor state. */
    update(state) {
      const stateKeyByCommand = {
        setFontFamily: "fontFamily",
        setFontSize: "fontSize",
        setForeColor: "foreColor",
        setBackgroundColor: "backgroundColor",
        highlightText: "backgroundColor",
        setHeading: "heading",
        setAlignment: "alignment",
        setLineHeight: "lineHeight",
        setLanguage: "language",
        setBulletListStyle: "bulletListStyle",
        setNumberListStyle: "numberListStyle",
      };
      const activeKeyByCommand = {
        bold: "bold",
        italic: "italic",
        underline: "underline",
        strikethrough: "strikethrough",
        superscript: "superscript",
        subscript: "subscript",
        blockQuote: "blockQuote",
        bulletList: "bulletList",
        numberList: "numberList",
        toggleKeepTogether: "keepTogether",
        KeepWithNext: "keepWithNext",
        keepWithNext: "keepWithNext",
      };
      const comparable = (value) =>
        String(value ?? "")
          .trim()
          .replace(/^['"]|['"]$/g, "")
          .toLowerCase();

      Object.entries(stateKeyByCommand).forEach(([command, stateKey]) => {
        const detected = state[stateKey];
        const definition = this.controls.get(command);
        if (
          definition &&
          detected !== null &&
          detected !== undefined &&
          detected !== ""
        ) {
          definition.value = detected;
        }
      });

      this.buttons.forEach((button, name) => {
        const plugin = this.core.plugins.get(button.dataset.plugin || name);
        const command = button.dataset.command;
        if (name === "undo") button.disabled = !state.canUndo;
        else if (name === "redo") button.disabled = !state.canRedo;
        else button.disabled = Boolean(plugin?.disabled);

        const activeKey = activeKeyByCommand[command];
        if (activeKey) {
          const active = Boolean(state[activeKey]);
          button.setAttribute("aria-pressed", String(active));
          button.classList.toggle("is-active", active);
        }

        const stateKey = stateKeyByCommand[command];
        const detected = stateKey ? state[stateKey] : null;
        if (detected === null || detected === undefined || detected === "") return;
        if (button === this.interactingControl) return;
        const definition = this.controls.get(command);
        if (definition) definition.value = detected;
        if (button instanceof HTMLSelectElement) {
          let match = [...button.options].find(
            (option) => comparable(option.value) === comparable(detected),
          );
          if (!match && command === "setFontSize") {
            const detectedPixels = Number.parseFloat(String(detected));
            if (Number.isFinite(detectedPixels) && /px$/i.test(String(detected))) {
              // Browsers expose point sizes as fractional pixels (11pt becomes
              // 14.6667px). Choose the nearest whole-pixel preset only when it
              // is genuinely close, while leaving unsupported sizes blank.
              match = [...button.options].find((option) => {
                const optionPixels = Number.parseFloat(option.value);
                return Number.isFinite(optionPixels) &&
                  Math.abs(optionPixels - detectedPixels) <= 0.5;
              });
            }
          }
          if (match) {
            button.value = match.value;
          } else {
            button.selectedIndex = -1;
          }
        } else if (button.classList.contains("editra-color-tool")) {
          const input = button.querySelector("input[type='color']");
          if (input && /^#[0-9a-f]{6}$/i.test(String(detected))) {
            input.value = String(detected);
          }
        }
      });
    }

    /** Returns a toolbar button by command name. */
    getButton(name) {
      return (
        this.buttons.get(name) ||
        this.element.querySelector(`[data-plugin="${name}"]`)
      );
    }

    /** Returns any toolbar control associated with a command. */
    getControl(command) {
      return this.controls.get(command) ?? null;
    }

    /** Releases toolbar listeners and removes the generated editor card. */
    destroy() {
      this.element.removeEventListener("pointerdown", this.preserveSelection);
      this.element.removeEventListener("click", this.handleClick);
      this.element.removeEventListener("input", this.handleInput);
      this.element.removeEventListener("change", this.handleChange);
      this.element.removeEventListener("focusout", this.handleFocusOut);
      this.interactingControl = null;
      this.pendingControlValues = new WeakMap();
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
