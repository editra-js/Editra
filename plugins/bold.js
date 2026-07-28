(function (global) {
  "use strict";

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
