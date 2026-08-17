(function (global) {
  "use strict";

// Underline uses the saved toolbar selection so focus changes never lose text.
function UnderlinePlugin(core) {
  return core.execCommand("underline");
}

UnderlinePlugin.plugin = Object.freeze({
  name: "underline",
  label: "Underline",
  icon: "underline",
  shortcut: "u",
});

  global.UnderlinePlugin = UnderlinePlugin;
  (global.EditraPlugins ??= Object.create(null)).underline = UnderlinePlugin;
})(window);
