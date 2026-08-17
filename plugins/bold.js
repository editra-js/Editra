(function (global) {
  "use strict";

// Bold is a semantic inline command; the core supplies a DOM fallback when a
// browser does not implement the native editing command.
function BoldPlugin(core) {
  return core.execCommand("bold");
}

BoldPlugin.plugin = Object.freeze({
  name: "bold",
  label: "Bold",
  icon: "bold",
  shortcut: "b",
});

  global.BoldPlugin = BoldPlugin;
  (global.EditraPlugins ??= Object.create(null)).bold = BoldPlugin;
})(window);
