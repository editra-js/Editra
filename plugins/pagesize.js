(function (global) {
  "use strict";

  const installations = new WeakMap();
  const PAGE_SIZES = Object.freeze({
    A3: Object.freeze({ width: "297mm", height: "420mm" }),
    A4: Object.freeze({ width: "210mm", height: "297mm" }),
    A5: Object.freeze({ width: "148mm", height: "210mm" }),
    B4: Object.freeze({ width: "250mm", height: "353mm" }),
    B5: Object.freeze({ width: "176mm", height: "250mm" }),
    Letter: Object.freeze({ width: "8.5in", height: "11in" }),
    Legal: Object.freeze({ width: "8.5in", height: "14in" }),
    Executive: Object.freeze({ width: "7.25in", height: "10.5in" }),
    Tabloid: Object.freeze({ width: "11in", height: "17in" }),
    Ledger: Object.freeze({ width: "11in", height: "17in" }),
    Statement: Object.freeze({ width: "5.5in", height: "8.5in" }),
    Folio: Object.freeze({ width: "8.5in", height: "13in" }),
    Quarto: Object.freeze({ width: "8.5in", height: "10in" }),
    "10x14": Object.freeze({ width: "10in", height: "14in" }),
    "C5 Envelope": Object.freeze({ width: "162mm", height: "229mm" }),
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
    let appliedWidth = width;
    let appliedHeight = height;
    if (core.options.editorHeightFixed) {
      const fixedHeight = Number.parseFloat(core.options.editorHeight);
      if (Number.isFinite(fixedHeight) && fixedHeight > 0) {
        appliedHeight = core.options.editorHeight;
        appliedWidth = `${Math.round(
          fixedHeight *
            (Number.parseFloat(width) / Number.parseFloat(height)),
        )}px`;
      }
    }
    core.setEditorSize(appliedWidth, appliedHeight, { standard: true });
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
    if (core.options.theme === "Word") return false;
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
    if (core.options.theme === "Word") return false;
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
