(function (global) {
  "use strict";

  const MAX_MESSAGE_BYTES = 6 * 1024 * 1024;
  const OPERATIONS = new Set([
    "getCode",
    "getText",
    "getState",
    "getJSON",
    "validateJSON",
    "setCode",
    "setJSON",
    "focus",
    "executeCommand",
    "destroy",
  ]);
  const parameters = new URLSearchParams(global.location.hash.slice(1));
  const channel = String(parameters.get("channel") || "");
  let parentOrigin = "";
  try {
    parentOrigin = new URL(String(parameters.get("parentOrigin"))).origin;
  } catch {
    throw new Error("Editra isolation frame requires a valid parent origin.");
  }
  if (!channel || channel.length > 200) {
    throw new Error("Editra isolation frame requires a valid channel.");
  }

  let editor = null;
  let initialized = false;

  function bytes(value) {
    try {
      return new TextEncoder().encode(JSON.stringify(value)).byteLength;
    } catch {
      return Number.POSITIVE_INFINITY;
    }
  }

  function cloneable(value) {
    if (value instanceof Node) return true;
    try {
      return JSON.parse(JSON.stringify(value, (_key, item) =>
        item instanceof Node ? undefined : item,
      ));
    } catch {
      return null;
    }
  }

  function send(message) {
    const envelope = { source: "editra-isolation-frame", channel, ...message };
    if (bytes(envelope) > MAX_MESSAGE_BYTES) {
      throw new RangeError("Editra isolation response exceeds the byte limit.");
    }
    global.parent.postMessage(envelope, parentOrigin);
  }

  async function initialize(message) {
    if (initialized) throw new Error("Editra isolation frame is already initialized.");
    initialized = true;
    const config = message.config;
    if (!config || typeof config !== "object" || Array.isArray(config)) {
      throw new TypeError("Invalid isolated editor configuration.");
    }
    const initialHTML = String(message.initialHTML ?? "");
    if (new TextEncoder().encode(initialHTML).byteLength > MAX_MESSAGE_BYTES) {
      throw new RangeError("Initial isolated document exceeds the byte limit.");
    }
    const host = document.querySelector("#editra-isolated-editor");
    host.value = initialHTML;
    delete config.isolation;
    delete config.isolationUrl;
    config.selector = host;
    config.onChange = ({ html, text }) =>
      send({ type: "event", name: "change", detail: { html, text } });
    config.onStateChange = (state) =>
      send({ type: "event", name: "state", detail: cloneable(state) });
    config.onSecurityViolation = (event) =>
      send({ type: "event", name: "security", detail: cloneable(event) });
    editor = await global.Editra.init(config);
    send({ type: "initialized" });
  }

  async function execute(message) {
    const requestId = String(message.requestId || "").slice(0, 240);
    const operation = String(message.operation || "");
    if (!requestId || !OPERATIONS.has(operation) || !Array.isArray(message.args)) {
      throw new TypeError("Invalid isolated editor request.");
    }
    if (!editor) throw new Error("Isolated editor is not initialized.");
    let result;
    if (operation === "getCode") result = editor.getCode();
    else if (operation === "getText") result = editor.getText();
    else if (operation === "getState") result = editor.lastEmittedState || {};
    else if (operation === "getJSON") result = editor.getJSON();
    else if (operation === "validateJSON") result = editor.validateJSON(message.args[0]);
    else if (operation === "setCode") {
      editor.setCode(String(message.args[0] ?? ""));
      result = true;
    } else if (operation === "setJSON") {
      editor.setJSON(message.args[0]);
      result = true;
    } else if (operation === "focus") {
      editor.focus();
      result = true;
    } else if (operation === "executeCommand") {
      result = await editor.executeCommand(
        String(message.args[0] || ""),
        ...message.args.slice(1),
      );
    } else if (operation === "destroy") {
      editor.destroy();
      editor = null;
      result = true;
    }
    send({ type: "response", requestId, result: cloneable(result) });
  }

  global.addEventListener("message", async (event) => {
    if (
      event.source !== global.parent ||
      event.origin !== parentOrigin ||
      !event.data ||
      event.data.source !== "editra-isolation-host" ||
      event.data.channel !== channel ||
      bytes(event.data) > MAX_MESSAGE_BYTES
    ) return;
    try {
      if (event.data.type === "init") await initialize(event.data);
      else if (event.data.type === "request") await execute(event.data);
    } catch (error) {
      if (event.data.type === "init") {
        send({ type: "init-error", error: String(error?.message || error) });
      } else {
        send({
          type: "response",
          requestId: String(event.data.requestId || "").slice(0, 240),
          error: String(error?.message || error),
        });
      }
    }
  });

  send({ type: "ready" });
})(window);
