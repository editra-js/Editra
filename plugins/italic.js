// Version: 2.0.0
/**
 * Product: Editra
 * Author: Editra Team
 * Version: 2.0.0
 * Purpose: Implements the Editra italic plugin and its editor commands.
 * Licensing: MIT License (open source)
 */

(function (global) {
  "use strict";

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
