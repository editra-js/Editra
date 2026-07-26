/**
 * © Minsoft. All rights reserved.
 * Product: Editra (Minsoft product)
 * Author: Editra Team
 * Version: 1.15.0
 * Purpose: Implements the Editra margins plugin and its editor commands.
 * Licensing: MIT License (open source)
 */

(function (global) {
  "use strict";

  const installations = new WeakMap();

  function notify(core, margins, reason = "command") {
    const detail = { reason, margins: { ...margins }, editor: core };
    core.editor.dispatchEvent(
      new CustomEvent("editra:marginChange", { detail, bubbles: true }),
    );
    core.emitState();
    return detail;
  }

  async function setMargin(core, values = {}) {
    const presets = {
      normal: { top: 72, right: 72, bottom: 72, left: 72 },
      narrow: { top: 36, right: 36, bottom: 36, left: 36 },
      moderate: { top: 72, right: 54, bottom: 72, left: 54 },
      wide: { top: 72, right: 144, bottom: 72, left: 144 },
    };
    if (typeof values === "string" && presets[values.toLowerCase()]) {
      values = presets[values.toLowerCase()];
    }
    const options =
      typeof values === "number"
        ? { top: values, right: values, bottom: values, left: values }
        : values ?? {};
    const margins = core.applyPageMargins(options);
    const ruler = await core.ensurePlugin("ruler");
    if (ruler) {
      await core.executeCommand("setRulerMargins", {
        left: Number.parseFloat(margins.left),
        right: Number.parseFloat(margins.right),
      });
    } else if (typeof core.options.onRulerAdjust === "function") {
      core.options.onRulerAdjust({
        reason: "margin",
        margins: { ...margins },
        editor: core,
      });
    }
    return notify(core, margins);
  }

  async function marginsStressTest(core, options = {}) {
    const adjustments = Math.max(100, Number(options.adjustments) || 2000);
    const startedAt = performance.now();
    for (let start = 0; start < adjustments; start += 100) {
      const end = Math.min(start + 100, adjustments);
      for (let index = start; index < end; index += 1) {
        core.applyPageMargins(
          {
            top: 40 + (index % 40),
            right: 45 + (index % 35),
            bottom: 40 + (index % 45),
            left: 45 + (index % 30),
          },
          false,
        );
      }
      if (end < adjustments) {
        await new Promise((resolve) => requestAnimationFrame(resolve));
      }
    }
    core.refreshPageLayout();
    return {
      adjustments,
      margins: { ...core.state.margins },
      durationMs: Math.round((performance.now() - startedAt) * 100) / 100,
    };
  }

  function install(core) {
    if (installations.has(core)) return installations.get(core);
    const handlers = {
      setMargin: (values) => setMargin(core, values),
      getMargins: () => ({ ...core.state.margins }),
      marginsStressTest: (options) => marginsStressTest(core, options),
    };
    const unregister = Object.entries(handlers).map(([name, handler]) =>
      core.registerCommand(name, handler, {
        plugin: "margins",
        source: "plugin",
      }),
    );
    const rulerListener = (event) => {
      if (!event.detail || event.detail.reason === "visibility") return;
      const values = {};
      if (event.detail.leftMargin !== undefined) {
        values.left = event.detail.leftMargin;
      }
      if (event.detail.rightMargin !== undefined) {
        values.right = event.detail.rightMargin;
      }
      if (Object.keys(values).length) core.applyPageMargins(values, false);
    };
    core.editor.addEventListener("editra:rulerAdjust", rulerListener);
    const state = { unregister, rulerListener };
    core.registerCleanup(() => {
      core.editor.removeEventListener("editra:rulerAdjust", rulerListener);
      unregister.forEach((remove) => remove());
      installations.delete(core);
    });
    installations.set(core, state);
    return state;
  }

  function MarginsPlugin(core, values) {
    install(core);
    return setMargin(core, values);
  }

  MarginsPlugin.install = install;
  MarginsPlugin.hydrate = install;
  MarginsPlugin.plugin = Object.freeze({
    name: "margins",
    label: "Page margins",
    command: "setMargin",
  });
  global.MarginsPlugin = MarginsPlugin;
  (global.EditraPlugins ??= Object.create(null)).margins = MarginsPlugin;
})(window);
