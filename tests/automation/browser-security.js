// Version: 2.0.0
/**
 * Product: Editra
 * Author: Editra Team
 * Version: 2.0.0
 * Purpose: Runs the enterprise browser security suite in installed Chromium-family browsers.
 * Licensing: MIT License (open source)
 */

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
        page.on("requestfailed", (request) => {
          requestFailures.push(
            `${request.url()}: ${request.failure()?.errorText || "failed"}`,
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
