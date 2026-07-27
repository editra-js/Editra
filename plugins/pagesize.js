/**
 * Product: Editra
 * Author: Editra Team
 * Version: 1.17.0
 * Purpose: Implements the Editra pagesize plugin and its editor commands.
 * Licensing: MIT License (open source)
 */

(function (global) {
  "use strict";

  const installations = new WeakMap();
  const PAGE_SIZES = Object.freeze({
    A3: Object.freeze({ width: 1123, height: 1587 }),
    A4: Object.freeze({ width: 794, height: 1123 }),
    A5: Object.freeze({ width: 559, height: 794 }),
    B4: Object.freeze({ width: 945, height: 1334 }),
    B5: Object.freeze({ width: 665, height: 945 }),
    Letter: Object.freeze({ width: 816, height: 1056 }),
    Legal: Object.freeze({ width: 816, height: 1344 }),
    Executive: Object.freeze({ width: 696, height: 1008 }),
    Tabloid: Object.freeze({ width: 1056, height: 1632 }),
    Ledger: Object.freeze({ width: 1056, height: 1632 }),
    Statement: Object.freeze({ width: 528, height: 816 }),
    Folio: Object.freeze({ width: 816, height: 1248 }),
    Quarto: Object.freeze({ width: 816, height: 960 }),
    "10x14": Object.freeze({ width: 960, height: 1344 }),
    "C5 Envelope": Object.freeze({ width: 612, height: 867 }),
  });

  function normalizeOrientation(value) {
    return String(value || "portrait").toLowerCase() === "landscape"
      ? "landscape"
      : "portrait";
  }

  function findSize(value) {
    const requested = String(value || "Letter").toLowerCase();
    return Object.keys(PAGE_SIZES).find(
      (name) => name.toLowerCase() === requested,
    );
  }

  function notify(core, detail) {
    core.state.pageSize = detail.pageSize;
    core.state.orientation = detail.orientation;
    core.options.pageSize = detail.pageSize;
    core.options.orientation = detail.orientation;
    core.emitState();
    return detail;
  }

  function setPageSize(core, value = {}) {
    const options = typeof value === "string" ? { size: value } : value ?? {};
    const sizeName = findSize(options.size || core.options.pageSize);
    if (!sizeName) return false;
    const orientation = normalizeOrientation(
      options.orientation || core.options.orientation,
    );
    const dimensions = PAGE_SIZES[sizeName];
    const width =
      orientation === "landscape" ? dimensions.height : dimensions.width;
    const height =
      orientation === "landscape" ? dimensions.width : dimensions.height;
    let appliedWidth = `${width}px`;
    let appliedHeight = `${height}px`;
    if (core.options.editorHeightFixed) {
      const fixedHeight = Number.parseFloat(core.options.editorHeight);
      if (Number.isFinite(fixedHeight) && fixedHeight > 0) {
        appliedHeight = core.options.editorHeight;
        appliedWidth = `${Math.round(fixedHeight * (width / height))}px`;
      }
    }
    core.setEditorSize(appliedWidth, appliedHeight);
    return notify(core, {
      pageSize: sizeName,
      orientation,
      width: appliedWidth,
      height: appliedHeight,
      custom: false,
      fixedHeight: Boolean(core.options.editorHeightFixed),
    });
  }

  function setCustomPageSize(core, options = {}) {
    const orientation = normalizeOrientation(
      options.orientation || core.options.orientation,
    );
    let width = core.validEditorDimension(
      options.width,
      core.options.editorWidth,
    );
    let height = core.validEditorDimension(
      options.height,
      core.options.editorHeight,
    );
    if (orientation === "landscape") {
      const numericWidth = Number.parseFloat(width);
      const numericHeight = Number.parseFloat(height);
      if (numericWidth < numericHeight) [width, height] = [height, width];
    }
    core.setEditorSize(width, height);
    return notify(core, {
      pageSize: "Custom",
      orientation,
      width,
      height,
      custom: true,
    });
  }

  function setOrientation(core, orientation) {
    const normalized = normalizeOrientation(
      typeof orientation === "object" ? orientation.orientation : orientation,
    );
    if (core.state.pageSize === "Custom" || core.options.pageSize === "Custom") {
      return setCustomPageSize(core, {
        width: core.options.editorWidth,
        height: core.options.editorHeight,
        orientation: normalized,
      });
    }
    return setPageSize(core, {
      size: core.state.pageSize || core.options.pageSize,
      orientation: normalized,
    });
  }

  async function printContentOnly(core, options = {}) {
    return core.executeCommand("exportPDF", {
      ...options,
      contentOnly: true,
    });
  }

  async function pageSizeStressTest(core, options = {}) {
    const iterations = Math.max(100, Number(options.iterations) || 1000);
    const names = Object.keys(PAGE_SIZES);
    const startedAt = performance.now();
    for (let start = 0; start < iterations; start += 100) {
      const end = Math.min(start + 100, iterations);
      for (let index = start; index < end; index += 1) {
        setPageSize(core, {
          size: names[index % names.length],
          orientation: index % 2 ? "landscape" : "portrait",
        });
      }
      if (end < iterations) {
        await new Promise((resolve) => requestAnimationFrame(resolve));
      }
    }
    return {
      iterations,
      sizes: names.length,
      durationMs: Math.round((performance.now() - startedAt) * 100) / 100,
    };
  }

  function install(core) {
    if (installations.has(core)) return installations.get(core);
    core.state.pageSize ||= core.options.pageSize || "Letter";
    core.state.orientation ||= normalizeOrientation(core.options.orientation);
    const handlers = {
      setPageSize: (value) => setPageSize(core, value),
      setCustomPageSize: (options) => setCustomPageSize(core, options),
      setOrientation: (value) => setOrientation(core, value),
      getPageSizes: () =>
        Object.fromEntries(
          Object.entries(PAGE_SIZES).map(([name, dimensions]) => [
            name,
            { ...dimensions },
          ]),
        ),
      printContentOnly: (options) => printContentOnly(core, options),
      pageSizeStressTest: (options) => pageSizeStressTest(core, options),
    };
    const unregister = Object.entries(handlers).map(([name, handler]) =>
      core.registerCommand(name, handler, {
        plugin: "pagesize",
        source: "plugin",
      }),
    );
    const state = { unregister };
    core.registerCleanup(() => {
      unregister.forEach((remove) => remove());
      installations.delete(core);
    });
    installations.set(core, state);
    return state;
  }

  function PageSizePlugin(core, options) {
    install(core);
    return setPageSize(core, options);
  }

  PageSizePlugin.install = install;
  PageSizePlugin.hydrate = install;
  PageSizePlugin.plugin = Object.freeze({
    name: "pagesize",
    label: "Page size",
    command: "setPageSize",
  });
  PageSizePlugin.sizes = PAGE_SIZES;
  global.PageSizePlugin = PageSizePlugin;
  (global.EditraPlugins ??= Object.create(null)).pagesize = PageSizePlugin;
})(window);
