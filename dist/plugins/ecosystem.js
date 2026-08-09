/**
 * Installs validated community plugins in capability-limited iframes.
 *
 * Community code never receives the Editra core or direct document DOM access.
 * All requests cross a bounded message channel and require an allowed capability
 * plus, for commands, an explicit command allowlist.
 */
(function (global) {
  "use strict";

  const installations = new WeakMap();
  const ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
  const VERSION_PATTERN = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;
  const INTEGRITY_PATTERN = /^sha256-[A-Za-z0-9+/]+={0,2}$/;
  const CAPABILITIES = new Set([
    "document.readText",
    "document.readHTML",
    "commands.execute",
    "ui.notify",
  ]);

  /** Converts a semantic version to the numeric parts needed for comparison. */
  function versionParts(value) {
    return String(value).split(/[.-]/, 3).map((part) => Number(part) || 0);
  }

  /** Compares two semantic versions without changing either value. */
  function compareVersions(left, right) {
    const a = versionParts(left);
    const b = versionParts(right);
    for (let index = 0; index < 3; index += 1) {
      if (a[index] !== b[index]) return a[index] > b[index] ? 1 : -1;
    }
    return 0;
  }

  /** Checks Editra's supported minimum-version compatibility syntax. */
  function supportsVersion(range, current) {
    const match = String(range).trim().match(/^>=(\d+\.\d+\.\d+)$/);
    return Boolean(match && compareVersions(current, match[1]) >= 0);
  }

  /** Reads and bounds a required text field from untrusted manifest data. */
  function requiredText(source, key, maximum) {
    const value = String(source?.[key] ?? "").trim();
    if (!value || value.length > maximum) {
      throw new TypeError(`Community plugin metadata has an invalid ${key}.`);
    }
    return value;
  }

  /** Validates and freezes community-plugin metadata before any network access. */
  function validateManifest(core, input) {
    if (!input || typeof input !== "object" || Array.isArray(input)) {
      throw new TypeError("Community plugin metadata must be an object.");
    }
    const id = requiredText(input, "id", 80);
    const name = requiredText(input, "name", 100);
    const version = requiredText(input, "version", 40);
    const author = requiredText(input, "author", 100);
    const description = requiredText(input, "description", 500);
    const compatibility = requiredText(input, "compatibility", 40);
    const entry = requiredText(input, "entry", 2048);
    const integrity = requiredText(input, "integrity", 120);
    if (!ID_PATTERN.test(id)) throw new TypeError("Invalid community plugin id.");
    if (!VERSION_PATTERN.test(version)) {
      throw new TypeError("Invalid community plugin version.");
    }
    if (!supportsVersion(compatibility, core.constructor.VERSION)) {
      throw new RangeError(
        `${name} ${version} is incompatible with Editra ${core.constructor.VERSION}.`,
      );
    }
    if (!INTEGRITY_PATTERN.test(integrity)) {
      throw new TypeError("Community plugins require a SHA-256 integrity value.");
    }
    const url = new URL(entry, document.baseURI);
    if (!core.security.config.allowedPluginOrigins.includes(url.origin)) {
      throw new TypeError(`Editra blocked community plugin origin: ${url.origin}`);
    }
    const permissions = [...new Set(input.permissions ?? [])].map(String);
    if (permissions.some((permission) => !CAPABILITIES.has(permission))) {
      throw new TypeError("Community plugin requested an unknown capability.");
    }
    const allowedCommands = [...new Set(input.allowedCommands ?? [])]
      .map(String)
      .filter((command) => command && command.length <= 80)
      .slice(0, 50);
    return Object.freeze({
      id,
      name,
      version,
      author,
      description,
      compatibility,
      entry: url.href,
      integrity,
      permissions: Object.freeze(permissions),
      allowedCommands: Object.freeze(allowedCommands),
      homepage: input.homepage ? String(input.homepage) : "",
      ui: Object.freeze({
        visible: input.ui?.visible === true,
        title: String(input.ui?.title || name).slice(0, 100),
      }),
    });
  }

  /** Calculates the Subresource Integrity form of a SHA-256 digest. */
  async function sha256(value) {
    const bytes = new TextEncoder().encode(value);
    const digest = await crypto.subtle.digest("SHA-256", bytes);
    const binary = String.fromCharCode(...new Uint8Array(digest));
    return `sha256-${btoa(binary)}`;
  }

  /** Downloads a community entry and verifies its immutable integrity value. */
  async function verifyEntry(core, manifest) {
    if (!core.security.config.requireCommunityPluginIntegrity) return true;
    const response = await core.secureRequest(manifest.entry, {
      method: "GET",
      credentials: "same-origin",
    });
    if (!response.ok) {
      throw new Error(`Unable to fetch community plugin: ${response.status}`);
    }
    const actual = await sha256(await response.text());
    if (actual !== manifest.integrity) {
      throw new TypeError(`Integrity verification failed for ${manifest.id}.`);
    }
    return true;
  }

  /** Sends a bounded capability response to one installed plugin frame. */
  function response(frame, pluginId, requestId, result, error = null) {
    frame.contentWindow?.postMessage(
      {
        source: "editra-host",
        pluginId,
        type: "response",
        requestId,
        result,
        error,
      },
      "*",
    );
  }

  /** Validates and handles one capability request from a known plugin frame. */
  async function handleRequest(core, installed, event) {
    const message = event.data;
    if (!message || message.source !== "editra-plugin") return;
    const record = installed.get(String(message.pluginId));
    if (!record || event.source !== record.frame.contentWindow) return;
    if (message.type === "ready") {
      record.frame.contentWindow.postMessage(
        {
          source: "editra-host",
          pluginId: record.manifest.id,
          type: "init",
          apiVersion: "1.0.0",
          manifest: record.manifest,
        },
        "*",
      );
      return;
    }
    if (message.type !== "request") return;
    const capability = String(message.capability ?? "");
    const requestId = String(message.requestId ?? "").slice(0, 100);
    if (!record.manifest.permissions.includes(capability)) {
      response(record.frame, record.manifest.id, requestId, null, "Capability denied");
      return;
    }
    try {
      let result;
      if (capability === "document.readText") result = core.getText();
      else if (capability === "document.readHTML") result = core.getCode();
      else if (capability === "ui.notify") {
        const text = String(message.payload?.message ?? "").slice(0, 300);
        core.announce(text);
        core.editor.dispatchEvent(
          new CustomEvent("editra:community-plugin-notify", {
            bubbles: true,
            detail: { pluginId: record.manifest.id, message: text },
          }),
        );
        result = true;
      } else if (capability === "commands.execute") {
        const command = String(message.payload?.command ?? "");
        if (!record.manifest.allowedCommands.includes(command)) {
          throw new TypeError("Command is not allowed by the plugin manifest.");
        }
        result = await core.executeCommand(
          command,
          ...(Array.isArray(message.payload?.args) ? message.payload.args : []),
        );
      }
      response(record.frame, record.manifest.id, requestId, result);
    } catch (error) {
      response(
        record.frame,
        record.manifest.id,
        requestId,
        null,
        String(error?.message || error),
      );
    }
  }

  /** Validates, verifies, and mounts a community plugin in a sandboxed iframe. */
  async function installPlugin(core, state, input) {
    if (!core.security.config.allowCommunityPlugins) {
      core.security.violation(
        "community-plugin-blocked",
        "The active security profile does not permit community plugins.",
      );
      throw new TypeError(
        "Editra regulated mode does not permit community plugins.",
      );
    }
    const manifest = validateManifest(core, input);
    const current = state.installed.get(manifest.id);
    if (current && compareVersions(current.manifest.version, manifest.version) >= 0) {
      return current.manifest;
    }
    await verifyEntry(core, manifest);
    if (current) {
      current.frame.remove();
      state.installed.delete(manifest.id);
    }
    const frame = document.createElement("iframe");
    frame.className = "editra-community-plugin-frame";
    frame.dataset.editraUi = "true";
    frame.dataset.editraPluginId = manifest.id;
    frame.sandbox = "allow-scripts";
    frame.referrerPolicy = "no-referrer";
    frame.title = manifest.ui.title;
    frame.hidden = !manifest.ui.visible;
    frame.src = manifest.entry;
    core.toolbar.card.append(frame);
    state.installed.set(manifest.id, { manifest, frame });
    core.editor.dispatchEvent(
      new CustomEvent("editra:community-plugin-installed", {
        bubbles: true,
        detail: { manifest },
      }),
    );
    return manifest;
  }

  /** Removes a community frame, listeners, and stored installation metadata. */
  function uninstallPlugin(core, state, id) {
    const pluginId = String(id ?? "");
    const record = state.installed.get(pluginId);
    if (!record) return false;
    record.frame.remove();
    state.installed.delete(pluginId);
    core.editor.dispatchEvent(
      new CustomEvent("editra:community-plugin-uninstalled", {
        bubbles: true,
        detail: { pluginId },
      }),
    );
    return true;
  }

  /** Compares installed versions with a validated, origin-approved registry. */
  async function checkUpdates(core, state, registryUrl) {
    const response = await core.secureRequest(registryUrl || "plugins/registry.json");
    if (!response.ok) throw new Error(`Unable to load plugin registry: ${response.status}`);
    const registry = await response.json();
    const available = new Map(
      (Array.isArray(registry.plugins) ? registry.plugins : [])
        .filter((item) => item.type === "community")
        .map((item) => [item.id, item]),
    );
    return [...state.installed.values()].flatMap(({ manifest }) => {
      const candidate = available.get(manifest.id);
      return candidate && compareVersions(candidate.version, manifest.version) > 0
        ? [{ id: manifest.id, current: manifest.version, available: candidate.version }]
        : [];
    });
  }

  /** Installs ecosystem commands and the shared message listener once. */
  function install(core) {
    if (installations.has(core)) return installations.get(core);
    const state = { installed: new Map(), unregister: [] };
    const listener = (event) => handleRequest(core, state.installed, event);
    global.addEventListener("message", listener);
    const handlers = {
      installCommunityPlugin: (manifest) => installPlugin(core, state, manifest),
      uninstallCommunityPlugin: (id) => uninstallPlugin(core, state, id),
      getInstalledCommunityPlugins: () =>
        [...state.installed.values()].map(({ manifest }) => manifest),
      checkCommunityPluginUpdates: (url) => checkUpdates(core, state, url),
    };
    state.unregister = Object.entries(handlers).map(([name, handler]) =>
      core.registerCommand(name, handler, {
        plugin: "ecosystem",
        source: "sandbox",
      }),
    );
    core.registerCleanup(() => {
      global.removeEventListener("message", listener);
      state.unregister.forEach((remove) => remove());
      state.installed.forEach(({ frame }) => frame.remove());
      state.installed.clear();
      installations.delete(core);
    });
    installations.set(core, state);
    return state;
  }

  /** Plugin entry that installs the ecosystem or adds one supplied manifest. */
  function EcosystemPlugin(core, manifest) {
    return installPlugin(core, install(core), manifest);
  }

  EcosystemPlugin.install = install;
  EcosystemPlugin.plugin = Object.freeze({
    name: "ecosystem",
    label: "Plugin ecosystem",
    command: "installCommunityPlugin",
  });
  (global.EditraPlugins ??= Object.create(null)).ecosystem = EcosystemPlugin;
})(window);
