/**
 * Product: Editra
 * Author: Editra Team
 * Version: 1.16.0
 * Purpose: Implements the Editra theme plugin and its editor commands.
 * Licensing: MIT License (open source)
 */

(function (global) {
  "use strict";

  const installations = new WeakMap();
  const VALID_MODES = new Set(["light", "dark", "system"]);

  function requestedMode(value) {
    const mode = String(value || "light").toLowerCase();
    return VALID_MODES.has(mode) ? mode : "light";
  }

  function effectiveMode(mode, media) {
    return mode === "system" ? (media.matches ? "dark" : "light") : mode;
  }

  function refreshPortals(mode) {
    document.documentElement.dataset.editraThemeMode = mode;
    document
      .querySelectorAll(
        ".editra-media-dialog,.editra-table-picker,.editra-table-context-menu,.editra-productivity-overlay,.editra-emoji-picker,.editra-comment-composer,.editra-comments-sidebar,.editra-revision-overlay,.editra-menu-chooser",
      )
      .forEach((element) => {
        element.dataset.editraThemeMode = mode;
      });
  }

  function emit(core, state, reason) {
    const detail = {
      mode: state.mode,
      effectiveMode: state.effectiveMode,
      previousMode: state.previousMode,
      reason,
      editor: core,
      menubar: core.menubar?.element ?? null,
    };
    core.editor.dispatchEvent(
      new CustomEvent("editra:themeToggle", {
        detail,
        bubbles: true,
      }),
    );
    if (typeof core.options.onThemeToggle === "function") {
      core.options.onThemeToggle(detail);
    }
    return detail;
  }

  function applyTheme(core, state, value, reason = "command") {
    const mode = requestedMode(value);
    const effective = effectiveMode(mode, state.media);
    state.previousMode = state.effectiveMode;
    state.mode = mode;
    state.effectiveMode = effective;
    core.options.colorScheme = mode;
    core.state.themeMode = mode;
    core.state.effectiveTheme = effective;

    core.toolbar.card.classList.toggle("editra-theme-dark", effective === "dark");
    core.toolbar.card.classList.toggle("editra-theme-light", effective === "light");
    core.toolbar.card.dataset.editraThemeMode = effective;
    core.editor.dataset.editraThemeMode = effective;
    core.toolbar.workspace.dataset.editraThemeMode = effective;
    refreshPortals(effective);
    core.menubar?.refreshTheme?.(effective);
    core.toolbar.element.dataset.editraThemeMode = effective;

    core.scheduleUpdate("theme-refresh", () => {
      core.emitState();
    });
    return emit(core, state, reason);
  }

  function toggleTheme(core, state) {
    const next = state.effectiveMode === "dark" ? "light" : "dark";
    return applyTheme(core, state, next, "toggle");
  }

  function install(core) {
    if (installations.has(core)) return installations.get(core);
    const media = global.matchMedia?.("(prefers-color-scheme: dark)") ?? {
      matches: false,
      addEventListener() {},
      removeEventListener() {},
    };
    const state = {
      media,
      mode: "light",
      effectiveMode: "light",
      previousMode: null,
      unregister: [],
    };
    const handlers = {
      toggleTheme: () => toggleTheme(core, state),
      "toggle-theme": () => toggleTheme(core, state),
      setTheme: (value) => applyTheme(core, state, value, "command"),
      getTheme: () => ({
        mode: state.mode,
        effectiveMode: state.effectiveMode,
      }),
    };
    state.unregister = Object.entries(handlers).map(([name, handler]) =>
      core.registerCommand(name, handler, {
        plugin: "theme",
        source: "plugin",
      }),
    );
    const systemListener = () => {
      if (state.mode === "system") {
        applyTheme(core, state, "system", "system");
      }
    };
    media.addEventListener?.("change", systemListener);
    applyTheme(core, state, core.options.colorScheme, "initial");

    core.registerCleanup(() => {
      media.removeEventListener?.("change", systemListener);
      state.unregister.forEach((remove) => remove());
      delete core.editor.dataset.editraThemeMode;
      if (
        document.documentElement.dataset.editraThemeMode ===
        state.effectiveMode
      ) {
        delete document.documentElement.dataset.editraThemeMode;
      }
      installations.delete(core);
    });
    installations.set(core, state);
    return state;
  }

  function ThemePlugin(core, value) {
    const state = install(core);
    return value === undefined
      ? toggleTheme(core, state)
      : applyTheme(core, state, value);
  }

  ThemePlugin.install = install;
  ThemePlugin.hydrate = install;
  ThemePlugin.plugin = Object.freeze({
    name: "theme",
    label: "Theme",
    command: "toggleTheme",
  });
  global.ThemePlugin = ThemePlugin;
  (global.EditraPlugins ??= Object.create(null)).theme = ThemePlugin;
})(window);
