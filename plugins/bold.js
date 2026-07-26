/**
 * © Minsoft. All rights reserved.
 * Product: Editra (Minsoft product)
 * Author: Editra Team
 * Version: 1.15.0
 * Purpose: Implements the Editra bold plugin and its editor commands.
 * Licensing: MIT License (open source)
 */

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
