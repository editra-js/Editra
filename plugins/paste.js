(function (global) {
  "use strict";

  const installations = new WeakMap();
  function sanitizeHTML(core, html, kind = "paste") {
    return String(core.sanitizeHTML(html, { kind }));
  }

  function insertHTML(core, html, savedRange = null) {
    core.restoreSelection();
    const selection = global.getSelection();
    let range =
      savedRange && core.isRangeInside(savedRange)
        ? savedRange
        : selection?.rangeCount && core.isRangeInside(selection.getRangeAt(0))
          ? selection.getRangeAt(0)
          : null;
    if (!range) {
      range = document.createRange();
      range.selectNodeContents(core.editor);
      range.collapse(false);
    }
    const fragment = range.createContextualFragment(String(html ?? ""));
    const lastNode = fragment.lastChild;
    range.deleteContents();
    range.insertNode(fragment);
    if (lastNode) {
      range.setStartAfter(lastNode);
      range.collapse(true);
      selection.removeAllRanges();
      selection.addRange(range);
      core.selection = range.cloneRange();
    }
    core.recordHistory();
    core.scheduleUpdate("paste-change", () => core.emitChange());
    return true;
  }

  function insertText(core, text, savedRange = null) {
    core.restoreSelection();
    const selection = global.getSelection();
    if (savedRange && core.isRangeInside(savedRange)) {
      selection.removeAllRanges();
      selection.addRange(savedRange);
    }
    core.execCommand("insertText", String(text ?? ""));
    core.captureSelection();
    core.recordHistory();
    core.scheduleUpdate("paste-change", () => core.emitChange());
    return true;
  }

  async function insertClipboardImage(core, file) {
    const imagePlugin = core.plugins.get("image");
    if (imagePlugin) {
      const plugin = imagePlugin.action
        ? imagePlugin
        : await core.ensurePlugin("image");
      return plugin.action.insertFile(core, file);
    }
    const dataUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.addEventListener("load", () => resolve(reader.result), {
        once: true,
      });
      reader.addEventListener("error", reject, { once: true });
      reader.readAsDataURL(file);
    });
    return core.insertImage(dataUrl, {
      source: "bytes",
      name: file.name,
      mime: file.type,
    });
  }

  function applyPasteResult(core, payload, result, savedRange) {
    if (result === false || payload.cancelled) return false;
    if (typeof result === "string") payload.html = result;
    else if (result && typeof result === "object") {
      if ("html" in result) payload.html = String(result.html ?? "");
      if ("text" in result) payload.text = String(result.text ?? "");
    }
    const html = sanitizeHTML(core, payload.html);
    if (html) return insertHTML(core, html, savedRange);
    const image = payload.files.find((file) => file.type.startsWith("image/"));
    if (image) return insertClipboardImage(core, image);
    return insertText(core, payload.text, savedRange);
  }

  function handlePaste(core, event) {
    if (!core.editor.contains(event.target)) return;
    const clipboard = event.clipboardData;
    if (!clipboard) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    core.captureSelection();
    const savedRange =
      core.selection && core.isRangeInside(core.selection)
        ? core.selection.cloneRange()
        : null;
    const payload = {
      html: clipboard.getData("text/html") || "",
      text: clipboard.getData("text/plain") || "",
      files: [...(clipboard.files ?? [])],
      types: [...(clipboard.types ?? [])],
      sanitizePaste: Boolean(core.options.sanitizePaste),
      nativeEvent: event,
      editor: core,
      cancelled: false,
      cancel() {
        this.cancelled = true;
      },
    };
    const pasteEvent = new CustomEvent("editra:paste", {
      bubbles: true,
      cancelable: true,
      detail: payload,
    });
    core.editor.dispatchEvent(pasteEvent);
    if (pasteEvent.defaultPrevented) payload.cancelled = true;

    let result;
    if (typeof core.options.onPaste === "function") {
      result = core.options.onPaste(payload);
    }
    if (result && typeof result.then === "function") {
      return result.then((resolved) =>
        applyPasteResult(core, payload, resolved, savedRange),
      );
    }
    return applyPasteResult(core, payload, result, savedRange);
  }

  function install(core) {
    if (installations.has(core)) return installations.get(core);
    const unregisterCommands = [
      core.registerCommand(
        "pasteHTML",
        (html) => insertHTML(core, sanitizeHTML(core, html, "pasteHTML")),
        { plugin: "paste", source: "plugin" },
      ),
      core.registerCommand("sanitizeHTML", (html) => sanitizeHTML(core, html), {
        plugin: "paste",
        source: "plugin",
      }),
    ];
    const paste = (event) => handlePaste(core, event);
    core.editor.addEventListener("paste", paste, true);
    const state = { unregisterCommands, paste };
    core.registerCleanup(() => {
      core.editor.removeEventListener("paste", paste, true);
      unregisterCommands.forEach((unregister) => unregister());
      installations.delete(core);
    });
    installations.set(core, state);
    return state;
  }

  function PastePlugin(core, html, options) {
    install(core);
    return insertHTML(
      core,
      options?.sanitize ? sanitizeHTML(html) : html,
    );
  }

  PastePlugin.install = install;
  PastePlugin.hydrate = install;
  PastePlugin.sanitizeHTML = sanitizeHTML;
  PastePlugin.plugin = Object.freeze({
    name: "paste",
    label: "Paste handling",
    hidden: true,
  });

  global.PastePlugin = PastePlugin;
  (global.EditraPlugins ??= Object.create(null)).paste = PastePlugin;
})(window);
