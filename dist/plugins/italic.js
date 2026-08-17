(function (global) {
  "use strict";

// Italic is a semantic inline command and shares the core selection lifecycle.
function ItalicPlugin(core) {
  return core.execCommand("italic");
}

ItalicPlugin.plugin = Object.freeze({
  name: "italic",
  label: "Italic",
  icon: "italic",
  shortcut: "i",
});

  global.ItalicPlugin = ItalicPlugin;
  (global.EditraPlugins ??= Object.create(null)).italic = ItalicPlugin;
})(window);
