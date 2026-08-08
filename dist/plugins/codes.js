(function (global) {
  "use strict";

  const installations = new WeakMap();
  const runtimePromises = new WeakMap();
  const BARCODE_FORMATS = Object.freeze({
    CODE128: {
      label: "Code 128",
      normalize: (value) => String(value).trim(),
      validate: (value) =>
        /^[\x20-\x7e]+$/.test(value)
          ? ""
          : "Code 128 supports printable ASCII characters.",
    },
    CODE39: {
      label: "Code 39",
      normalize: (value) => String(value).trim().toUpperCase(),
      validate: (value) =>
        /^[0-9A-Z .\-$/+%]+$/.test(value)
          ? ""
          : "Code 39 supports A-Z, 0-9, spaces, and . - $ / + %.",
    },
    EAN13: {
      label: "EAN-13",
      normalize: (value) => String(value).replace(/\s+/g, ""),
      validate: validateEan13,
    },
  });

  function commit(core) {
    core.captureSelection();
    core.recordHistory();
    core.scheduleUpdate("codes-change", () => {
      core.emitChange();
      core.emitState();
    });
    return true;
  }

  function ensureRuntimes(core) {
    if (global.JsBarcode && global.qrcode) return Promise.resolve(true);
    if (runtimePromises.has(core)) return runtimePromises.get(core);
    const promise = Promise.all([
      core.loadRuntimeScript("vendor/jsbarcode.min.js"),
      core
        .loadRuntimeScript("vendor/qrcode.js")
        .then(() => core.loadRuntimeScript("vendor/qrcode_UTF8.js")),
    ]).then(() => {
      if (!global.JsBarcode || !global.qrcode) {
        throw new Error("Code generation runtimes failed to initialize.");
      }
      return true;
    });
    runtimePromises.set(core, promise);
    return promise;
  }

  function ean13CheckDigit(value) {
    const digits = [...value].map(Number);
    const sum = digits.reduce(
      (total, digit, index) => total + digit * (index % 2 === 0 ? 1 : 3),
      0,
    );
    return String((10 - (sum % 10)) % 10);
  }

  function validateEan13(value) {
    if (!/^\d{12,13}$/.test(value)) {
      return "EAN-13 requires 12 digits, or 13 digits including the check digit.";
    }
    if (value.length === 13 && ean13CheckDigit(value.slice(0, 12)) !== value[12]) {
      return "The EAN-13 check digit is invalid.";
    }
    return "";
  }

  function normalizeBarcode(value, format) {
    const definition = BARCODE_FORMATS[format] || BARCODE_FORMATS.CODE128;
    const normalized = definition.normalize(value);
    const error = normalized ? definition.validate(normalized) : "Enter a product ID or code.";
    return {
      definition,
      error,
      value:
        !error && format === "EAN13" && normalized.length === 12
          ? `${normalized}${ean13CheckDigit(normalized)}`
          : normalized,
    };
  }

  function selectedText(core) {
    core.restoreSelection();
    const selection = global.getSelection();
    if (!selection?.rangeCount || !core.isRangeInside(selection.getRangeAt(0))) {
      return "";
    }
    return selection.toString().trim();
  }

  function positionDialog(core, dialog, command) {
    const trigger = core.toolbar?.element?.querySelector(
      `[data-command="${command}"]`,
    );
    const rect = trigger?.getBoundingClientRect();
    if (!rect) return;
    const width = 350;
    dialog.style.left = `${Math.max(12, Math.min(rect.left, innerWidth - width - 12))}px`;
    dialog.style.top = `${Math.min(rect.bottom + 8, innerHeight - 300)}px`;
  }

  function closeOpenDialog() {
    document
      .querySelector(".editra-codes-dialog")
      ?.dispatchEvent(new CustomEvent("editra:close"));
  }

  function createDialog(core, options) {
    closeOpenDialog();
    core.captureSelection();
    const dialog = document.createElement("div");
    dialog.className = "editra-codes-dialog editra-media-dialog";
    dialog.dataset.editraUi = "true";
    dialog.setAttribute("role", "dialog");
    dialog.setAttribute("aria-modal", "false");
    dialog.setAttribute("aria-label", options.title);
    dialog.innerHTML = `
      <div class="editra-dialog-heading">${options.title}</div>
      <form class="editra-codes-form">
        ${options.format ? `<label class="editra-codes-field"><span>Format</span><select data-editra-code-format>${Object.entries(BARCODE_FORMATS).map(([value, item]) => `<option value="${value}">${item.label}</option>`).join("")}</select></label>` : ""}
        <label class="editra-codes-field">
          <span>${options.label}</span>
          <textarea rows="3" data-editra-code-value required></textarea>
        </label>
        <div class="editra-codes-error" data-editra-code-error role="alert" hidden></div>
        <div class="editra-codes-actions">
          <button type="button" data-editra-cancel>Cancel</button>
          <button type="submit">Insert</button>
        </div>
      </form>
    `;
    document.body.append(dialog);
    positionDialog(core, dialog, options.command);

    const form = dialog.querySelector("form");
    const input = dialog.querySelector("[data-editra-code-value]");
    const format = dialog.querySelector("[data-editra-code-format]");
    const error = dialog.querySelector("[data-editra-code-error]");
    input.value = options.value || "";
    if (format && options.format) format.value = options.format;

    let unregister = () => {};
    let closed = false;
    const showError = (message) => {
      error.textContent = message || "";
      error.hidden = !message;
      input.setAttribute("aria-invalid", String(Boolean(message)));
    };
    const close = (restore = true) => {
      if (closed) return;
      closed = true;
      dialog.removeEventListener("editra:close", close);
      dialog.removeEventListener("keydown", handleKeydown);
      form.removeEventListener("submit", handleSubmit);
      document.removeEventListener("pointerdown", handleOutside, true);
      dialog.remove();
      unregister();
      if (restore) {
        core.restoreSelection();
        core.editor.focus({ preventScroll: true });
      }
    };
    const handleSubmit = async (event) => {
      event.preventDefault();
      showError("");
      try {
        const result = await options.onConfirm(input.value, format?.value);
        if (result?.error) {
          showError(result.error);
          return;
        }
        if (result === false) {
          showError("The code could not be inserted.");
          return;
        }
        close(false);
      } catch (caught) {
        showError(caught?.message || "The code could not be generated.");
      }
    };
    const handleKeydown = (event) => {
      if (event.key === "Escape") close();
    };
    const handleOutside = (event) => {
      const trigger = core.toolbar?.element?.querySelector(
        `[data-command="${options.command}"]`,
      );
      if (!dialog.contains(event.target) && !trigger?.contains(event.target)) close();
    };

    dialog.querySelector("[data-editra-cancel]").addEventListener("click", () => close());
    dialog.addEventListener("editra:close", close);
    dialog.addEventListener("keydown", handleKeydown);
    form.addEventListener("submit", handleSubmit);
    document.addEventListener("pointerdown", handleOutside, true);
    unregister = core.registerCleanup(close);
    input.focus({ preventScroll: true });
    input.select();
    return dialog;
  }

  function createBarcodeMarkup(value, format) {
    const normalized = normalizeBarcode(value, format);
    if (normalized.error) return normalized;
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    global.JsBarcode(svg, normalized.value, {
      format,
      background: "#ffffff",
      lineColor: "#000000",
      width: format === "EAN13" ? 2 : 2.2,
      height: 78,
      margin: 10,
      displayValue: true,
      font: "Arial",
      fontOptions: "normal",
      fontSize: 18,
      textMargin: 4,
      xmlDocument: document,
    });
    svg.setAttribute("role", "img");
    svg.setAttribute("aria-label", `${normalized.definition.label} barcode ${normalized.value}`);
    svg.setAttribute("focusable", "false");

    const wrapper = document.createElement("span");
    wrapper.className = "editra-barcode";
    wrapper.contentEditable = "false";
    wrapper.draggable = true;
    wrapper.dataset.editraSelectable = "true";
    wrapper.dataset.editraDraggable = "true";
    wrapper.dataset.editraBarcode = normalized.value;
    wrapper.dataset.editraBarcodeFormat = format;
    wrapper.style.width = `${Math.ceil(Number(svg.getAttribute("width")) || 320)}px`;
    wrapper.append(svg);
    return { node: wrapper, value: normalized.value };
  }

  function createQrMarkup(value) {
    const normalized = String(value).trim();
    if (!normalized) return { error: "Enter text or a URL." };
    const qr = global.qrcode(0, "M");
    qr.addData(normalized, "Byte");
    qr.make();

    const modules = qr.getModuleCount();
    const quietZone = 4;
    const extent = modules + quietZone * 2;
    const path = [];
    for (let row = 0; row < modules; row += 1) {
      for (let column = 0; column < modules; column += 1) {
        if (qr.isDark(row, column)) {
          path.push(`M${column + quietZone} ${row + quietZone}h1v1h-1z`);
        }
      }
    }

    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", `0 0 ${extent} ${extent}`);
    svg.setAttribute("width", "180");
    svg.setAttribute("height", "180");
    svg.setAttribute("shape-rendering", "crispEdges");
    svg.setAttribute("role", "img");
    svg.setAttribute("aria-label", `QR code for ${normalized}`);
    svg.setAttribute("focusable", "false");
    const background = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    background.setAttribute("width", "100%");
    background.setAttribute("height", "100%");
    background.setAttribute("fill", "#ffffff");
    const modulesPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
    modulesPath.setAttribute("d", path.join(""));
    modulesPath.setAttribute("fill", "#000000");
    svg.append(background, modulesPath);

    const wrapper = document.createElement("span");
    wrapper.className = "editra-qr-code";
    wrapper.contentEditable = "false";
    wrapper.draggable = true;
    wrapper.dataset.editraSelectable = "true";
    wrapper.dataset.editraDraggable = "true";
    wrapper.dataset.editraQr = normalized;
    wrapper.dataset.editraQrErrorCorrection = "M";
    wrapper.style.width = "180px";
    wrapper.append(svg);
    return { node: wrapper, value: normalized };
  }

  function insertNode(core, node, kind) {
    const frame = core.makeMediaResizable(node, kind);
    return Boolean(core.insertNode(frame));
  }

  async function insertBarcode(core, options = {}) {
    const value = String(options.value ?? "").trim();
    const format = String(options.format || "CODE128").toUpperCase();
    if (!value) {
      const initialValue = selectedText(core);
      createDialog(core, {
        command: "insertBarcode",
        title: "Insert barcode",
        label: "Text or product ID",
        value: initialValue,
        format,
        onConfirm: (input, selectedFormat) =>
          insertBarcode(core, { value: input, format: selectedFormat }),
      });
      return true;
    }
    await ensureRuntimes(core);
    const result = createBarcodeMarkup(value, format);
    return result.error ? result : insertNode(core, result.node, "barcode");
  }

  async function insertQrCode(core, options = {}) {
    const value = String(options.value ?? "").trim();
    if (!value) {
      createDialog(core, {
        command: "insertQrCode",
        title: "Insert QR code",
        label: "Text or URL",
        value: selectedText(core),
        onConfirm: (input) => insertQrCode(core, { value: input }),
      });
      return true;
    }
    await ensureRuntimes(core);
    const result = createQrMarkup(value);
    return result.error ? result : insertNode(core, result.node, "qr");
  }

  function install(core) {
    if (installations.has(core)) return installations.get(core);
    const unregisterCommands = [
      core.registerCommand("insertBarcode", (options) => insertBarcode(core, options), {
        plugin: "codes",
        source: "plugin",
      }),
      core.registerCommand("insertQrCode", (options) => insertQrCode(core, options), {
        plugin: "codes",
        source: "plugin",
      }),
    ];
    const state = { unregisterCommands };
    core.registerCleanup(() => {
      closeOpenDialog();
      unregisterCommands.forEach((unregister) => unregister());
      installations.delete(core);
      runtimePromises.delete(core);
    });
    installations.set(core, state);
    return state;
  }

  function CodesPlugin(core) {
    install(core);
    return insertBarcode(core);
  }

  CodesPlugin.install = install;
  CodesPlugin.hydrate = install;
  CodesPlugin.plugin = Object.freeze({
    name: "codes",
    label: "Barcode",
    command: "insertBarcode",
  });

  global.CodesPlugin = CodesPlugin;
  (global.EditraPlugins ??= Object.create(null)).codes = CodesPlugin;
})(window);
