/**
 * Product: Editra
 * Author: Editra Team
 * Version: 1.17.0
 * Purpose: Implements the Editra image plugin and its editor commands.
 * Licensing: MIT License (open source)
 */

(function (global) {
  "use strict";

  const installations = new WeakMap();
  const TEST_IMAGE =
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";

  function positionDialog(dialog, trigger) {
    const rect = trigger?.getBoundingClientRect();
    if (!rect) return;
    const width = 330;
    dialog.style.left = `${Math.max(
      12,
      Math.min(rect.left, innerWidth - width - 12),
    )}px`;
    dialog.style.top = `${Math.min(rect.bottom + 8, innerHeight - 230)}px`;
  }

  function closeOpenDialog() {
    document
      .querySelector(".editra-media-dialog")
      ?.dispatchEvent(new CustomEvent("editra:close"));
  }

  function insertBytes(core, bytes, options = {}) {
    const blob =
      bytes instanceof Blob
        ? bytes
        : new Blob([bytes], {
            type: options.mime || "application/octet-stream",
          });
    return ImagePlugin.insertFile(core, blob, options);
  }

  function openDialog(core, options = {}) {
    closeOpenDialog();
    const dialog = document.createElement("div");
    dialog.className = "editra-media-dialog";
    dialog.setAttribute("role", "dialog");
    dialog.setAttribute("aria-label", "Insert image");
    dialog.innerHTML = `
      <div class="editra-dialog-heading">Insert image</div>
      <label class="editra-file-button">
        <span>Choose from device</span>
        <input type="file" accept="image/*" data-editra-file />
      </label>
      <div class="editra-dialog-divider"><span>or use a URL</span></div>
      <form class="editra-url-form">
        <input type="text" inputmode="url" placeholder="https://example.com/image.jpg" aria-label="Image URL" required />
        <button type="submit">Insert</button>
      </form>
    `;
    document.body.append(dialog);

    const trigger = core.toolbar.getButton("image");
    const fileInput = dialog.querySelector("[data-editra-file]");
    const form = dialog.querySelector(".editra-url-form");
    const urlInput = form.querySelector("input");
    positionDialog(dialog, trigger);

    let unregister = () => {};
    let closed = false;
    function close() {
      if (closed) return;
      closed = true;
      dialog.removeEventListener("editra:close", close);
      dialog.removeEventListener("keydown", handleKeydown);
      fileInput.removeEventListener("change", handleFile);
      form.removeEventListener("submit", handleUrl);
      document.removeEventListener("pointerdown", handleOutside);
      dialog.remove();
      unregister();
    }

    function handleFile() {
      const file = fileInput.files?.[0];
      if (!file) return;
      close();
      ImagePlugin.insertFile(core, file, options);
    }

    function handleUrl(event) {
      event.preventDefault();
      const url = urlInput.value.trim();
      if (!url) return;
      close();
      core.insertImage(url, {
        source: "url",
        alt: options.alt,
      });
    }

    function handleOutside(event) {
      if (!dialog.contains(event.target) && event.target !== trigger) close();
    }

    function handleKeydown(event) {
      if (event.key === "Escape") close();
    }

    dialog.addEventListener("editra:close", close);
    dialog.addEventListener("keydown", handleKeydown);
    fileInput.addEventListener("change", handleFile);
    form.addEventListener("submit", handleUrl);
    document.addEventListener("pointerdown", handleOutside);
    unregister = core.registerCleanup(close);

    if (options.source === "local") {
      requestAnimationFrame(() => fileInput.click());
    } else {
      urlInput.focus({ preventScroll: true });
    }
    return dialog;
  }

  function insertImageCommand(core, options = {}) {
    if (options instanceof Blob) return ImagePlugin.insertFile(core, options);
    if (options.file instanceof Blob) {
      return ImagePlugin.insertFile(core, options.file, options);
    }
    if (options.bytes) return insertBytes(core, options.bytes, options);
    if (typeof options === "string") {
      return core.insertImage(options, { source: "url" });
    }
    if (options.url) {
      return core.insertImage(options.url, {
        source: "url",
        alt: options.alt,
      });
    }
    return openDialog(core, options);
  }

  function install(core) {
    if (installations.has(core)) return;
    const unregisterCommands = [
      core.registerCommand(
        "insertImage",
        (options) => insertImageCommand(core, options),
        { plugin: "image", source: "plugin" },
      ),
      core.registerCommand(
        "mediaStressTest",
        (options) => ImagePlugin.stressTest(core, options),
        { plugin: "image", source: "plugin" },
      ),
    ];
    core.registerCleanup(() => {
      unregisterCommands.forEach((unregister) => unregister());
      installations.delete(core);
    });
    installations.set(core, true);
  }

  function ImagePlugin(core, options) {
    install(core);
    return insertImageCommand(core, options);
  }

  ImagePlugin.insertFile = function insertFile(core, file, options = {}) {
    if (!(file instanceof Blob)) return false;
    if (file.size > core.security.config.maxMediaBytes) {
      core.security.violation("media-size", "Image exceeds the media limit.", {
        actual: file.size,
        limit: core.security.config.maxMediaBytes,
      });
      throw new RangeError("Editra rejected an oversized image.");
    }
    const reader = new FileReader();
    let unregister = () => {};

    function cleanup() {
      if (reader.readyState === FileReader.LOADING) reader.abort();
      unregister();
    }

    reader.addEventListener(
      "load",
      () => {
        unregister();
        if (core.destroyed || typeof reader.result !== "string") return;
        core.insertImage(reader.result, {
          source: "bytes",
          alt: options.alt,
          name: options.name || file.name || "clipboard-image",
          mime: options.mime || file.type || "application/octet-stream",
        });
      },
      { once: true },
    );
    reader.addEventListener("error", cleanup, { once: true });
    reader.addEventListener("abort", () => unregister(), { once: true });
    unregister = core.registerCleanup(cleanup);
    reader.readAsDataURL(file);
    return true;
  };

  ImagePlugin.install = install;
  ImagePlugin.hydrate = function hydrate(core, root) {
    install(core);
    root.querySelectorAll("img").forEach((image) => {
      core.makeMediaResizable(image, "image");
    });
  };

  ImagePlugin.stressTest = async function stressTest(
    core,
    { images = 30, videos = 10, keep = false } = {},
  ) {
    const startedAt = performance.now();
    const group = document.createElement("div");
    group.className = "editra-media-stress-group";

    for (let start = 0; start < images + videos; start += 10) {
      const fragment = document.createDocumentFragment();
      const end = Math.min(start + 10, images + videos);
      for (let index = start; index < end; index += 1) {
        if (index < images) {
          const image = document.createElement("img");
          image.src = TEST_IMAGE;
          image.alt = "";
          image.dataset.editraSource = "bytes";
          fragment.append(core.makeMediaResizable(image, "image"));
        } else {
          const video = document.createElement("video");
          video.controls = true;
          video.playsInline = true;
          video.preload = "none";
          fragment.append(core.makeMediaResizable(video, "video"));
        }
      }
      group.append(fragment);
      if (end < images + videos) {
        await new Promise((resolve) => requestAnimationFrame(resolve));
      }
    }

    core.insertNode(group);
    await new Promise((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(resolve)),
    );
    const result = {
      images,
      videos,
      elements: images + videos,
      renderMs: Math.round(performance.now() - startedAt),
    };
    if (!keep) {
      group.remove();
      core.recordHistory();
    }
    return result;
  };

  ImagePlugin.plugin = Object.freeze({
    name: "image",
    label: "Insert image",
    icon: "image",
    command: "insertImage",
  });

  global.ImagePlugin = ImagePlugin;
  (global.EditraPlugins ??= Object.create(null)).image = ImagePlugin;
})(window);
