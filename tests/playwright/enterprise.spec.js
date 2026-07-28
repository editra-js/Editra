"use strict";

const { test, expect } = require("@playwright/test");

function isToolbarIconUrl(value) {
  try {
    return new URL(value).pathname.startsWith("/assets/icons/");
  } catch {
    return false;
  }
}

async function expectSecurityContractsToPass(page) {
  await page.waitForFunction(
    () => ["passed", "failed"].includes(document.body.dataset.testStatus),
    null,
    { timeout: 45000 },
  );
  const outcome = await page.locator("body").getAttribute("data-test-status");
  const report = (await page.locator("#test-result").textContent())?.trim();
  expect(outcome, report || "Enterprise browser contract failed").toBe(
    "passed",
  );
}

test.beforeEach(async ({ page }) => {
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
});

test("security, accessibility, RTL, lifecycle, and performance contracts pass", async ({
  page,
}) => {
  test.setTimeout(60000);
  await page.goto("/tests/security/browser-security.html");
  await expectSecurityContractsToPass(page);
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
    if (isToolbarIconUrl(request.url())) {
      failedRequests.push(`${request.url()}: ${request.failure()?.errorText}`);
    }
  });
  const errorResponses = [];
  page.on("response", (response) => {
    if (isToolbarIconUrl(response.url()) && response.status() >= 400) {
      errorResponses.push(`${response.status()} ${response.url()}`);
    }
  });

  await page.goto("/tests/security/browser-security.html");
  const icons = page.locator(".editra-tool-icon");
  await expect(icons.first()).toBeAttached({ timeout: 15000 });
  await expect
    .poll(
      () =>
        icons.evaluateAll(
          (elements) =>
            elements.length >= 8 &&
            elements.every(
              (icon) => icon.complete && icon.naturalWidth > 0,
            ),
        ),
      { timeout: 15000 },
    )
    .toBe(true);
  const iconResults = await icons.evaluateAll((elements) =>
    elements.map((icon) => ({
      complete: icon.complete,
      naturalWidth: icon.naturalWidth,
      path: new URL(icon.src).pathname,
    })),
  );
  expect(iconResults.length).toBeGreaterThanOrEqual(8);
  expect(
    iconResults.every(
      (icon) =>
        icon.complete &&
        icon.naturalWidth > 0 &&
        icon.path.startsWith("/assets/icons/"),
    ),
    JSON.stringify(iconResults),
  ).toBe(true);
  expect(failedRequests).toEqual([]);
  expect(errorResponses).toEqual([]);
});

test("demo server supplies enterprise response headers", async ({ request }) => {
  const response = await request.get("/index.html");
  expect(response.headers()["x-frame-options"]).toBe("SAMEORIGIN");
  expect(response.headers()["x-content-type-options"]).toBe("nosniff");
  expect(response.headers()["referrer-policy"]).toBe("no-referrer");
  expect(response.headers()["content-security-policy"]).toContain(
    "require-trusted-types-for 'script'",
  );
  expect(response.headers()["content-security-policy"]).toContain(
    "font-src 'self'",
  );
});
