/**
 * Product: Editra
 * Author: Editra Team
 * Version: 1.17.0
 * Purpose: Configures Chromium, Firefox, and WebKit enterprise browser verification.
 * Licensing: MIT License (open source)
 */

"use strict";

const { defineConfig } = require("@playwright/test");
const path = require("node:path");

const chromiumExecutable = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || "";

module.exports = defineConfig({
  testDir: "./tests/playwright",
  timeout: 30000,
  fullyParallel: false,
  reporter: "line",
  use: {
    baseURL: "http://127.0.0.1:8200",
    headless: true,
  },
  webServer: {
    command: "node serve.js",
    env: { EDITRA_PORT: "8200" },
    url: "http://127.0.0.1:8200/index.html",
    reuseExistingServer: false,
    timeout: 15000,
  },
  projects: [
    {
      name: "chromium",
      use: {
        browserName: "chromium",
        launchOptions: chromiumExecutable
          ? { executablePath: chromiumExecutable }
          : undefined,
      },
    },
    { name: "firefox", use: { browserName: "firefox" } },
    { name: "webkit", use: { browserName: "webkit" } },
  ],
});
