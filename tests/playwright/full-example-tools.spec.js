"use strict";

const { test, expect } = require("@playwright/test");

test("full.html applies font family, font size, and headings from its live toolbar", async ({ page }) => {
  const pageErrors = [];
  const nativeDialogs = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("dialog", async (dialog) => {
    nativeDialogs.push(dialog.type());
    await dialog.dismiss();
  });
  await page.goto("/examples/full.html");
  await page.waitForFunction(() => globalThis.demoEditor);
  expect(await page.evaluate(() => [
    "setFontFamily",
    "setFontSize",
    "setHeading",
    "insertHeader",
  ].every((command) => globalThis.demoEditor.commands.has(command)))).toBe(true);

  const editor = page.locator("#editra-editor.editra-editor");
  const paragraph = editor.locator("p").first();
  const toolbar = page.locator(".editra-toolbar");
  const fontSize = toolbar.locator('[data-command="setFontSize"]');

  await paragraph.selectText();
  await expect(fontSize).toHaveValue("15px");

  await paragraph.click();
  expect(await page.evaluate(() => getSelection()?.isCollapsed)).toBe(true);
  await toolbar.locator('[data-command="setFontFamily"]').selectOption("Arial");
  await expect(paragraph).toHaveCSS("font-family", /Arial/i);
  await fontSize.selectOption("18px");
  await expect.poll(() => paragraph.evaluate((element) =>
    [element, ...element.querySelectorAll("span")].map(
      (candidate) => getComputedStyle(candidate).fontSize,
    ),
  )).toContain("18px");
  await expect(fontSize).toHaveValue("18px");

  await paragraph.selectText();
  await toolbar.locator('[data-command="setFontFamily"]').selectOption("Georgia");
  await expect.poll(() => paragraph.evaluate((element) =>
    [element, ...element.querySelectorAll("span")].map(
      (candidate) => getComputedStyle(candidate).fontFamily,
    ).join(" | "),
  )).toMatch(/Georgia/i);

  await paragraph.selectText();
  await fontSize.selectOption("20px");
  await expect.poll(() => paragraph.evaluate((element) =>
    [element, ...element.querySelectorAll("span")].map(
      (candidate) => getComputedStyle(candidate).fontSize,
    ),
  )).toContain("20px");

  await paragraph.selectText();
  await toolbar.locator('[data-command="setHeading"]').selectOption("h2");
  await expect(editor.locator("h2").filter({ hasText: "Select text" })).toHaveCount(1);

  await page.getByRole("button", { name: "Insert", exact: true }).click();
  await page.locator('.editra-menu-list:not([hidden]) [data-command="insertHeader"]').click();
  const headerDialog = page.getByRole("dialog", { name: "Insert header" });
  await expect(headerDialog).toBeVisible();
  await headerDialog.getByLabel("Header content").fill("Full page header");
  await headerDialog.getByRole("button", { name: "Insert" }).click();
  await expect(editor.locator('[data-editra-document-part="header"]')).toContainText(
    "Full page header",
  );

  await page.getByRole("button", { name: "Insert", exact: true }).click();
  await page.locator('.editra-menu-list:not([hidden]) [data-command="insertFooter"]').click();
  const footerDialog = page.getByRole("dialog", { name: "Insert footer" });
  await expect(footerDialog).toBeVisible();
  await footerDialog.getByLabel("Footer content").fill("Page {{page}} of {{pages}}");
  await footerDialog.getByRole("button", { name: "Insert" }).click();
  await expect(editor.locator('[data-editra-document-part="footer"]')).toContainText(
    "Page {{page}} of {{pages}}",
  );

  const headerPreview = page.locator('[data-editra-part-preview="header"]').first();
  await expect(headerPreview).toContainText("Full page header");
  await headerPreview.click();
  await expect(headerPreview).toHaveAttribute("contenteditable", "true");
  await headerPreview.fill("Edited header");
  await headerPreview.blur();
  await expect(editor.locator('[data-editra-document-part="header"]')).toContainText(
    "Edited header",
  );
  await expect(page.locator('[data-editra-part-preview="header"]').first()).toContainText(
    "Edited header",
  );
  const keyboardHeaderPreview = page.locator('[data-editra-part-preview="header"]').first();
  await keyboardHeaderPreview.click();
  await expect(keyboardHeaderPreview).toHaveAttribute("contenteditable", "true");
  await keyboardHeaderPreview.fill("Discard this edit");
  await keyboardHeaderPreview.press("Escape");
  await expect(page.locator('[data-editra-part-preview="header"]').first()).toContainText(
    "Edited header",
  );

  const footerPreview = page.locator('[data-editra-part-preview="footer"]').first();
  await footerPreview.click();
  await footerPreview.fill("Section footer — page {{page}}");
  await footerPreview.blur();
  await expect(editor.locator('[data-editra-document-part="footer"]')).toContainText(
    "Section footer — page {{page}}",
  );
  await expect(page.locator('[data-editra-part-preview="footer"]').first()).toContainText(
    "Section footer — page 1",
  );
  expect(nativeDialogs).toEqual([]);
  expect(pageErrors).toEqual([]);
  await expect(page.locator("[data-demo-error]")).toBeHidden();
});

