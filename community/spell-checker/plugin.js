(function () {
  "use strict";
  const pluginId = "spell-checker";
  const pending = new Map();
  let sequence = 0;

  function request(capability, payload = {}) {
    const requestId = `${pluginId}-${++sequence}`;
    parent.postMessage(
      { source: "editra-plugin", pluginId, type: "request", requestId, capability, payload },
      "*",
    );
    return new Promise((resolve, reject) => pending.set(requestId, { resolve, reject }));
  }

  addEventListener("message", (event) => {
    const message = event.data;
    if (!message || message.source !== "editra-host" || message.pluginId !== pluginId) return;
    if (message.type === "response") {
      const operation = pending.get(message.requestId);
      if (!operation) return;
      pending.delete(message.requestId);
      message.error ? operation.reject(new Error(message.error)) : operation.resolve(message.result);
    }
  });

  document.querySelector("#check").addEventListener("click", async () => {
    const output = document.querySelector("#result");
    try {
      const text = await request("document.readText");
      const words = String(text).trim().split(/\s+/).filter(Boolean);
      const repeated = words.filter((word, index) =>
        index > 0 && word.toLowerCase() === words[index - 1].toLowerCase(),
      );
      output.textContent = repeated.length
        ? `Possible repeated words: ${[...new Set(repeated)].join(", ")}`
        : `Checked ${words.length} words; no adjacent repeats found.`;
    } catch (error) {
      output.textContent = error.message;
    }
  });

  parent.postMessage({ source: "editra-plugin", pluginId, type: "ready" }, "*");
})();
