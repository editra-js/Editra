// Version: 2.0.0
/**
 * Product: Editra
 * Author: Editra Team
 * Version: 2.0.0
 * Purpose: Implements the Editra video plugin and its editor commands.
 * Licensing: MIT License (open source)
 */

(function (global) {
  "use strict";

  const installations = new WeakMap();

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

  function embedUrl(value) {
    try {
      const url = new URL(value, document.baseURI);
      let id = "";
      if (url.hostname === "youtu.be") id = url.pathname.split("/")[1] || "";
      else if (url.hostname.endsWith("youtube.com")) {
        id =
          url.searchParams.get("v") ||
          url.pathname.match(/\/(?:embed|shorts)\/([^/?]+)/)?.[1] ||
          "";
      }
      if (id) {
        const embed = new URL(
          `https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}`,
        );
        if (location.protocol === "http:" || location.protocol === "https:") {
          embed.searchParams.set("enablejsapi", "1");
          embed.searchParams.set("origin", location.origin);
          embed.searchParams.set("widget_referrer", location.href);
        }
        return embed.href;
      }

      if (url.hostname.endsWith("vimeo.com")) {
        const vimeoId = url.pathname.match(/\/(?:video\/)?(\d+)/)?.[1];
        if (vimeoId) return `https://player.vimeo.com/video/${vimeoId}`;
      }
      return "";
    } catch {
      return "";
    }
  }

  function insertUrl(core, value, options = {}) {
    const embedded = embedUrl(value);
    if (embedded) {
      if (location.protocol === "file:") {
        core.dispatchCommand("youtube-origin-required", {
          url: value,
          message:
            "YouTube embeds require an HTTP origin. Open Editra at http://localhost:8080 instead of using file://.",
        });
        global.alert(
          "YouTube playback requires Editra to run through localhost.\n\nRun start-editra.cmd, then open http://localhost:8080.",
        );
        return false;
      }
      return core.insertVideoEmbed(embedded);
    }

    const directVideo =
      /(?:\.(?:mp4|webm|ogv|ogg|m3u8|mov))(?:[?#].*)?$/i.test(value) ||
      /^(?:blob:|file:|data:video\/)/i.test(value);
    return directVideo
      ? core.insertVideo(value, {
          source: "url",
          name: options.name,
          mime: options.mime,
        })
      : core.insertVideoEmbed(value);
  }

  function openDialog(core, options = {}) {
    closeOpenDialog();
    const dialog = document.createElement("div");
    dialog.className = "editra-media-dialog";
    dialog.setAttribute("role", "dialog");
    dialog.setAttribute("aria-label", "Insert video");
    dialog.innerHTML = `
      <div class="editra-dialog-heading">Insert video</div>
      <label class="editra-file-button">
        <span>Choose from device</span>
        <input type="file" accept="video/*" data-editra-file />
      </label>
      <div class="editra-dialog-divider"><span>or use a URL</span></div>
      <form class="editra-url-form">
        <input type="text" inputmode="url" placeholder="YouTube, Vimeo, MP4 or video URL" aria-label="Video URL" required />
        <button type="submit">Insert</button>
      </form>
    `;
    document.body.append(dialog);

    const trigger = core.toolbar.getButton("video");
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
      VideoPlugin.insertFile(core, file, options);
    }

    function handleUrl(event) {
      event.preventDefault();
      const url = urlInput.value.trim();
      if (!url) return;
      close();
      insertUrl(core, url, options);
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

  function insertVideoCommand(core, options = {}) {
    if (options instanceof Blob) return VideoPlugin.insertFile(core, options);
    if (options.file instanceof Blob) {
      return VideoPlugin.insertFile(core, options.file, options);
    }
    if (typeof options === "string") return insertUrl(core, options);
    if (options.url) return insertUrl(core, options.url, options);
    return openDialog(core, options);
  }

  function install(core) {
    if (installations.has(core)) return;
    const unregister = core.registerCommand(
      "insertVideo",
      (options) => insertVideoCommand(core, options),
      { plugin: "video", source: "plugin" },
    );
    core.registerCleanup(() => {
      unregister();
      installations.delete(core);
    });
    installations.set(core, true);
  }

  function VideoPlugin(core, options) {
    install(core);
    return insertVideoCommand(core, options);
  }

  VideoPlugin.insertFile = function insertFile(core, file, options = {}) {
    if (!(file instanceof Blob)) return false;
    if (file.size > core.security.config.maxMediaBytes) {
      core.security.violation("media-size", "Video exceeds the media limit.", {
        actual: file.size,
        limit: core.security.config.maxMediaBytes,
      });
      throw new RangeError("Editra rejected an oversized video.");
    }
    const objectUrl = URL.createObjectURL(file);
    return core.insertVideo(objectUrl, {
      source: "local",
      name: options.name || file.name || "local-video",
      mime: options.mime || file.type || "application/octet-stream",
    });
  };

  VideoPlugin.insertUrl = insertUrl;
  VideoPlugin.install = install;
  VideoPlugin.hydrate = function hydrate(core, root) {
    install(core);
    root
      .querySelectorAll("video, iframe[data-editra-video]")
      .forEach((video) => core.makeMediaResizable(video, "video"));
  };

  VideoPlugin.plugin = Object.freeze({
    name: "video",
    label: "Insert video",
    icon: "video",
    command: "insertVideo",
  });

  global.VideoPlugin = VideoPlugin;
  (global.EditraPlugins ??= Object.create(null)).video = VideoPlugin;
})(window);