test("full.html keeps every heading editable and converts it back to Normal", async ({ page }) => {
  await page.goto("/examples/full.html");
  await page.waitForFunction(() => globalThis.demoEditor);

  const editor = page.locator("#editra-editor.editra-editor");
  const toolbar = page.locator(".editra-toolbar");
  const heading = toolbar.locator('[data-command="setHeading"]');
  const fontFamily = toolbar.locator('[data-command="setFontFamily"]');
  const fontSize = toolbar.locator('[data-command="setFontSize"]');
  const choose = async (control, value) => {
    await control.dispatchEvent("pointerdown");
    await control.selectOption(value);
  };

  await page.evaluate(() => {
    globalThis.demoEditor.setCode(
      ["h1", "h2", "h3", "h4", "h5", "h6"].map((level) =>
        `<p data-test="heading-${level}"><span style="font-family:Arial;font-size:15px;line-height:2">Editable ${level.toUpperCase()}</span></p>`,
      ).join(""),
    );
  });
  await expect(editor.locator('[data-test^="heading-"]')).toHaveCount(6);

  for (const tag of ["h1", "h2", "h3", "h4", "h5", "h6"]) {
    const paragraph = editor.locator(`[data-test="heading-${tag}"]`);
    await paragraph.selectText();
    await choose(heading, tag);

    const activeHeading = editor.locator(`${tag}[data-test="heading-${tag}"]`);
    await expect(activeHeading).toHaveCount(1);
    await expect(heading).toHaveValue(tag);
    await expect.poll(() => activeHeading.evaluate((element) => ({
      family: getComputedStyle(element.querySelector("span") || element).fontFamily,
      weight: Number.parseInt(getComputedStyle(element).fontWeight, 10),
      staleTypography: [...element.querySelectorAll("[style]")].some((child) =>
        child.style.fontFamily || child.style.fontSize || child.style.lineHeight,
      ),
    }))).toEqual(expect.objectContaining({
      family: expect.stringMatching(/Calibri/i),
      weight: expect.any(Number),
      staleTypography: false,
    }));
    await expect.poll(() => activeHeading.evaluate((element) =>
      Number.parseInt(getComputedStyle(element).fontWeight, 10),
    )).toBeGreaterThanOrEqual(600);

    await choose(fontFamily, "Georgia");
    await choose(fontSize, "24px");
    await expect.poll(() => activeHeading.evaluate((element) => {
      const text = [...element.querySelectorAll("*")].at(-1) || element;
      const style = getComputedStyle(text);
      return { family: style.fontFamily, size: style.fontSize };
    })).toEqual({ family: expect.stringMatching(/Georgia/i), size: "24px" });

    await choose(heading, "p");
    const normal = editor.locator(`p[data-test="heading-${tag}"]`);
    await expect(normal).toHaveCount(1);
    await expect(normal).toHaveText(`Editable ${tag.toUpperCase()}`);
    await expect(heading).toHaveValue("p");
    await expect.poll(() => normal.evaluate((element) => {
      const text = [...element.querySelectorAll("*")].at(-1) || element;
      const style = getComputedStyle(text);
      return { family: style.fontFamily, size: Number.parseFloat(style.fontSize) };
    })).toEqual({
      family: expect.stringMatching(/Calibri/i),
      size: expect.closeTo(14.6667, 3),
    });
  }
});

test("full.html source view renders readable synchronized HTML without selection", async ({ page }) => {
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.goto("/examples/full.html");
  await page.waitForFunction(() => globalThis.demoEditor);
  await page.evaluate(() => globalThis.demoEditor.setCode(
    '<p class="source-test"><strong>Visible source</strong></p>',
  ));

  await page.locator('.editra-toolbar [data-command="toggleCodeView"]').click();
  const wrapper = page.locator(".editra-code-editor");
  const textarea = wrapper.locator(".editra-code-view");
  const highlight = wrapper.locator(".editra-code-highlight");
  await expect(textarea).toBeVisible();
  await expect(textarea).toHaveValue(/Visible source/);
  await expect(wrapper).toHaveClass(/is-decorated/);
  await expect(highlight).toContainText("<strong>Visible source</strong>");

  await textarea.fill('<h2 data-source="updated">Updated source</h2>');
  await expect(highlight).toContainText('<h2 data-source="updated">Updated source</h2>');

  // If highlighting is unavailable, normal textarea glyphs must remain visible
  // instead of requiring the user to select text to read the HTML.
  await page.evaluate(() => {
    const codeEditor = document.querySelector(".editra-code-editor");
    codeEditor.classList.remove("is-decorated");
    codeEditor.querySelector(".editra-code-highlight").replaceChildren();
  });
  await expect(textarea).toHaveCSS("color", "rgb(37, 43, 54)");
  expect(await textarea.evaluate((element) =>
    getComputedStyle(element).webkitTextFillColor,
  )).not.toBe("rgba(0, 0, 0, 0)");
  expect(pageErrors).toEqual([]);
});
