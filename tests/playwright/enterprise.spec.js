/**
 * Product: Editra
 * Author: Editra Team
 * Version: 1.17.0
 * Purpose: Verifies enterprise security and compatibility in Chromium, Firefox, and WebKit.
 * Licensing: MIT License (open source)
 */

"use strict";

const { test, expect } = require("@playwright/test");

test("security, accessibility, RTL, lifecycle, and performance contracts pass", async ({
  page,
}) => {
  await page.goto("/tests/security/browser-security.html");
  await expect(page.locator("body")).toHaveAttribute(
    "data-test-status",
    "passed",
    { timeout: 20000 },
  );
  await expect(page.locator("#test-result")).toHaveText("passed");
  await expect(page.locator("body")).toHaveAttribute(
    "data-benchmark",
    /"paragraphs":1000/,
  );
});

test("toolbar SVG assets load without 404 or CSP regressions", async ({
  page,
}) => {
  const failedRequests = [];
  page.on("requestfailed", (request) => {
    failedRequests.push(`${request.url()}: ${request.failure()?.errorText}`);
  });
  const errorResponses = [];
  page.on("response", (response) => {
    if (response.status() >= 400) {
      errorResponses.push(`${response.status()} ${response.url()}`);
    }
  });

  await page.goto("/tests/security/browser-security.html");
  await expect(page.locator("body")).toHaveAttribute(
    "data-test-status",
    "passed",
    { timeout: 30000 },
  );
  await expect(page.locator(".editra-tool-icon").first()).toHaveJSProperty(
    "complete",
    true,
  );
  expect(failedRequests).toEqual([]);
  expect(errorResponses).toEqual([]);
});

test("demo server supplies enterprise response headers", async ({ request }) => {
  const response = await request.get("/index.html");
  expect(response.headers()["x-frame-options"]).toBe("DENY");
  expect(response.headers()["x-content-type-options"]).toBe("nosniff");
  expect(response.headers()["content-security-policy"]).toContain(
    "require-trusted-types-for 'script'",
  );
  expect(response.headers()["content-security-policy"]).toContain(
    "font-src 'self'",
  );
});
