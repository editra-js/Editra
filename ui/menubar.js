/**
 * © Minsoft. All rights reserved.
 * Product: Editra (Minsoft product)
 * Author: Editra Team
 * Version: 1.15.0
 * Purpose: Builds the configurable Editra menu bar and command menus.
 * Licensing: MIT License (open source)
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
        ["toggleRuler", "Show / Hide Ruler"],
      ],
    },
    {
      label: "Table",
      items: [
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
        null,
        ["setHeading", "Headings H1–H6"],
        ["strikethrough", "Strikethrough"],
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
        ["shortcuts", "Shortcuts"],
      ],
    },
  ]);
  const COLOR_SWATCHES = Object.freeze([
    "#1f1f1f",
    "#ffffff",
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
  ]);

  function normalize(value) {
    return String(value ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
  }

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

  class MenuBar {
    constructor(core, card, configuration = null) {
      this.core = core;
      this.card = card;
      this.openMenu = null;
      this.chooser = null;
      this.handleClick = this.handleClick.bind(this);
      this.handlePointerDown = this.handlePointerDown.bind(this);
      this.handleDocumentPointer = this.handleDocumentPointer.bind(this);
      this.handleKeydown = this.handleKeydown.bind(this);

      this.element = document.createElement("nav");
      this.element.className = "editra-menubar";
      this.element.setAttribute("aria-label", "Editor menu");

      const fragment = document.createDocumentFragment();
      this.menus = resolveMenus(configuration);
      this.menus.forEach((menu, index) => {
        fragment.append(this.createMenu(menu, index));
      });
      this.element.append(fragment);
      card.prepend(this.element);

      this.element.addEventListener("click", this.handleClick);
      this.element.addEventListener("mousedown", this.handlePointerDown);
      document.addEventListener("pointerdown", this.handleDocumentPointer);
      document.addEventListener("keydown", this.handleKeydown);
      core.notifyUI("menuToggle", {
        visible: true,
        reason: "build",
        menus: this.menus.map((menu) => menu.label),
        element: this.element,
      });
    }

    createMenu(menu, index) {
      const group = document.createElement("div");
      group.className = "editra-menu";

      const trigger = document.createElement("button");
      trigger.type = "button";
      trigger.className = "editra-menu-trigger";
      trigger.dataset.menuIndex = String(index);
      trigger.setAttribute("aria-haspopup", "menu");
      trigger.setAttribute("aria-expanded", "false");
      trigger.textContent = menu.label;

      const list = document.createElement("div");
      list.className = "editra-menu-list";
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
        button.setAttribute("role", "menuitem");
        button.tabIndex = -1;
        button.textContent = label;
        items.append(button);
      });

      list.append(items);
      group.append(trigger, list);
      return group;
    }

    handlePointerDown(event) {
      if (event.target.closest("button")) event.preventDefault();
    }

    handleClick(event) {
      const trigger = event.target.closest("[data-menu-index]");
      if (trigger && this.element.contains(trigger)) {
        this.toggleMenu(trigger.closest(".editra-menu"));
        return;
      }

      const item = event.target.closest("[data-command]");
      if (!item || !this.element.contains(item)) return;
      const control = this.core.toolbar.getControl(item.dataset.command);
      if (control?.type === "select" || control?.type === "color") {
        this.openChooser(item, control);
        return;
      }
      this.closeMenus();
      this.core.executeCommand(item.dataset.command);
    }

    openChooser(item, control) {
      const rect = item.getBoundingClientRect();
      const cardRect = this.card.getBoundingClientRect();
      const command = item.dataset.command;
      this.closeMenus();
      this.closeChooser();
      const chooser = document.createElement("div");
      chooser.className = "editra-menu-chooser";
      chooser.dataset.editraUi = "true";
      chooser.setAttribute("role", "dialog");
      chooser.setAttribute("aria-label", control.label);
      chooser.style.left = `${Math.max(
        8,
        Math.min(rect.left - cardRect.left, cardRect.width - 250),
      )}px`;
      chooser.style.top = `${Math.max(48, rect.top - cardRect.top)}px`;
      const heading = document.createElement("header");
      heading.textContent = control.label;
      const choices = document.createElement("div");
      choices.className =
        control.type === "color"
          ? "editra-menu-color-grid"
          : "editra-menu-option-list";
      const values =
        control.type === "color"
          ? COLOR_SWATCHES.map((color) => [color, color])
          : control.options ?? [];
      values.forEach(([value, label]) => {
        const button = document.createElement("button");
        button.type = "button";
        button.dataset.menuValue = value;
        button.title = String(label);
        if (control.type === "color") {
          button.style.setProperty("--editra-choice-color", value);
          button.setAttribute("aria-label", `Choose ${value}`);
        } else {
          button.textContent = label;
        }
        choices.append(button);
      });
      chooser.append(heading, choices);
      this.card.append(chooser);
      this.chooser = chooser;
      const choose = (event) => {
        const choice = event.target.closest("[data-menu-value]");
        if (!choice) return;
        this.core.executeCommand(command, choice.dataset.menuValue);
        this.closeChooser();
      };
      chooser._editraChoose = choose;
      chooser.addEventListener("click", choose);
      choices.querySelector("button")?.focus({ preventScroll: true });
    }

    closeChooser() {
      if (!this.chooser) return;
      this.chooser.removeEventListener("click", this.chooser._editraChoose);
      this.chooser.remove();
      this.chooser = null;
    }

    toggleMenu(menu) {
      const shouldOpen = this.openMenu !== menu;
      this.closeMenus();
      if (!shouldOpen) return;

      const trigger = menu.querySelector(".editra-menu-trigger");
      const list = menu.querySelector(".editra-menu-list");
      list.hidden = false;
      trigger.setAttribute("aria-expanded", "true");
      menu.classList.add("is-open");
      this.openMenu = menu;
      this.core.notifyUI("menuToggle", {
        visible: true,
        menu: menu.querySelector(".editra-menu-trigger").textContent,
        reason: "user",
      });
    }

    closeMenus() {
      if (!this.openMenu) return;
      this.openMenu.querySelector(".editra-menu-list").hidden = true;
      this.openMenu
        .querySelector(".editra-menu-trigger")
        .setAttribute("aria-expanded", "false");
      this.openMenu.classList.remove("is-open");
      this.openMenu = null;
      this.core.notifyUI("menuToggle", {
        visible: false,
        reason: "user",
      });
    }

    handleDocumentPointer(event) {
      if (
        !this.element.contains(event.target) &&
        !this.chooser?.contains(event.target)
      ) {
        this.closeMenus();
        this.closeChooser();
      }
    }

    handleKeydown(event) {
      if (event.key === "Escape") {
        this.closeMenus();
        this.closeChooser();
        return;
      }
      if (!this.openMenu) return;

      const items = [
        ...this.openMenu.querySelectorAll(".editra-menu-item"),
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

    refreshTheme(mode) {
      this.element.dataset.editraThemeMode = mode;
      this.element
        .querySelectorAll(".editra-menu-list")
        .forEach((list) => {
          list.dataset.editraThemeMode = mode;
          list.style.colorScheme = mode;
        });
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

    destroy() {
      this.closeMenus();
      this.closeChooser();
      this.element.removeEventListener("click", this.handleClick);
      this.element.removeEventListener("mousedown", this.handlePointerDown);
      document.removeEventListener("pointerdown", this.handleDocumentPointer);
      document.removeEventListener("keydown", this.handleKeydown);
      this.element.remove();
    }
  }

  global.EditraMenuBar = MenuBar;
})(window);
