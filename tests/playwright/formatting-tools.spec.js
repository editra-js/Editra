"use strict";

const { test, expect } = require("@playwright/test");

const CONFIGURATIONS = [
  ["Word", "div"],
  ["Word", "textarea"],
  ["Classic", "div"],
  ["Classic", "textarea"],
];
const TOOLBAR = [
  "bold italic underline strikethrough superscript subscript",
  "fontFamily fontSize foreColor backgroundColor highlighter",
  "heading blockQuote alignment lineHeight",
  "bulletList numberList decreaseIndent increaseIndent",
  "keepTogether keepWithNext",
  "undo redo",
].join(" | ");
const BASIC_COMMANDS = [
  "bold",
  "italic",
  "underline",
  "setFontFamily",
  "setFontSize",
  "setForeColor",
  "setBackgroundColor",
  "highlightText",
  "setAlignment",
  "bulletList",
  "numberList",
  "toggleKeepTogether",
  "keepWithNext",
];

async function createEditor(page, theme, hostType) {
  await page.goto("/index.html");
  await page.waitForFunction(() => document.querySelector("#editra-editor")?.editraInstance);
  await page.evaluate(async ({ theme, hostType, toolbar }) => {
    const original = document.querySelector("#editra-editor");
    original.editraInstance.destroy();
    original.remove();
    const host = document.createElement(hostType);
    host.id = "formatting-tools-editor";
    if (hostType === "textarea") host.value = "initial textarea content";
    document.body.append(host);
    globalThis.formattingToolsEditor = await Editra.init({
      selector: host,
      theme,
      toolbar,
      showMenuBar: true,
    });
  }, { theme, hostType, toolbar: TOOLBAR });
}

async function selectText(page, selector, start = 0, end = null) {
  await page.evaluate(({ selector, start, end }) => {
    const editor = globalThis.formattingToolsEditor;
    const element = editor.editor.querySelector(selector);
    const text = element.firstChild;
    const range = document.createRange();
    range.setStart(text, start);
    range.setEnd(text, end ?? text.length);
    const selection = getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
    editor.captureSelection();
  }, { selector, start, end });
}

async function setContent(page, html) {
  await page.evaluate(async (html) => {
    globalThis.formattingToolsEditor.setCode(html);
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  }, html);
}

