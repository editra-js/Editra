/**
 * Builds accessible editor menus and command pickers.
 * Menus handle viewport positioning, keyboard navigation, and selection
 * restoration. `destroy()` releases document listeners and open overlays.
 */
(function (global) {
  "use strict";

  const MENUS = Object.freeze([
    {
      label: "File",
      items: [
        ["new", "New"],
        ["open", "Open"],
        ["save", "Save"],
        null,
        ["exportPDF", "Export PDF"],
        ["exportWord", "Export Word"],
        ["exportHTML", "Export HTML"],
        ["exportMarkdown", "Export Markdown"],
        ["importWord", "Import Word"],
        ["importHTML", "Import HTML"],
        null,
        ["viewRevisionHistory", "Revision History"],
        null,
        ["print", "Print"],
        ["printContentOnly", "Print text area only"],
      ],
    },
    {
      label: "Edit",
      items: [
        ["undo", "Undo"],
        ["redo", "Redo"],
        null,
        ["cut", "Cut"],
        ["copy", "Copy"],
        ["paste", "Paste"],
        ["select-all", "Select All"],
        null,
        ["findReplace", "Find / Replace"],
      ],
    },
    {
      label: "View",
      items: [
        ["zoom", "Zoom"],
        ["fullscreen", "Fullscreen"],
        ["previewMergeFields", "Merge fields preview"],
        ["showComments", "Show Comments"],
        ["toggleCodeView", "HTML Code / Normal View"],
        ["toggleRuler", "Show / Hide Ruler"],
        ["toggleTheme", "Toggle theme"],
        ["setLanguage", "Language"],
      ],
    },
    {
      label: "Insert",
      items: [
        ["insertTable", "Table"],
        ["insertImage", "Image"],
        ["insertVideo", "Video"],
        ["link", "Link"],
        ["addComment", "Comment"],
        ["insertMergeField", "Merge Field"],
        ["insertHeader", "Header"],
        ["insertFooter", "Footer"],
        ["footnote", "Footnote"],
        ["bookmark", "Bookmark"],
        ["insertEmoji", "Emoji"],
        ["insertDateTime", "Date and time"],
        ["media", "Media"],
        ["template", "Template"],
        ["special-characters", "Special characters"],
        ["insertCodeBlock", "Code block"],
        ["insertHorizontalLine", "Horizontal line"],
        ["insertPageBreak", "Page break"],
        ["insertTableOfContents", "Table of contents"],
      ],
    },
    {
      label: "Layout",
      items: [
        ["setPageSize", "Page Size"],
        ["setOrientation", "Orientation"],
        ["setMargin", "Margins"],
        null,
        ["toggleKeepTogether", "Keep Together"],
        ["KeepWithNext", "Keep With Next"],
        ["InsertPageBreak", "Insert Page Break"],
        null,
        ["toggleRuler", "Show / Hide Ruler"],
      ],
    },
    {
      label: "Table",
      items: [
        ["insertTable", "Insert Table"],
        null,
        ["selectTable", "Select Table"],
        ["deleteTable", "Delete Table"],
        null,
        ["addRow", "Add Row"],
        ["deleteRow", "Delete Row"],
        ["addColumn", "Add Column"],
        ["deleteColumn", "Delete Column"],
      ],
    },
    {
      label: "Format",
      items: [
        ["setFontFamily", "Font Family"],
        ["setFontSize", "Font Size"],
        ["setForeColor", "Text Color"],
        ["setBackgroundColor", "Background Color"],
        ["highlightText", "Highlighter"],
        ["formatPainter", "Format Painter"],
        null,
        ["setHeading", "Headings H1-H6"],
        ["strikethrough", "Strikethrough"],
        ["superscript", "Superscript"],
        ["subscript", "Subscript"],
        ["blockQuote", "Block quote"],
        ["insertCodeBlock", "Code Block"],
        ["setCodeBlockBackground", "Code Block Background"],
        ["setAlignment", "Alignment"],
        ["setLineHeight", "Line Height"],
        null,
        ["bulletList", "Bullet List"],
        ["numberList", "Number List"],
        ["multilevelList", "Multilevel List"],
        ["todoList", "TODO List"],
        ["increaseIndent", "Increase Indent"],
        ["decreaseIndent", "Decrease Indent"],
        null,
        ["setTableBorderColor", "Table Border Color"],
        ["case-change", "Case change"],
        ["remove-format", "Remove format"],
      ],
    },
    {
      label: "Review",
      items: [
        ["trackChanges", "Track Changes"],
        ["addComment", "Add Comment"],
        ["showComments", "Show Comments"],
        null,
        ["acceptAllChanges", "Accept All Changes"],
        ["rejectAllChanges", "Reject All Changes"],
      ],
    },
    {
      label: "Help",
      items: [
        ["accessibility", "Accessibility"],
        ["about", "About"],
        ["documentation", "Documentation"],
        ["shortcutKeys", "Shortcut Keys"],
      ],
    },
  ]);
  const MENU_PLUGIN_REQUIREMENTS = Object.freeze({
    save: "export",
    print: "export",
    printContentOnly: "pagesize",
    exportPDF: "export",
    exportWord: "export",
    exportHTML: "export",
    exportMarkdown: "productivity",
    importWord: "productivity",
    importHTML: "productivity",
    viewRevisionHistory: "collaboration",
    findReplace: "productivity",
    previewMergeFields: "productivity",
    showComments: "collaboration",
    toggleCodeView: "codeview",
    toggleRuler: "ruler",
    toggleTheme: "theme",
    setLanguage: "languages",
    insertTable: "table",
    insertImage: "image",
    insertVideo: "video",
    link: "formatting",
    addComment: "collaboration",
    insertMergeField: "productivity",
    insertHeader: "headerfooter",
    insertFooter: "headerfooter",
    footnote: "structure",
    bookmark: "structure",
    insertEmoji: "structure",
    insertDateTime: "structure",
    media: "image",
    template: "structure",
    "special-characters": "structure",
    insertCodeBlock: "structure",
    setCodeBlockBackground: "structure",
    insertHorizontalLine: "structure",
    insertPageBreak: "structure",
    insertTableOfContents: "structure",
    setPageSize: "pagesize",
    setOrientation: "pagesize",
    setMargin: "margins",
    toggleKeepTogether: "pagination",
    KeepWithNext: "pagination",
    InsertPageBreak: "pagination",
    selectTable: "table",
    deleteTable: "table",
    addRow: "table",
    deleteRow: "table",
    addColumn: "table",
    deleteColumn: "table",
    setFontFamily: "fonts",
    setFontSize: "fonts",
    setForeColor: "formatting",
    setBackgroundColor: "formatting",
    highlightText: "formatting",
    formatPainter: "productivity",
    setHeading: "headings",
    strikethrough: "formatting",
    superscript: "formatting",
    subscript: "formatting",
    blockQuote: "formatting",
    setAlignment: "formatting",
    setLineHeight: "formatting",
    bulletList: "lists",
    numberList: "lists",
    multilevelList: "lists",
    todoList: "lists",
    increaseIndent: "lists",
    decreaseIndent: "lists",
    setTableBorderColor: "table",
    "case-change": "formatting",
    "remove-format": "formatting",
    trackChanges: "collaboration",
    acceptAllChanges: "collaboration",
    rejectAllChanges: "collaboration",
  });
  const TABLE_CONTEXT_COMMANDS = new Set([
    "selectTable",
    "deleteTable",
    "addRow",
    "deleteRow",
    "addColumn",
    "deleteColumn",
    "setTableBorderColor",
  ]);
  const HELP_COMMANDS = new Set([
    "accessibility",
    "about",
    "documentation",
    "shortcutKeys",
  ]);
  const MENU_CONTROLS = Object.freeze({
    setPageSize: Object.freeze({
      type: "select",
      label: "Page Size",
      options: Object.freeze(
        [
          "A3",
          "A4",
          "A5",
          "B4",
          "B5",
          "Letter",
          "Legal",
          "Executive",
          "Tabloid",
          "Ledger",
          "Statement",
          "Folio",
          "Quarto",
          "10x14",
          "C5 Envelope",
        ].map((value) => [value, value]),
      ),
    }),
    setOrientation: Object.freeze({
      type: "select",
      label: "Orientation",
      options: Object.freeze([
        ["portrait", "Portrait"],
        ["landscape", "Landscape"],
      ]),
    }),
    bulletList: Object.freeze({
      type: "select",
      label: "Bullet style",
      options: Object.freeze([
        ["disc", "Filled circle"],
        ["circle", "Hollow circle"],
        ["square", "Square"],
        ["none", "No marker"],
      ]),
    }),
    numberList: Object.freeze({
      type: "select",
      label: "Number style",
      options: Object.freeze([
        ["decimal", "1, 2, 3"],
        ["lower-alpha", "a, b, c"],
        ["upper-alpha", "A, B, C"],
        ["lower-roman", "i, ii, iii"],
        ["upper-roman", "I, II, III"],
      ]),
    }),
    insertDateTime: Object.freeze({
      type: "select",
      label: "Date and time",
      options: Object.freeze([
        ["date", "Current date"],
        ["time", "Current time"],
        ["datetime", "Current date and time"],
      ]),
    }),
    insertCodeBlock: Object.freeze({
      type: "select",
      label: "Code Block",
      options: Object.freeze([
        ["plain", "Plain text"],
        ["javascript", "JavaScript highlighting"],
        ["html", "HTML highlighting"],
        ["css", "CSS highlighting"],
        ["json", "JSON highlighting"],
      ]),
    }),
    setCodeBlockBackground: Object.freeze({
      type: "color",
      label: "Code Block Background",
      value: "#24262b",
    }),
  });
  const COLOR_SWATCHES = Object.freeze([
    "#ffffff",
    "#000000",
    "#7f7f7f",
    "#d9e1f2",
    "#f2f2f2",
    "#44546a",
    "#5b9bd5",
    "#ed7d31",
    "#a5a5a5",
    "#ffc000",
    "#4472c4",
    "#70ad47",
    "#7357d6",
    "#2864dc",
    "#157347",
    "#b42332",
    "#d97706",
    "#fff176",
    "#fff2a8",
    "#dbeafe",
    "#dcfce7",
    "#fce7f3",
    "#c00000",
    "#ff0000",
    "#ffff00",
    "#92d050",
    "#00b0f0",
    "#0070c0",
    "#002060",
    "#7030a0",
  ]);

  /** Normalizes labels and command names for configuration matching. */
  function normalize(value) {
    return String(value ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
  }

  /** Applies host menu configuration without mutating the default definitions. */
  function resolveMenus(configuration) {
    if (!configuration || typeof configuration !== "object") return MENUS;
    return Object.entries(configuration).flatMap(([menuName, requestedItems]) => {
      const definition = MENUS.find(
        (menu) => normalize(menu.label) === normalize(menuName),
      );
      if (!definition || !Array.isArray(requestedItems)) return [];
      const available = definition.items.filter(Boolean);
      const items = requestedItems.flatMap((requested) => {
        const token = normalize(
          requested?.command ?? requested?.label ?? requested,
        );
        const match = available.find(
          ([command, label]) =>
            normalize(command) === token || normalize(label) === token,
        );
        if (!match) return [];
        return [
          [
            match[0],
            typeof requested === "object" && requested.label
              ? requested.label
              : match[1],
          ],
        ];
      });
      return items.length ? [{ label: definition.label, items }] : [];
    });
  }

  /** Removes leading, trailing, and repeated menu separators. */
  function trimSeparators(items) {
    const result = [];
    items.forEach((item) => {
      if (item === null && (!result.length || result.at(-1) === null)) return;
      result.push(item);
    });
    while (result.at(-1) === null) result.pop();
    return result;
  }

  /** Filters menus to commands available in the current editor. */
  function activeMenus(core, configuration) {
    return resolveMenus(configuration)
      .map((menu) => ({
        ...menu,
        items: trimSeparators(
          menu.items.filter((item) => {
            if (!item) return true;
            if (
              core.options.theme === "Word" &&
              item[0] === "printContentOnly"
            ) {
              return false;
            }
            const requiredPlugin = MENU_PLUGIN_REQUIREMENTS[item[0]];
            return !requiredPlugin || core.plugins.has(requiredPlugin);
          }),
        ),
      }))
      .filter((menu) => menu.items.some(Boolean));
  }

  class MenuBar {
    /** Builds and binds the accessible menu bar for one editor. */
    constructor(core, card, configuration = null) {
      this.core = core;
      this.card = card;
      this.openMenu = null;
      this.openMenuList = null;
      this.chooser = null;
      this.handleClick = this.handleClick.bind(this);
      this.handlePointerDown = this.handlePointerDown.bind(this);
      this.handlePointerOver = this.handlePointerOver.bind(this);
      this.handlePointerOut = this.handlePointerOut.bind(this);
      this.handleDocumentPointer = this.handleDocumentPointer.bind(this);
      this.handleKeydown = this.handleKeydown.bind(this);
      this.handleViewportChange = this.handleViewportChange.bind(this);
      this.refreshContext = this.refreshContext.bind(this);

      this.element = document.createElement("nav");
      this.element.className = "editra-menubar";
      this.element.setAttribute(
        "aria-label",
        core.translate("menubar.label", "Editor menu"),
      );

      const fragment = document.createDocumentFragment();
      this.menus = activeMenus(core, configuration);
      this.menus.forEach((menu, index) => {
        fragment.append(this.createMenu(menu, index));
      });
      this.element.append(fragment);
      card.prepend(this.element);

      this.element.addEventListener("click", this.handleClick);
      this.element.addEventListener("mousedown", this.handlePointerDown);
      this.element.addEventListener("pointerover", this.handlePointerOver);
      this.element.addEventListener("pointerout", this.handlePointerOut);
      document.addEventListener("pointerdown", this.handleDocumentPointer);
      document.addEventListener("keydown", this.handleKeydown);
      window.addEventListener("resize", this.handleViewportChange, { passive: true });
      window.visualViewport?.addEventListener("resize", this.handleViewportChange, { passive: true });
      window.visualViewport?.addEventListener("scroll", this.handleViewportChange, { passive: true });
      this.contextObserver = new MutationObserver(() =>
        requestAnimationFrame(this.refreshContext),
      );
      this.contextObserver.observe(core.editor, {
        childList: true,
        subtree: true,
      });
      this.refreshContext();
      core.notifyUI("menuToggle", {
        visible: true,
        reason: "build",
        menus: this.menus.map((menu) => menu.label),
        element: this.element,
      });
    }

    /** Creates one menu trigger and its keyboard-navigable item list. */
    createMenu(menu, index) {
      const group = document.createElement("div");
      group.className = "editra-menu";

      const trigger = document.createElement("button");
      trigger.type = "button";
      trigger.className = "editra-menu-trigger";
      trigger.dataset.menuIndex = String(index);
      trigger.setAttribute("aria-haspopup", "menu");
      trigger.setAttribute("aria-expanded", "false");
      trigger.textContent = this.core.translate(
        `menu.${menu.label}`,
        menu.label,
      );

      const list = document.createElement("div");
      list.className = "editra-menu-list";
      list.dataset.editraUi = "true";
      list.setAttribute("role", "menu");
      list.hidden = true;

      const items = document.createDocumentFragment();
      menu.items.forEach((item) => {
        if (item === null) {
          const separator = document.createElement("div");
          separator.className = "editra-menu-separator";
          separator.setAttribute("role", "separator");
          items.append(separator);
          return;
        }

        const [command, label] = item;
        const button = document.createElement("button");
        button.type = "button";
        button.className = "editra-menu-item";
        button.dataset.command = command;
        if (TABLE_CONTEXT_COMMANDS.has(command)) {
          button.dataset.context = "table";
        }
        button.setAttribute("role", "menuitem");
        button.tabIndex = -1;
        button.textContent = this.core.translate(
          `command.${command}`,
          label,
        );
        const control = MENU_CONTROLS[command] || this.core.toolbar.getControl(command);
        if (control?.type === "select" || control?.type === "color") {
          button.classList.add("has-submenu");
          button.setAttribute("aria-haspopup", "dialog");
          button.setAttribute("aria-expanded", "false");
        }
        items.append(button);
      });

      list.append(items);
      group.append(trigger, list);
      return group;
    }

    /** Captures editor selection before a menu control takes focus. */
    handlePointerDown(event) {
      if (event.target.closest("button")) {
        this.core.captureSelection();
        event.preventDefault();
      }
    }

    /** Finds the toolbar control represented by a menu item. */
    controlFor(item) {
      return (
        MENU_CONTROLS[item?.dataset.command] ||
        this.core.toolbar.getControl(item?.dataset.command)
      );
    }

    /** Opens a menu chooser when pointer users hover a chooser item. */
    handlePointerOver(event) {
      const item = event.target.closest(".editra-menu-item.has-submenu");
      if (!item || !this.openMenuList?.contains(item) || !this.openMenu) return;
      if (item.contains(event.relatedTarget)) return;
      const control = this.controlFor(item);
      if (control?.type === "select" || control?.type === "color") {
        this.openChooser(item, control, { focus: false });
      }
    }

    /** Closes a chooser after the pointer leaves both item and overlay. */
    handlePointerOut(event) {
      const item =
        event.target.closest?.(".editra-menu-item.has-submenu") ||
        (event.currentTarget === this.chooser ? this.chooserParent : null);
      if (!item || item !== this.chooserParent) return;
      if (
        item.contains(event.relatedTarget) ||
        this.chooser?.contains(event.relatedTarget)
      ) {
        return;
      }
      clearTimeout(this.chooserCloseTimer);
      this.chooserCloseTimer = setTimeout(() => {
        if (!item.matches(":hover") && !this.chooser?.matches(":hover")) {
          this.closeChooser();
        }
      }, 140);
    }

    /** Toggles menus, opens choosers, or executes the selected command. */
    handleClick(event) {
      const trigger = event.target.closest("[data-menu-index]");
      if (trigger && this.element.contains(trigger)) {
        this.toggleMenu(trigger.closest(".editra-menu"));
        return;
      }

      const item = event.target.closest("[data-command]");
      if (
        !item ||
        (!this.element.contains(item) && !this.openMenuList?.contains(item))
      ) return;
      const control = this.controlFor(item);
      if (control?.type === "select" || control?.type === "color") {
        this.openChooser(item, control, { focus: true });
        return;
      }
      const itemRect = item.getBoundingClientRect();
      const anchorRect = {
        top: itemRect.top,
        right: itemRect.right,
        bottom: itemRect.bottom,
        left: itemRect.left,
      };
      this.closeMenus();
      const command = item.dataset.command;
      this.core.restoreSelection();
      const result = this.core.executeCommand(
        command,
        HELP_COMMANDS.has(command) ||
          command === "link" ||
          command === "insertEmoji" ||
          command === "special-characters"
          ? {
              anchor: item,
              anchorRect,
              explicit: command === "special-characters",
            }
          : undefined,
      );
      if (result && typeof result.catch === "function") {
        result.catch((error) => {
          this.core.showNotice(error.message || String(error), {
            tone: "error",
          });
        });
      }
    }

    /** Opens an accessible value chooser for a configured menu command. */
    openChooser(item, control, options = {}) {
      if (this.chooserParent === item && this.chooser?.isConnected) return;
      const command = item.dataset.command;
      this.closeChooser();
      const chooser = document.createElement("div");
      chooser.className = `editra-menu-chooser editra-popup editra-menu-chooser--${normalize(command)}`;
      chooser.dataset.editraUi = "true";
      chooser.setAttribute("role", "dialog");
      chooser.setAttribute("aria-label", control.label);
      chooser.dataset.parentCommand = command;
      item.setAttribute("aria-expanded", "true");
      chooser.style.position = "fixed";
      chooser.style.right = "auto";
      const heading = document.createElement("header");
      heading.textContent = control.label;
      const choices = document.createElement("div");
      choices.className =
        control.type === "color"
          ? "editra-menu-color-grid"
          : "editra-menu-option-list";
      const values =
        control.type === "color"
          ? [
              ...(command === "setForeColor"
                ? [["#000000", "Automatic"]]
                : [["transparent", "No Fill"]]),
              ...COLOR_SWATCHES.map((color) => [color, color]),
            ]
          : control.options ?? [];
      const currentValue = String(control.value ?? "")
        .trim()
        .replace(/^['"]|['"]$/g, "")
        .toLowerCase();
      values.forEach(([value, label]) => {
        const button = document.createElement("button");
        button.type = "button";
        button.dataset.menuValue = value;
        button.title = String(label);
        if (control.type === "color") {
          button.style.setProperty(
            "--editra-choice-color",
            value === "transparent" ? "#ffffff" : value,
          );
          button.setAttribute("aria-label", String(label));
          if (value === "transparent") {
            button.classList.add("editra-color-no-fill");
            button.title = "No Fill";
          }
        } else {
          button.textContent = label;
        }
        const selected = String(value)
          .trim()
          .replace(/^['"]|['"]$/g, "")
          .toLowerCase() === currentValue;
        button.classList.toggle("is-selected", selected);
        button.setAttribute("aria-pressed", String(selected));
        choices.append(button);
      });
      chooser.append(heading);
      chooser.append(choices);
      if (control.type === "color") {
        const advanced = document.createElement("label");
        advanced.className = "editra-advanced-color";
        const advancedText = document.createElement("span");
        advancedText.textContent = "Advanced color";
        const advancedInput = document.createElement("input");
        advancedInput.type = "color";
        advancedInput.value =
          /^#[0-9a-f]{6}$/i.test(String(control.value))
            ? control.value
            : "#000000";
        advancedInput.setAttribute(
          "aria-label",
          `Advanced ${control.label.toLowerCase()}`,
        );
        advanced.append(advancedText, advancedInput);
        chooser.append(advanced);
        const advancedChange = () => {
          this.core.executeCommand(command, advancedInput.value);
          this.closeChooser();
        };
        chooser._editraAdvanced = { input: advancedInput, advancedChange };
        advancedInput.addEventListener("change", advancedChange);
      }
      document.body.append(chooser);
      this.chooser = chooser;
      this.chooserParent = item;
      this.positionChooser();
      const choose = (event) => {
        const choice = event.target.closest("[data-menu-value]");
        if (!choice) return;
        this.core.executeCommand(command, choice.dataset.menuValue);
        this.closeChooser();
      };
      chooser._editraChoose = choose;
      chooser.addEventListener("click", choose);
      chooser.addEventListener("pointerleave", this.handlePointerOut);
      if (options.focus) {
        choices.querySelector("button")?.focus({ preventScroll: true });
      }
    }

    /** Keeps the active chooser within the visible viewport. */
    positionChooser() {
      if (!this.chooser?.isConnected || !this.chooserParent?.isConnected) return;
      const viewport = window.visualViewport;
      const viewportLeft = viewport?.offsetLeft ?? 0;
      const viewportTop = viewport?.offsetTop ?? 0;
      const viewportWidth = viewport?.width ?? window.innerWidth;
      const viewportHeight = viewport?.height ?? window.innerHeight;
      const margin = 8;
      const gap = 6;
      const parentRect = this.chooserParent.getBoundingClientRect();
      const chooserRect = this.chooser.getBoundingClientRect();
      const opensRight =
        parentRect.right + gap + chooserRect.width <=
        viewportLeft + viewportWidth - margin;
      const preferredLeft = opensRight
        ? parentRect.right + gap
        : parentRect.left - chooserRect.width - gap;
      const left = Math.max(
        viewportLeft + margin,
        Math.min(
          preferredLeft,
          viewportLeft + viewportWidth - chooserRect.width - margin,
        ),
      );
      const top = Math.max(
        viewportTop + margin,
        Math.min(
          parentRect.top,
          viewportTop + viewportHeight - chooserRect.height - margin,
        ),
      );
      this.chooser.style.left = `${Math.round(left)}px`;
      this.chooser.style.top = `${Math.round(top)}px`;
    }

    /** Removes the active chooser and all of its temporary listeners. */
    closeChooser() {
      clearTimeout(this.chooserCloseTimer);
      this.chooserCloseTimer = null;
      if (!this.chooser) return;
      this.chooser.removeEventListener("click", this.chooser._editraChoose);
      this.chooser.removeEventListener("pointerleave", this.handlePointerOut);
      if (this.chooser._editraAdvanced) {
        const { input, advancedChange } = this.chooser._editraAdvanced;
        input.removeEventListener("change", advancedChange);
      }
      this.chooser.remove();
      this.chooser = null;
      this.chooserParent?.setAttribute("aria-expanded", "false");
      this.chooserParent = null;
    }

    /** Opens the requested menu and closes any previously open menu. */
    toggleMenu(menu) {
      const shouldOpen = this.openMenu !== menu;
      this.closeMenus();
      if (!shouldOpen) return;

      const trigger = menu.querySelector(".editra-menu-trigger");
      const list = menu.querySelector(".editra-menu-list");
      list.addEventListener("click", this.handleClick);
      list.addEventListener("mousedown", this.handlePointerDown);
      list.addEventListener("pointerover", this.handlePointerOver);
      list.addEventListener("pointerout", this.handlePointerOut);
      document.body.append(list);
      list.hidden = false;
      trigger.setAttribute("aria-expanded", "true");
      menu.classList.add("is-open");
      this.openMenu = menu;
      this.openMenuList = list;
      this.positionOpenMenu();
      this.core.notifyUI("menuToggle", {
        visible: true,
        menu: menu.querySelector(".editra-menu-trigger").textContent,
        reason: "user",
      });
    }

    /** Repositions an open menu so it remains usable near viewport edges. */
    positionOpenMenu() {
      if (!this.openMenu) return;
      const trigger = this.openMenu.querySelector(".editra-menu-trigger");
      const list = this.openMenuList;
      if (!trigger || !list || list.hidden) return;
      const viewport = window.visualViewport;
      const viewportLeft = viewport?.offsetLeft ?? 0;
      const viewportTop = viewport?.offsetTop ?? 0;
      const viewportWidth = viewport?.width ?? window.innerWidth;
      const viewportHeight = viewport?.height ?? window.innerHeight;
      const margin = 8;
      const compact = window.matchMedia(
        "(max-width: 720px), (pointer: coarse) and (max-width: 960px)",
      ).matches;
      const triggerRect = trigger.getBoundingClientRect();

      list.style.position = "fixed";
      list.style.right = "auto";
      list.style.width = compact
        ? `${Math.max(0, viewportWidth - margin * 2)}px`
        : "max-content";
      list.style.maxWidth = `${Math.max(0, viewportWidth - margin * 2)}px`;
      const availableBelow =
        viewportTop + viewportHeight - triggerRect.bottom - margin;
      const availableAbove = triggerRect.top - viewportTop - margin;
      list.style.maxHeight = `${Math.min(
        520,
        Math.max(160, Math.max(availableBelow, availableAbove)),
      )}px`;
      const listRect = list.getBoundingClientRect();
      const left = compact
        ? viewportLeft + margin
        : Math.max(
            viewportLeft + margin,
            Math.min(
              triggerRect.left,
              viewportLeft + viewportWidth - listRect.width - margin,
            ),
          );
      const openBelow =
        availableBelow >= Math.min(listRect.height, 260) ||
        availableBelow >= availableAbove;
      const top = openBelow
        ? triggerRect.bottom + 4
        : Math.max(viewportTop + margin, triggerRect.top - listRect.height - 4);
      list.style.left = `${Math.round(left)}px`;
      list.style.top = `${Math.round(top)}px`;
    }

    /** Repositions open overlays after scrolling, resizing, or zooming. */
    handleViewportChange() {
      if (!this.openMenu && !this.chooser) return;
      requestAnimationFrame(() => {
        this.positionOpenMenu();
        this.positionChooser();
      });
    }

    /** Closes every menu and resets trigger accessibility state. */
    closeMenus() {
      if (!this.openMenu) return;
      this.closeChooser();
      const list = this.openMenuList;
      if (list) {
        list.hidden = true;
        list.removeEventListener("click", this.handleClick);
        list.removeEventListener("mousedown", this.handlePointerDown);
        list.removeEventListener("pointerover", this.handlePointerOver);
        list.removeEventListener("pointerout", this.handlePointerOut);
        for (const property of [
          "position", "right", "width", "maxWidth", "maxHeight", "left", "top",
        ]) list.style[property] = "";
        this.openMenu.append(list);
      }
      this.openMenu
        .querySelector(".editra-menu-trigger")
        .setAttribute("aria-expanded", "false");
      this.openMenu.classList.remove("is-open");
      this.openMenu = null;
      this.openMenuList = null;
      this.core.notifyUI("menuToggle", {
        visible: false,
        reason: "user",
      });
    }

    /** Rebuilds context-sensitive items from the latest editor state. */
    refreshContext() {
      if (!this.element?.isConnected) return;
      const hasTable = Boolean(this.core.editor.querySelector("table"));
      this.element.querySelectorAll('[data-context="table"]').forEach((item) => {
        item.hidden = !hasTable;
        item.disabled = !hasTable;
        item.setAttribute("aria-hidden", String(!hasTable));
      });
      const tableList = this.element
        .querySelector('[data-command="selectTable"]')
        ?.closest(".editra-menu-list");
      tableList
        ?.querySelectorAll(".editra-menu-separator")
        .forEach((separator) => {
          separator.hidden = !hasTable;
        });
    }

    /** Closes menus when a pointer action occurs outside menu UI. */
    handleDocumentPointer(event) {
      if (
        !this.element.contains(event.target) &&
        !this.openMenuList?.contains(event.target) &&
        !this.chooser?.contains(event.target)
      ) {
        this.closeMenus();
        this.closeChooser();
      }
    }

    /** Implements Escape and arrow-key menu navigation. */
    handleKeydown(event) {
      if (event.key === "Escape") {
        this.closeMenus();
        this.closeChooser();
        return;
      }
      if (!this.openMenu) return;

      const items = [
        ...(this.openMenuList?.querySelectorAll(".editra-menu-item") ?? []),
      ];
      const currentIndex = items.indexOf(document.activeElement);
      if (event.key === "ArrowDown") {
        event.preventDefault();
        items[(currentIndex + 1) % items.length]?.focus();
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        items[(currentIndex - 1 + items.length) % items.length]?.focus();
      }
    }

    /** Updates theme-specific menu labels and checked state. */
    refreshTheme(mode) {
      this.element.dataset.editraThemeMode = mode;
      this.element
        .querySelectorAll(".editra-menu-list")
        .forEach((list) => {
          list.dataset.editraThemeMode = mode;
          list.style.colorScheme = mode;
        });
      if (this.openMenuList) {
        this.openMenuList.dataset.editraThemeMode = mode;
        this.openMenuList.style.colorScheme = mode;
      }
      if (this.chooser) {
        this.chooser.dataset.editraThemeMode = mode;
        this.chooser.style.colorScheme = mode;
      }
      requestAnimationFrame(() => {
        if (!this.element.isConnected) return;
        this.element.dataset.editraThemeRender = String(
          Number(this.element.dataset.editraThemeRender || 0) + 1,
        );
      });
    }

    /** Releases document, viewport, menu, and chooser resources. */
    destroy() {
      this.closeMenus();
      this.closeChooser();
      this.element.removeEventListener("click", this.handleClick);
      this.element.removeEventListener("mousedown", this.handlePointerDown);
      this.element.removeEventListener("pointerover", this.handlePointerOver);
      this.element.removeEventListener("pointerout", this.handlePointerOut);
      document.removeEventListener("pointerdown", this.handleDocumentPointer);
      document.removeEventListener("keydown", this.handleKeydown);
      window.removeEventListener("resize", this.handleViewportChange);
      window.visualViewport?.removeEventListener("resize", this.handleViewportChange);
      window.visualViewport?.removeEventListener("scroll", this.handleViewportChange);
      this.contextObserver?.disconnect();
      this.element.remove();
    }
  }

  global.EditraMenuBar = MenuBar;
})(window);
