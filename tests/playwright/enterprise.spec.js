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

test("examples consistently apply standard Word pages and flexible Classic sizing", async ({
  page,
}) => {
  test.setTimeout(60000);
  const wordExamples = [
    ["/examples/full.html", "demoEditor", "Letter", "8.5in", "11in"],
    ["/examples/page-sizes.html", "demoEditor", "A4", "210mm", "297mm"],
    ["/examples/native-page-flow.html", "demoEditor", "A4", "210mm", "297mm"],
    ["/examples/word-div-modular.html", "wordDivEditor", "Letter", "8.5in", "11in"],
    ["/examples/word-textarea-modular.html", "wordTextareaEditor", "Letter", "8.5in", "11in"],
    ["/examples/modular-loading.html", "modularEditor", "Letter", "8.5in", "11in"],
    ["/examples/plugin-marketplace.html", "marketplaceEditor", "Letter", "8.5in", "11in"],
  ];
  for (const [url, globalName, size, width, height] of wordExamples) {
    await page.goto(url, { waitUntil: "networkidle" });
    await page.waitForFunction((name) => globalThis[name], globalName);
    const state = await page.evaluate((name) => {
      const editor = globalThis[name];
      return {
        theme: editor.options.theme,
        size: editor.options.pageSize,
        width: editor.options.editorWidth,
        height: editor.options.editorHeight,
        contentOnlyMenu: Boolean(
          editor.toolbar.card.querySelector('[data-command="printContentOnly"]'),
        ),
      };
    }, globalName);
    expect(state).toEqual({
      theme: "Word",
      size,
      width,
      height,
      contentOnlyMenu: false,
    });
  }

  for (const [url, expectedWidth, expectedHeight] of [
    ["/examples/sized-editor.html", "720px", "900px"],
    ["/examples/custom-print.html", "8.5in", "11in"],
  ]) {
    await page.goto(url, { waitUntil: "networkidle" });
    await page.waitForFunction(() => globalThis.demoEditor);
    const state = await page.evaluate(() => ({
      theme: globalThis.demoEditor.options.theme,
      width: globalThis.demoEditor.options.editorWidth,
      height: globalThis.demoEditor.options.editorHeight,
    }));
    expect(state).toEqual({
      theme: "Classic",
      width: expectedWidth,
      height: expectedHeight,
    });
  }
});
