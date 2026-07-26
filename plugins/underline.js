/**
 * © Minsoft. All rights reserved.
 * Product: Editra (Minsoft product)
 * Author: Editra Team
 * Version: 1.15.0
 * Purpose: Implements the Editra underline plugin and its editor commands.
 * Licensing: MIT License (open source)
 */

(function (global) {
  "use strict";

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
