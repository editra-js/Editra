/**
 * © Minsoft. All rights reserved.
 * Product: Editra (Minsoft product)
 * Author: Editra Team
 * Version: 1.15.0
 * Purpose: Implements the Editra ui-config plugin and its editor commands.
 * Licensing: MIT License (open source)
 */

(function (global) {
  "use strict";

  const installations = new WeakMap();

  function normalize(value) {
    return String(value ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
  }

  function applyToolbar(core, layout) {
    if (typeof layout !== "string") return false;
    const requested = new Set(
      layout
        .split(/[\s|]+/)
        .filter(Boolean)
        .map(normalize),
    );
    let visible = 0;
    core.toolbar.element
      .querySelectorAll("[data-command], .editra-toolbar-separator")
      .forEach((control) => {
        if (control.classList.contains("editra-toolbar-separator")) {
          control.hidden = false;
          return;
        }
        const command = normalize(control.dataset.command);
        const plugin = normalize(control.dataset.plugin);
        const show = requested.has(command) || requested.has(plugin);
        const host = control.matches("input[type='color']")
          ? control.closest(".editra-color-tool")
          : control;
        host.hidden = !show;
        if (show) visible += 1;
      });
    const visibleControls = [
      ...core.toolbar.element.querySelectorAll(
        "[data-command]:not([hidden])",
      ),
    ];
    core.toolbar.element
      .querySelectorAll(".editra-toolbar-separator")
      .forEach((separator) => {
        const before = separator.previousElementSibling;
        const after = separator.nextElementSibling;
        separator.hidden =
          !before ||
          !after ||
          before.hidden ||
          after.hidden;
      });
    core.notifyUI("toolbarBuild", {
      element: core.toolbar.element,
      tools: visibleControls.map((control) => control.dataset.command),
      visible: visible > 0,
      reason: "configuration",
    });
    return visible;
  }

  function applyMenu(core, menuConfig) {
    if (!menuConfig || typeof menuConfig !== "object") return false;
    core.menubar?.destroy();
    core.menubar = new global.EditraMenuBar(
      core,
      core.toolbar.card,
      menuConfig,
    );
    core.menubar.element.hidden = core.options.showMenuBar === false;
    return true;
  }

  function setMenuVisibility(core, visible, reason = "api") {
    if (visible && !core.menubar) {
      core.menubar = new global.EditraMenuBar(
        core,
        core.toolbar.card,
        core.options.menu,
      );
    }
    if (core.menubar?.element) core.menubar.element.hidden = !visible;
    core.options.showMenuBar = visible;
    core.notifyUI("menuToggle", { visible, reason });
    return visible;
  }

  function setUIConfig(core, config = {}) {
    if ("toolbar" in config) {
      core.options.toolbar = config.toolbar;
      applyToolbar(core, config.toolbar);
    }
    if ("menu" in config) {
      core.options.menu = config.menu;
      applyMenu(core, config.menu);
    }
    if ("showMenuBar" in config) {
      setMenuVisibility(core, config.showMenuBar !== false, "configuration");
    }
    return true;
  }

  function install(core) {
    if (installations.has(core)) return installations.get(core);
    const unregisterCommands = [
      core.registerCommand(
        "setUIConfig",
        (config) => setUIConfig(core, config),
        { plugin: "uiConfig", source: "plugin" },
      ),
      core.registerCommand(
        "showMenuBar",
        () => setMenuVisibility(core, true),
        { plugin: "uiConfig", source: "plugin" },
      ),
      core.registerCommand(
        "hideMenuBar",
        () => setMenuVisibility(core, false),
        { plugin: "uiConfig", source: "plugin" },
      ),
    ];
    const state = { unregisterCommands };
    core.registerCleanup(() => {
      unregisterCommands.forEach((unregister) => unregister());
      installations.delete(core);
    });
    installations.set(core, state);
    return state;
  }

  function UIConfigPlugin(core, config) {
    install(core);
    return setUIConfig(core, config);
  }

  UIConfigPlugin.install = install;
  UIConfigPlugin.hydrate = install;
  UIConfigPlugin.plugin = Object.freeze({
    name: "uiConfig",
    label: "UI configuration",
    hidden: true,
  });

  global.UIConfigPlugin = UIConfigPlugin;
  (global.EditraPlugins ??= Object.create(null)).uiConfig = UIConfigPlugin;
})(window);
