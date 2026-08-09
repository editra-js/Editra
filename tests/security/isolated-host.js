(async function () {
  "use strict";

  const result = document.querySelector("#test-result");
  const host = document.querySelector("#isolated-editor");
  const cspViolations = [];
  document.addEventListener("securitypolicyviolation", (event) => {
    cspViolations.push({
      directive: event.effectiveDirective,
      blockedURI: event.blockedURI,
      sourceFile: event.sourceFile,
      lineNumber: event.lineNumber,
    });
  });
  const assert = (condition, message) => {
    if (!condition) throw new Error(message);
  };

  try {
    const response = await fetch("../../plugins/runtime-integrity.json");
    assert(response.ok, "runtime integrity manifest was unavailable");
    const { integrity } = await response.json();
    const frameOrigin = `http://localhost:${location.port}`;
    const changes = [];
    const editor = await Editra.init({
      selector: host,
      isolation: "iframe",
      isolationUrl: `${frameOrigin}/isolation/frame.html`,
      regulated: true,
      theme: "Word",
      plugins: ["bold", "table"],
      toolbar: "bold | table | undo redo",
      security: {
        profile: "regulated",
        pluginIntegrity: integrity,
      },
      onChange(event) {
        changes.push(event.html);
      },
    });

    assert(editor.isolation === "iframe", "isolation proxy was not returned");
    assert(editor.frame instanceof HTMLIFrameElement, "isolated iframe was not created");
    assert(
      editor.frame.sandbox.contains("allow-scripts") &&
        editor.frame.sandbox.contains("allow-same-origin"),
      "iframe sandbox capabilities were not constrained",
    );
    assert(
      new URL(editor.frame.src).origin !== location.origin,
      "regulated iframe was not placed on a separate origin",
    );
    let parentCanReadFrame = false;
    try {
      parentCanReadFrame = Boolean(editor.frame.contentDocument?.body);
    } catch {
      parentCanReadFrame = false;
    }
    assert(!parentCanReadFrame, "parent retained DOM access to the isolated editor");

    await editor.setCode(
      '<p style="color: rgb(1, 2, 3)">Safe</p><img src=x onerror="parent.isolatedXss=true"><script>parent.isolatedXss=true</script>',
    );
    const html = await editor.getCode();
    const text = await editor.getText();
    assert(text.includes("Safe"), "isolated editor did not preserve safe content");
    assert(!html.includes("onerror") && !html.includes("<script"), "unsafe markup survived isolation");
    assert(globalThis.isolatedXss !== true, "isolated content executed in the parent");
    assert(typeof (await editor.getState()) === "object", "isolated state API failed");
    const documentModel = await editor.getJSON();
    assert((await editor.validateJSON(documentModel)).valid, "isolated JSON export was invalid");
    await editor.setJSON(documentModel);

    await new Promise((resolve) => setTimeout(resolve, 100));
    assert(host.value.includes("Safe"), "isolated changes were not synchronized to the host");
    assert(changes.length > 0, "isolated change callback was not forwarded");
    assert(cspViolations.length === 0, `strict isolation CSP violations: ${JSON.stringify(cspViolations)}`);

    await editor.destroy();
    assert(!document.contains(editor.frame), "isolated frame was not removed on destroy");
    assert(!host.hidden && host.style.display !== "none", "host was not restored on destroy");
    result.textContent = "passed";
    document.body.dataset.testStatus = "passed";
  } catch (error) {
    result.textContent = String(error?.stack || error?.message || error);
    document.body.dataset.testStatus = "failed";
  }
})();
