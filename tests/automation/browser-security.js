"use strict";

const childProcess = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("@playwright/test");

const root = path.resolve(__dirname, "../..");
const port = 8197;
const url = `http://127.0.0.1:${port}/tests/security/browser-security.html`;
const browsers = [
  ["Chrome", "C:/Program Files/Google/Chrome/Application/chrome.exe"],
  ["Edge", "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"],
].filter(([, executable]) => fs.existsSync(executable));

if (!browsers.length) {
  throw new Error("Chrome or Edge is required for the local browser security suite.");
}

const server = childProcess.spawn(process.execPath, ["serve.js"], {
  cwd: root,
  env: { ...process.env, EDITRA_PORT: String(port) },
  stdio: "ignore",
  windowsHide: true,
});

function waitForServer() {
  return new Promise((resolve, reject) => {
    const started = Date.now();
    const poll = async () => {
      try {
        const response = await fetch(url);
        if (response.ok) return resolve();
      } catch {
        // Server startup is asynchronous.
      }
      if (Date.now() - started > 10000) {
        reject(new Error("Timed out starting the Editra test server."));
        return;
      }
      setTimeout(poll, 120);
    };
    poll();
  });
}

(async () => {
  try {
    await waitForServer();
    const indexResponse = await fetch(`http://127.0.0.1:${port}/index.html`);
    const csp = indexResponse.headers.get("content-security-policy") || "";
    if (
      !csp.includes("img-src 'self'") ||
      !csp.includes("font-src 'self'") ||
      !csp.includes("style-src 'self' 'unsafe-inline'")
    ) {
      throw new Error("The local server is missing required asset CSP rules.");
    }
    for (const [name, executable] of browsers) {
      const browser = await chromium.launch({
        executablePath: executable,
        headless: true,
        args: [
          "--no-sandbox",
          "--disable-gpu",
          "--disable-extensions",
          "--disable-background-networking",
        ],
      });
      try {
        const page = await browser.newPage();
        await page.route("https://assets.editra.test/**", (route) =>
          route.fulfill({
            status: 200,
            contentType: "image/gif",
            body: Buffer.from(
              "R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==",
              "base64",
            ),
          }),
        );
        const requestFailures = [];
        const errorResponses = [];
        const pageErrors = [];
        page.on("pageerror", (error) => pageErrors.push(error.message));
        page.on("requestfailed", (request) => {
          requestFailures.push(
            `${request.resourceType()} ${request.url()}: ${request.failure()?.errorText || "failed"}`,
          );
        });
        page.on("response", (response) => {
          if (response.status() >= 400) {
            errorResponses.push(`${response.status()} ${response.url()}`);
          }
        });
        await page.goto(`http://127.0.0.1:${port}/`, {
          waitUntil: "networkidle",
        });
        const metadata = await page.evaluate(() => ({
          title: document.title,
          charset: document.characterSet,
        }));
        if (metadata.title !== "Full Editra" || metadata.charset !== "UTF-8") {
          throw new Error(
            `${name} metadata regression: ${JSON.stringify(metadata)}`,
          );
        }
        await page.goto(
          `http://127.0.0.1:${port}/examples/word-theme.html`,
          { waitUntil: "networkidle" },
        );
        await page.waitForFunction(() => globalThis.demoEditor, null, {
          timeout: 10000,
        }).catch(async () => {
          const note = await page.locator("[data-demo-error]").textContent();
          throw new Error(
            `${name} Word example failed to initialize: ${note || pageErrors.join(" | ") || "no page error reported"}`,
          );
        });
        const wordExample = await page.evaluate(() => ({
          theme: globalThis.demoEditor.options.theme,
          cardClass: globalThis.demoEditor.toolbar.card.className,
          hostTag: globalThis.demoEditor.host.tagName,
        }));
        if (
          wordExample.theme !== "Word" ||
          !wordExample.cardClass.includes("editra-theme-word") ||
          wordExample.hostTag !== "DIV"
        ) {
          throw new Error(
            `${name} Word example regression: ${JSON.stringify(wordExample)}`,
          );
        }
        await page.goto(
          `http://127.0.0.1:${port}/examples/classic-theme.html`,
          { waitUntil: "networkidle" },
        );
        await page.waitForFunction(() => globalThis.demoEditor, null, {
          timeout: 10000,
        }).catch(async () => {
          const note = await page.locator("[data-demo-error]").textContent();
          throw new Error(
            `${name} Classic example failed to initialize: ${note || pageErrors.join(" | ") || "no page error reported"}`,
          );
        });
        const classicExample = await page.evaluate(() => ({
          theme: globalThis.demoEditor.options.theme,
          cardClass: globalThis.demoEditor.toolbar.card.className,
          hostTag: globalThis.demoEditor.host.tagName,
          hostHidden: globalThis.demoEditor.host.hidden,
          pageCount: globalThis.demoEditor.state.pageCount,
        }));
        if (
          classicExample.theme !== "Classic" ||
          !classicExample.cardClass.includes("editra-theme-classic") ||
          classicExample.hostTag !== "TEXTAREA" ||
          !classicExample.hostHidden ||
          classicExample.pageCount !== null
        ) {
          throw new Error(
            `${name} Classic example regression: ${JSON.stringify(classicExample)}`,
          );
        }
        await page.goto(
          `http://127.0.0.1:${port}/examples/word-div-modular.html`,
          { waitUntil: "networkidle" },
        );
        await page.waitForFunction(() => globalThis.wordDivEditor).catch(() => {
          throw new Error(
            `${name} Word modular div failed to initialize: ${pageErrors.join(" | ") || "no page error reported"}`,
          );
        });
        const wordDiv = await page.evaluate(() => {
          const resources = performance.getEntriesByType("resource").map((entry) => entry.name);
          const editor = globalThis.wordDivEditor;
          return {
            theme: editor.options.theme,
            hostTag: editor.host.tagName,
            plugins: [...editor.plugins.keys()],
            modularCore: resources.some((url) => url.endsWith("/dist/editra-core.js")),
            formattingStyle: resources.some((url) => url.endsWith("/dist/plugins/formatting.css")),
            tableStyle: resources.some((url) => url.endsWith("/dist/plugins/table.css")),
            imageStyle: resources.some((url) => url.endsWith("/dist/plugins/image.css")),
          };
        });
        if (
          wordDiv.theme !== "Word" ||
          wordDiv.hostTag !== "DIV" ||
          !["formatting", "table", "image"].every((plugin) => wordDiv.plugins.includes(plugin)) ||
          !wordDiv.modularCore ||
          !wordDiv.formattingStyle ||
          !wordDiv.tableStyle ||
          !wordDiv.imageStyle
        ) {
          throw new Error(
            `${name} Word modular div regression: ${JSON.stringify(wordDiv)}`,
          );
        }
        await page.goto(
          `http://127.0.0.1:${port}/examples/word-textarea-modular.html`,
          { waitUntil: "networkidle" },
        );
        await page.waitForFunction(() => globalThis.wordTextareaEditor).catch(() => {
          throw new Error(
            `${name} Word modular textarea failed to initialize: ${pageErrors.join(" | ") || "no page error reported"}`,
          );
        });
        const wordTextarea = await page.evaluate(() => {
          const resources = performance.getEntriesByType("resource").map((entry) => entry.name);
          const editor = globalThis.wordTextareaEditor;
          return {
            theme: editor.options.theme,
            hostTag: editor.host.tagName,
            hostHidden: editor.host.hidden,
            plugins: [...editor.plugins.keys()],
            modularCore: resources.some((url) => url.endsWith("/dist/editra-core.js")),
            formattingStyle: resources.some((url) => url.endsWith("/dist/plugins/formatting.css")),
            tableStyle: resources.some((url) => url.endsWith("/dist/plugins/table.css")),
            imageStyle: resources.some((url) => url.endsWith("/dist/plugins/image.css")),
          };
        });
        if (
          wordTextarea.theme !== "Word" ||
          wordTextarea.hostTag !== "TEXTAREA" ||
          !wordTextarea.hostHidden ||
          !["formatting", "table", "image"].every((plugin) => wordTextarea.plugins.includes(plugin)) ||
          !wordTextarea.modularCore ||
          !wordTextarea.formattingStyle ||
          !wordTextarea.tableStyle ||
          !wordTextarea.imageStyle
        ) {
          throw new Error(
            `${name} Word modular textarea regression: ${JSON.stringify(wordTextarea)}`,
          );
        }
        await page.goto(
          `http://127.0.0.1:${port}/examples/classic-textarea-single.html`,
          { waitUntil: "networkidle" },
        );
        await page.waitForFunction(() => globalThis.classicTextareaEditor).catch(() => {
          throw new Error(
            `${name} Classic single-bundle textarea failed to initialize: ${pageErrors.join(" | ") || "no page error reported"}`,
          );
        });
        const classicTextarea = await page.evaluate(() => {
          const resources = performance.getEntriesByType("resource").map((entry) => entry.name);
          const editor = globalThis.classicTextareaEditor;
          return {
            theme: editor.options.theme,
            hostTag: editor.host.tagName,
            hostHidden: editor.host.hidden,
            pageCount: editor.state.pageCount,
            plugins: [...editor.plugins.keys()],
            classicClass: editor.toolbar.card.classList.contains("editra-theme-classic"),
            singleEntry: resources.some((url) => url.endsWith("/dist/editra.js")),
          };
        });
        if (
          classicTextarea.theme !== "Classic" ||
          classicTextarea.hostTag !== "TEXTAREA" ||
          !classicTextarea.hostHidden ||
          classicTextarea.pageCount !== null ||
          !["formatting", "table"].every((plugin) => classicTextarea.plugins.includes(plugin)) ||
          !classicTextarea.classicClass ||
          !classicTextarea.singleEntry
        ) {
          throw new Error(
            `${name} Classic single-bundle textarea regression: ${JSON.stringify(classicTextarea)}`,
          );
        }
        await page.goto(
          `http://127.0.0.1:${port}/examples/modular-loading.html`,
          { waitUntil: "networkidle" },
        );
        await page.waitForFunction(() => globalThis.modularEditor);
        const modularExample = await page.evaluate(async () => {
          const before = performance.getEntriesByType("resource").map((entry) => entry.name);
          await globalThis.modularEditor.executeCommand("setForeColor", "#1248a0");
          const after = performance.getEntriesByType("resource").map((entry) => entry.name);
          return {
            theme: globalThis.modularEditor.options.theme,
            plugins: [...globalThis.modularEditor.plugins.keys()],
            formattingStyle: before.some((url) => url.endsWith("/dist/plugins/formatting.css")),
            tableStyle: before.some((url) => url.endsWith("/dist/plugins/table.css")),
            formattingScript: after.some((url) => url.endsWith("/dist/plugins/formatting.js")),
            unusedImage: after.some((url) => /\/dist\/plugins\/image\.(?:js|css)$/.test(url)),
          };
        });
        if (
          modularExample.theme !== "Word" ||
          !modularExample.plugins.includes("formatting") ||
          !modularExample.plugins.includes("table") ||
          !modularExample.formattingStyle ||
          !modularExample.tableStyle ||
          !modularExample.formattingScript ||
          modularExample.unusedImage
        ) {
          throw new Error(
            `${name} modular loading regression: ${JSON.stringify(modularExample)}`,
          );
        }
        await page.goto(
          `http://127.0.0.1:${port}/examples/plugin-marketplace.html`,
          { waitUntil: "networkidle" },
        );
        await page.waitForFunction(() => globalThis.marketplaceEditor);
        const marketplace = await page.evaluate(async () => {
          const registry = await fetch("../plugins/registry.json").then((response) => response.json());
          const manifest = registry.plugins.find((plugin) => plugin.id === "spell-checker");
          await globalThis.marketplaceEditor.installCommunityPlugin(manifest);
          const installed = await globalThis.marketplaceEditor.getInstalledCommunityPlugins();
          const frame = document.querySelector('[data-editra-plugin-id="spell-checker"]');
          return {
            installed: installed.map((plugin) => plugin.id),
            sandbox: frame?.getAttribute("sandbox"),
            hidden: frame?.hidden,
          };
        });
        const sandboxLocator = page.frameLocator(
          'iframe[data-editra-plugin-id="spell-checker"]',
        );
        await sandboxLocator.locator("#check").waitFor({ state: "visible" });
        const sandboxFrame = page.frames().find((frame) =>
          frame.url().endsWith("/community/spell-checker/index.html"),
        );
        if (!sandboxFrame) throw new Error(`${name} sandbox frame did not navigate.`);
        await sandboxLocator.locator("#check").click();
        await sandboxFrame.waitForFunction(
          () => document.querySelector("#result")?.textContent !== "Ready.",
        );
        if (
          !marketplace.installed.includes("spell-checker") ||
          marketplace.sandbox !== "allow-scripts" ||
          marketplace.hidden
        ) {
          throw new Error(
            `${name} plugin marketplace regression: ${JSON.stringify(marketplace)}`,
          );
        }
        await page.goto(url, { waitUntil: "networkidle" });
        await page.waitForFunction(
          () => ["passed", "failed"].includes(document.body.dataset.testStatus),
          null,
          { timeout: 60000 },
        );
        const report = await page.evaluate(() => ({
          status: document.body.dataset.testStatus,
          detail: document.querySelector("#test-result")?.textContent ?? "",
          benchmark: document.body.dataset.benchmark ?? "recorded",
        }));
        if (report.status !== "passed") {
          throw new Error(
            `${name} security suite failed: ${report.detail.slice(0, 1200)}`,
          );
        }
        if (requestFailures.length || errorResponses.length) {
          throw new Error(
            `${name} asset/network regression: ${[
              ...requestFailures,
              ...errorResponses,
            ].join(" | ")}`,
          );
        }
        console.log(
          `${name} security, accessibility, RTL, and cleanup tests passed (${report.benchmark}).`,
        );
      } finally {
        await browser.close();
      }
    }
  } finally {
    server.kill();
  }
})().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