for (const [theme, hostType] of CONFIGURATIONS) {
  test(`${theme} ${hostType} applies every text-formatting toolbar command`, async ({ page }) => {
    test.setTimeout(60000);
    await createEditor(page, theme, hostType);
    const editor = page.locator(".editra-editor");
    const toolbar = page.locator(".editra-toolbar");
    const chooseSelect = async (command, value) => {
      const control = toolbar.locator(`[data-command="${command}"]`);
      await control.dispatchEvent("pointerdown");
      await control.selectOption(value);
    };
    expect(await page.evaluate((commands) => commands.every(
      (command) => globalThis.formattingToolsEditor.commands.has(command),
    ), BASIC_COMMANDS)).toBe(true);
    for (const command of BASIC_COMMANDS) {
      await expect(toolbar.locator(`:scope > [data-command="${command}"]`)).toHaveCount(1);
    }

    await setContent(page, '<p data-test="caret-font">caret formatting</p>');
    await editor.locator("[data-test='caret-font']").click();
    await toolbar.locator('[data-command="setFontFamily"]').selectOption("Georgia");
    await expect(editor.locator("[data-test='caret-font']")).toHaveCSS(
      "font-family",
      /Georgia/i,
    );
    await toolbar.locator('[data-command="setFontSize"]').selectOption("20px");
    await expect(editor.locator("[data-test='caret-font']")).toHaveCSS(
      "font-size",
      "20px",
    );

    const cases = [
      ["bold", "b,strong", "fontWeight", /^(?:bold|[6-9]00)$/],
      ["italic", "i,em", "fontStyle", /^italic$/],
      ["underline", "u", "textDecorationLine", /underline/],
      ["strikethrough", "s,strike", "textDecorationLine", /line-through/],
      ["superscript", "sup", "verticalAlign", /^super$/],
      ["subscript", "sub", "verticalAlign", /^sub$/],
    ];
    for (const [command, tag, property, expected] of cases) {
      await setContent(page, '<p data-test="inline">format me</p>');
      await selectText(page, "[data-test='inline']");
      await toolbar.locator(`[data-command="${command}"]`).click();
      await expect.poll(() => editor.evaluate((root, { tag, property }) => {
        const element = root.querySelector(tag);
        return element ? getComputedStyle(element)[property] : "";
      }, { tag, property })).toMatch(expected);
    }

    const selects = [
      ["setFontFamily", "Georgia", "fontFamily", /Georgia/i],
      ["setFontSize", "20px", "fontSize", /^20px$/],
    ];
    for (const [command, value, property, expected] of selects) {
      await setContent(page, '<p data-test="select">format me</p>');
      await selectText(page, "[data-test='select']");
      await toolbar.locator(`[data-command="${command}"]`).selectOption(value);
      await expect.poll(() => editor.evaluate((root, property) => {
        const element = root.querySelector("span");
        return element ? getComputedStyle(element)[property] : "";
      }, property)).toMatch(expected);
    }

    const colors = [
      ["setForeColor", "#2468ac", "color", "rgb(36, 104, 172)"],
      ["setBackgroundColor", "#f0c040", "backgroundColor", "rgb(240, 192, 64)"],
      ["highlightText", "#80d080", "backgroundColor", "rgb(128, 208, 128)"],
    ];
    for (const [command, value, property, expected] of colors) {
      await setContent(page, '<p data-test="color">color me</p>');
      await selectText(page, "[data-test='color']");
      await toolbar.locator(`[data-command="${command}"] input`).evaluate((input, value) => {
        input.value = value;
        input.dispatchEvent(new Event("change", { bubbles: true }));
      }, value);
      const actual = await editor.locator("span").evaluate(
        (element, property) => getComputedStyle(element)[property],
        property,
      );
      expect(actual).toBe(expected);
    }

    const blockCases = [
      ["setHeading", "h2", "h2"],
      ["setAlignment", "center", "p"],
      ["setLineHeight", "2", "p"],
    ];
    for (const [command, value, selector] of blockCases) {
      await setContent(page, '<p data-test="block">format me</p>');
      await selectText(page, "[data-test='block']");
      await toolbar.locator(`[data-command="${command}"]`).selectOption(value);
      const result = await editor.locator(selector).evaluate((element) => ({
        align: getComputedStyle(element).textAlign,
        lineHeight: getComputedStyle(element).lineHeight,
      }));
      if (command === "setAlignment") expect(result.align).toBe("center");
      if (command === "setLineHeight") {
        const fontSize = await editor.locator(selector).evaluate((element) => parseFloat(getComputedStyle(element).fontSize));
        expect(parseFloat(result.lineHeight) / fontSize).toBeCloseTo(2, 1);
      }
    }

    // Heading styles must replace stale direct typography, accept new font
    // formatting, and return to the visible Normal style in every host/theme.
    await setContent(page,
      '<p data-test="heading-fonts"><span style="font-family:Arial;font-size:15px;line-height:2">heading fonts</span></p>',
    );
    const headingSource = editor.locator("[data-test='heading-fonts']");
    const normalTypography = await headingSource.evaluate((element) => {
      const style = getComputedStyle(element);
      return { family: style.fontFamily, size: Number.parseFloat(style.fontSize) };
    });
    await headingSource.selectText();
    await chooseSelect("setHeading", "h6");
    const styledHeading = editor.locator("h6[data-test='heading-fonts']");
    await expect(styledHeading).toHaveCount(1);
    await expect.poll(() => styledHeading.evaluate((element) =>
      getComputedStyle(element.querySelector("span") || element).fontFamily,
    )).toMatch(/Calibri/i);

    await chooseSelect("setFontFamily", "Georgia");
    await chooseSelect("setFontSize", "24px");
    await expect.poll(() => styledHeading.evaluate((element) => {
      const text = [...element.querySelectorAll("*")].at(-1) || element;
      const style = getComputedStyle(text);
      return { family: style.fontFamily, size: style.fontSize };
    })).toEqual({ family: expect.stringMatching(/Georgia/i), size: "24px" });

    await chooseSelect("setHeading", "p");
    const normalBlock = editor.locator("p[data-test='heading-fonts']");
    await expect(normalBlock).toHaveCount(1);
    await expect.poll(() => normalBlock.evaluate((element) => {
      const text = [...element.querySelectorAll("*")].at(-1) || element;
      const style = getComputedStyle(text);
      return { family: style.fontFamily, size: Number.parseFloat(style.fontSize) };
    })).toEqual({
      family: normalTypography.family,
      size: expect.closeTo(normalTypography.size, 3),
    });

    await setContent(page, '<p data-test="quote">quote me</p>');
    await selectText(page, "[data-test='quote']");
    await toolbar.locator('[data-command="blockQuote"]').click();
    await expect(editor.locator("blockquote")).toHaveCount(1);

    for (const [command, selector] of [["bulletList", "ul > li"], ["numberList", "ol > li"]]) {
      await setContent(page, '<p data-test="list">list me</p>');
      await selectText(page, "[data-test='list']");
      await toolbar.locator(`[data-command="${command}"]`).click();
      await expect(editor.locator(selector)).toHaveText("list me");
    }

    await setContent(page, '<ul><li>first</li><li data-test="indent">second</li></ul>');
    await selectText(page, "[data-test='indent']");
    await toolbar.locator('[data-command="increaseIndent"]').click();
    await expect(editor.locator("ul ul > li")).toHaveText("second");
    await toolbar.locator('[data-command="decreaseIndent"]').click();
    await expect(editor.locator(":scope > ul > li")).toHaveCount(2);

    // A first list item cannot be nested below a previous sibling. In that
    // case Increase/Decrease Indent moves the list itself and remains reversible.
    await setContent(page, '<ul data-test="first-list"><li data-test="first-indent">first</li><li>second</li></ul>');
    await selectText(page, "[data-test='first-indent']");
    await toolbar.locator('[data-command="increaseIndent"]').click();
    await expect(editor.locator("[data-test='first-list']")).toHaveCSS(
      "margin-inline-start",
      "36px",
    );
    await toolbar.locator('[data-command="decreaseIndent"]').click();
    await expect(editor.locator("[data-test='first-list']")).toHaveCSS(
      "margin-inline-start",
      "0px",
    );

    await setContent(page, '<p data-test="indent-block">indent this paragraph</p>');
    await selectText(page, "[data-test='indent-block']");
    await toolbar.locator('[data-command="increaseIndent"]').click();
    await expect(editor.locator("[data-test='indent-block']")).toHaveCSS(
      "margin-inline-start",
      "36px",
    );
    await toolbar.locator('[data-command="decreaseIndent"]').click();
    await expect(editor.locator("[data-test='indent-block']")).toHaveCSS(
      "margin-inline-start",
      "0px",
    );

    // Raw text in a table cell must be promoted locally and indented without
    // moving the table or its editor-owned wrapper.
    await setContent(page,
      '<table><tbody><tr><td data-test="indent-cell">cell text</td><td>untouched</td></tr></tbody></table>',
    );
    await selectText(page, "[data-test='indent-cell']");
    await toolbar.locator('[data-command="increaseIndent"]').click();
    await expect(editor.locator("[data-test='indent-cell'] > p")).toHaveCSS(
      "margin-inline-start",
      "36px",
    );
    await expect(editor.locator("table")).toHaveCount(1);
    await expect(editor.locator("td:nth-child(2)")).toHaveText("untouched");
    await toolbar.locator('[data-command="decreaseIndent"]').click();
    await expect(editor.locator("[data-test='indent-cell'] > p")).toHaveCSS(
      "margin-inline-start",
      "0px",
    );

    await setContent(page,
      '<p data-test="keep-together">Keep every line together</p><p>Next paragraph</p>',
    );
    await selectText(page, "[data-test='keep-together']");
    const keepTogether = toolbar.locator('[data-command="toggleKeepTogether"]');
    await keepTogether.click();
    await expect(editor.locator("[data-test='keep-together']")).toHaveAttribute(
      "data-editra-keep-together",
      "true",
    );
    await expect(editor.locator("[data-test='keep-together']")).toHaveCSS(
      "break-inside",
      "avoid",
    );
    await expect(keepTogether).toHaveAttribute("aria-pressed", "true");
    await keepTogether.click();
    await expect(editor.locator("[data-test='keep-together']")).not.toHaveAttribute(
      "data-editra-keep-together",
    );
    await expect(keepTogether).toHaveAttribute("aria-pressed", "false");

    await setContent(page,
      '<h2 data-test="keep-next">Keep heading with next</h2><p data-test="kept-next">Following paragraph</p>',
    );
    await selectText(page, "[data-test='keep-next']");
    const keepWithNext = toolbar.locator('[data-command="keepWithNext"]');
    await keepWithNext.click();
    await expect(editor.locator("[data-test='keep-next']")).toHaveAttribute(
      "data-editra-keep-with-next",
      "true",
    );
    await expect(editor.locator("[data-test='keep-next']")).toHaveCSS(
      "break-after",
      "avoid",
    );
    await expect(keepWithNext).toHaveAttribute("aria-pressed", "true");
    await expect(editor.locator("[data-test='kept-next']")).toHaveText(
      "Following paragraph",
    );
    await keepWithNext.click();
    await expect(editor.locator("[data-test='keep-next']")).not.toHaveAttribute(
      "data-editra-keep-with-next",
    );

    // Pagination flags inside a cell belong to the selected paragraph, never
    // to the table frame. Raw cell text is promoted just like normal editor text.
    await setContent(page,
      '<table><tbody><tr><td data-test="keep-cell">Cell paragraph</td><td>Other cell</td></tr></tbody></table>',
    );
    await selectText(page, "[data-test='keep-cell']");
    await keepTogether.click();
    await expect(editor.locator("[data-test='keep-cell'] > p")).toHaveAttribute(
      "data-editra-keep-together",
      "true",
    );
    await expect(editor.locator("table")).not.toHaveAttribute(
      "data-editra-keep-together",
    );
    await keepWithNext.click();
    await expect(editor.locator("[data-test='keep-cell'] > p")).toHaveAttribute(
      "data-editra-keep-with-next",
      "true",
    );
    await expect(editor.locator("td:nth-child(2)")).toHaveText("Other cell");

    // Exercise the menu path separately: its chooser is moved to document.body
    // and must retain the editor selection while its option buttons take focus.
    const formatMenu = page.getByRole("button", { name: "Format", exact: true });
    const chooseFormat = async (command, value) => {
      const item = page.locator(
        `.editra-menu-list:not([hidden]) [data-command="${command}"]`,
      );
      if (!(await item.count())) await formatMenu.click();
      await item.click();
      await page.locator(`.editra-menu-chooser [data-menu-value="${value}"]`).click();
    };

    await setContent(page, '<p data-test="menu-font">menu font</p>');
    await selectText(page, "[data-test='menu-font']");
    await chooseFormat("setFontFamily", "Georgia");
    await expect.poll(() => editor.locator("span").evaluate(
      (element) => getComputedStyle(element).fontFamily,
    )).toMatch(/Georgia/i);

    await setContent(page, '<p data-test="menu-size">menu size</p>');
    await selectText(page, "[data-test='menu-size']");
    await chooseFormat("setFontSize", "20px");
    await expect.poll(() => editor.locator("span").evaluate(
      (element) => getComputedStyle(element).fontSize,
    )).toBe("20px");

    await setContent(page, '<p data-test="menu-heading">menu heading</p>');
    await selectText(page, "[data-test='menu-heading']");
    await chooseFormat("setHeading", "h2");
    await expect(editor.locator("h2")).toHaveText("menu heading");

    await setContent(page, "<p>document with header</p>");
    await page.getByRole("button", { name: "Insert", exact: true }).click();
    await page.locator('.editra-menu-list:not([hidden]) [data-command="insertHeader"]').click();
    const headerDialog = page.getByRole("dialog", { name: "Insert header" });
    await expect(headerDialog).toBeVisible();
    await headerDialog.getByLabel("Header content").fill("Working header");
    await headerDialog.getByRole("button", { name: "Insert" }).click();
    await expect(editor.locator('[data-editra-document-part="header"]')).toContainText(
      "Working header",
    );
  });
}
