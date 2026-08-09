(function (global) {
  "use strict";

  const MAX_MESSAGE_BYTES = 6 * 1024 * 1024;
  const MAX_PENDING_REQUESTS = 100;
  const REQUEST_TIMEOUT_MS = 30000;

  function bytes(value) {
    try {
      const text = JSON.stringify(value);
      return new TextEncoder().encode(text).byteLength;
    } catch {
      return Number.POSITIVE_INFINITY;
    }
  }

  function channelId() {
    if (global.crypto?.randomUUID) return global.crypto.randomUUID();
    if (!global.crypto?.getRandomValues) {
      throw new Error("Editra isolation requires a cryptographic random source.");
    }
    const value = new Uint32Array(4);
    global.crypto.getRandomValues(value);
    return Array.from(value, (part) => part.toString(16).padStart(8, "0")).join("");
  }

  function regulated(config) {
    return config.regulated === true ||
      String(config.security?.profile ?? "").toLowerCase() === "regulated";
  }

  function serializableConfig(config) {
    const copy = {};
    Object.entries(config).forEach(([key, value]) => {
      if (
        !["selector", "isolation", "isolationUrl", "onChange", "onStateChange",
          "onSecurityViolation", "onFocus", "onBlur", "onCommand"].includes(key) &&
        typeof value !== "function"
      ) {
        copy[key] = value;
      }
    });
    return copy;
  }

  async function init(config) {
    if (!config || typeof config !== "object" || Array.isArray(config)) {
      throw new TypeError("Isolated Editra requires a configuration object.");
    }
    const host = typeof config.selector === "string"
      ? document.querySelector(config.selector)
      : config.selector;
    if (!(host instanceof HTMLElement)) {
      throw new TypeError("Editra isolation could not resolve the host element.");
    }
    const target = new URL(String(config.isolationUrl || ""), document.baseURI);
    if (!/^https?:$/.test(target.protocol)) {
      throw new TypeError("Editra isolationUrl must use HTTP or HTTPS.");
    }
    if (regulated(config) && target.origin === global.location.origin) {
      throw new TypeError(
        "Editra regulated isolation requires a separate-origin iframe URL.",
      );
    }

    const channel = channelId();
    const parentOrigin = global.location.origin;
    const frame = document.createElement("iframe");
    frame.className = "editra-isolated-frame";
    frame.title = config.label || "Isolated document editor";
    frame.referrerPolicy = "no-referrer";
    frame.sandbox = "allow-scripts allow-same-origin";
    target.hash = new URLSearchParams({ channel, parentOrigin }).toString();

    const originalState = {
      hidden: host.hidden,
      display: host.style.display,
    };
    const initialHTML = host instanceof HTMLTextAreaElement
      ? host.value
      : host.innerHTML;
    host.hidden = true;
    host.style.display = "none";
    host.after(frame);

    let destroyed = false;
    let initialized = false;
    let requestSequence = 0;
    const pending = new Map();
    let resolveReady;
    let rejectReady;
    const ready = new Promise((resolve, reject) => {
      resolveReady = resolve;
      rejectReady = reject;
    });

    function send(message) {
      const envelope = { source: "editra-isolation-host", channel, ...message };
      if (bytes(envelope) > MAX_MESSAGE_BYTES) {
        throw new RangeError("Editra isolation message exceeds the byte limit.");
      }
      frame.contentWindow?.postMessage(envelope, target.origin);
    }

    function cleanup(reason = new Error("Editra isolated editor was destroyed.")) {
      if (destroyed) return;
      destroyed = true;
      global.removeEventListener("message", onMessage);
      pending.forEach(({ reject, timer }) => {
        clearTimeout(timer);
        reject(reason);
      });
      pending.clear();
      frame.remove();
      host.hidden = originalState.hidden;
      host.style.display = originalState.display;
      if (host.editraInstance === proxy) delete host.editraInstance;
    }

    function request(operation, args = []) {
      if (destroyed) return Promise.reject(new Error("Editra isolated editor is destroyed."));
      if (pending.size >= MAX_PENDING_REQUESTS) {
        return Promise.reject(new RangeError("Too many pending Editra isolation requests."));
      }
      return ready.then(() => new Promise((resolve, reject) => {
        const requestId = `${channel}:${++requestSequence}`;
        const timer = setTimeout(() => {
          pending.delete(requestId);
          reject(new Error(`Editra isolation request timed out: ${operation}`));
        }, REQUEST_TIMEOUT_MS);
        pending.set(requestId, { resolve, reject, timer });
        try {
          send({ type: "request", requestId, operation, args });
        } catch (error) {
          clearTimeout(timer);
          pending.delete(requestId);
          reject(error);
        }
      }));
    }

    function onMessage(event) {
      if (
        event.source !== frame.contentWindow ||
        event.origin !== target.origin ||
        !event.data ||
        event.data.source !== "editra-isolation-frame" ||
        event.data.channel !== channel
      ) return;
      const message = event.data;
      if (bytes(message) > MAX_MESSAGE_BYTES) return;
      if (message.type === "ready" && !initialized) {
        initialized = true;
        try {
          send({
            type: "init",
            config: serializableConfig(config),
            initialHTML,
          });
        } catch (error) {
          rejectReady(error);
          cleanup(error);
        }
      } else if (message.type === "initialized") {
        resolveReady(proxy);
      } else if (message.type === "init-error") {
        const error = new Error(String(message.error || "Isolated initialization failed."));
        rejectReady(error);
        cleanup(error);
      } else if (message.type === "response") {
        const record = pending.get(String(message.requestId));
        if (!record) return;
        clearTimeout(record.timer);
        pending.delete(String(message.requestId));
        if (message.error) record.reject(new Error(String(message.error)));
        else record.resolve(message.result);
      } else if (message.type === "event") {
        if (message.name === "change") {
          if (host instanceof HTMLTextAreaElement) host.value = String(message.detail?.html || "");
          config.onChange?.({ ...message.detail, editor: null, isolated: true });
        } else if (message.name === "state") {
          config.onStateChange?.(message.detail);
        } else if (message.name === "security") {
          config.onSecurityViolation?.(message.detail);
        }
      }
    }

    const proxy = Object.freeze({
      isolation: "iframe",
      host,
      frame,
      ready,
      getCode: () => request("getCode"),
      getHTML: () => request("getCode"),
      getText: () => request("getText"),
      getState: () => request("getState"),
      getJSON: () => request("getJSON"),
      validateJSON: (documentModel) => request("validateJSON", [documentModel]),
      setCode: (html) => request("setCode", [String(html ?? "")]),
      setHTML: (html) => request("setCode", [String(html ?? "")]),
      setJSON: (documentModel) => request("setJSON", [documentModel]),
      focus: () => request("focus"),
      executeCommand: (name, ...args) =>
        request("executeCommand", [String(name), ...args]),
      async destroy() {
        try {
          await request("destroy");
        } finally {
          cleanup();
        }
      },
    });

    global.addEventListener("message", onMessage);
    host.editraInstance = proxy;
    frame.editraInstance = proxy;
    frame.src = target.href;
    const loadTimer = setTimeout(() => {
      if (!initialized) {
        const error = new Error("Timed out waiting for the Editra isolation frame.");
        rejectReady(error);
        cleanup(error);
      }
    }, REQUEST_TIMEOUT_MS);
    try {
      await ready;
      return proxy;
    } finally {
      clearTimeout(loadTimer);
    }
  }

  global.EditraIsolationHost = Object.freeze({ init });
})(window);
