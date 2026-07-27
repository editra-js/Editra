/**
 * Product: Editra
 * Author: Editra Team
 * Version: 1.17.0
 * Purpose: Provides document-language selection, Unicode metadata, and RTL direction handling.
 * Licensing: MIT License (open source)
 */

(function (global) {
  "use strict";

  const installations = new WeakMap();
  const LANGUAGES = Object.freeze({
    en: Object.freeze({ label: "English", direction: "ltr" }),
    hi: Object.freeze({ label: "Hindi - हिन्दी", direction: "ltr" }),
    te: Object.freeze({ label: "Telugu - తెలుగు", direction: "ltr" }),
    ur: Object.freeze({ label: "Urdu - اردو", direction: "rtl" }),
    ar: Object.freeze({ label: "Arabic - العربية", direction: "rtl" }),
    es: Object.freeze({ label: "Spanish - Español", direction: "ltr" }),
    fr: Object.freeze({ label: "French - Français", direction: "ltr" }),
    de: Object.freeze({ label: "German - Deutsch", direction: "ltr" }),
    pt: Object.freeze({ label: "Portuguese - Português", direction: "ltr" }),
    zh: Object.freeze({ label: "Chinese - 中文", direction: "ltr" }),
    ja: Object.freeze({ label: "Japanese - 日本語", direction: "ltr" }),
    ko: Object.freeze({ label: "Korean - 한국어", direction: "ltr" }),
  });

  function setLanguage(core, value) {
    const code = String(value?.code || value || "").toLowerCase();
    const language = LANGUAGES[code];
    if (!language) return false;
    core.options.language = code;
    core.options.direction = language.direction;
    core.editor.lang = code;
    core.editor.dir = language.direction;
    core.toolbar.card.lang = code;
    core.toolbar.card.dir = language.direction;
    core.state.language = code;
    core.state.direction = language.direction;
    core.emitState();
    const detail = {
      language: code,
      label: language.label,
      direction: language.direction,
      editor: core,
    };
    core.editor.dispatchEvent(
      new CustomEvent("editra:language-change", {
        bubbles: true,
        detail,
      }),
    );
    if (typeof core.options.onLanguageChange === "function") {
      core.options.onLanguageChange(detail);
    }
    return detail;
  }

  function install(core) {
    if (installations.has(core)) return installations.get(core);
    const unregister = [
      core.registerCommand("setLanguage", (value) => setLanguage(core, value), {
        plugin: "languages",
        source: "plugin",
      }),
      core.registerCommand("getLanguages", () => ({ ...LANGUAGES }), {
        plugin: "languages",
        source: "plugin",
      }),
    ];
    const state = { unregister };
    core.registerCleanup(() => {
      unregister.forEach((remove) => remove());
      installations.delete(core);
    });
    installations.set(core, state);
    return state;
  }

  function LanguagesPlugin(core, options) {
    install(core);
    return setLanguage(core, options || core.options.language || "en");
  }

  LanguagesPlugin.install = install;
  LanguagesPlugin.hydrate = install;
  LanguagesPlugin.plugin = Object.freeze({
    name: "languages",
    label: "Document language",
    command: "setLanguage",
  });
  LanguagesPlugin.languages = LANGUAGES;

  global.LanguagesPlugin = LanguagesPlugin;
  (global.EditraPlugins ??= Object.create(null)).languages = LanguagesPlugin;
})(window);
