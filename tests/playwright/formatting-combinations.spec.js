"use strict";

const { test, expect } = require("@playwright/test");

const CONFIGURATIONS = [
  ["Word", "div"],
  ["Word", "textarea"],
  ["Classic", "div"],
  ["Classic", "textarea"],
];

const TOOLBAR = [
  "bold italic underline",
  "fontFamily fontSize foreColor backgroundColor",
  "heading alignment lineHeight",
  "bulletList bulletListStyle numberList numberListStyle multilevelList todoList decreaseIndent increaseIndent",
].join(" | ");

async function createEditor(page, theme, hostType) {
  await page.goto("/index.html");
  await page.waitForFunction(() => document.querySelector("#editra-editor")?.editraInstance);
  await page.evaluate(async ({ theme, hostType, toolbar }) => {
    const original = document.querySelector("#editra-editor");
    original.editraInstance.destroy();
    original.remove();
    const host = document.createElement(hostType);
    host.id = "formatting-combinations-editor";
    document.body.append(host);
    globalThis.formattingCombinationsEditor = await Editra.init({
      selector: host,
      theme,
      toolbar,
      showMenuBar: true,
    });
  }, { theme, hostType, toolbar: TOOLBAR });
}

async function setContent(page, html) {
  await page.evaluate(async (content) => {
    globalThis.formattingCombinationsEditor.setCode(content);
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  }, html);
}

async function selectContents(page, selector) {
  await page.evaluate((targetSelector) => {
    const editor = globalThis.formattingCombinationsEditor;
    const element = editor.editor.querySelector(targetSelector);
    const range = document.createRange();
    range.selectNodeContents(element);
    const selection = getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
    editor.captureSelection();
  }, selector);
}

test("formatting combination example renders semantic working markup", async ({ page }) => {
  await page.goto("/examples/formatting-combinations.html");
  await page.waitForFunction(() => globalThis.demoEditor);
  const editor = page.locator(".editra-editor");
  await expect(editor.locator("h1 span")).toHaveCSS("font-family", /Georgia/i);
  await expect(editor.locator("ul > li > h3")).toHaveCount(1);
  await expect(editor.locator("ol > li > h4")).toHaveCSS("text-align", "center");
  await expect(editor.locator(".editra-todo-item > h5")).toHaveCount(1);
  await expect(editor.locator("blockquote")).toContainText("Block quote");
  await expect(page.locator("[data-demo-error]")).toBeHidden();
});

for (const [theme, hostType] of CONFIGURATIONS) {
  test(`${theme} ${hostType} preserves formatting through every heading/list transition`, async ({ page }) => {
    test.setTimeout(90000);
    await createEditor(page, theme, hostType);
    const editor = page.locator(".editra-editor");
    const toolbar = page.locator(".editra-toolbar");
    const choose = async (command, value) => {
      const control = toolbar.locator(`[data-command="${command}"]`);
      await control.dispatchEvent("pointerdown");
      await control.selectOption(value);
    };
    const click = async (command) => {
      await toolbar.locator(`[data-command="${command}"]`).click();
    };

    const listPresets = {
      setBulletListStyle: [
        "disc", "circle", "square", "dash", "arrow", "check", "diamond", "none",
      ],
      setNumberListStyle: [
        "decimal", "decimal-leading-zero", "lower-alpha", "upper-alpha",
        "lower-roman", "upper-roman", "lower-greek", "arabic-indic",
      ],
    };
    for (const [command, presets] of Object.entries(listPresets)) {
      const tag = command === "setBulletListStyle" ? "ul" : "ol";
      await setContent(page,
        '<h3 data-combination="preset"><strong><em>Styled list heading</em></strong></h3>',
      );
      await selectContents(page, '[data-combination="preset"]');
      for (const preset of presets) {
        await choose(command, preset);
        const list = editor.locator(tag);
        await expect(list).toHaveCount(1);
        await expect(list).toHaveAttribute("data-editra-list-style", preset);
        await expect(list.locator('li > h3[data-combination="preset"] strong em')).toHaveCount(1);
        const markerState = await list.locator(":scope > li").first().evaluate((item) => ({
          type: getComputedStyle(item.parentElement).listStyleType,
          marker: getComputedStyle(item, "::marker").content,
        }));
        const customMarkers = {
          dash: "–",
          arrow: "➜",
          check: "✓",
          diamond: "◆",
        };
        if (customMarkers[preset]) {
          expect(markerState.marker).toContain(customMarkers[preset]);
        } else {
          expect(markerState.type).toBe(preset);
        }
      }
      // The main button, unlike the style selector, toggles the active list off.
      await click(tag === "ul" ? "bulletList" : "numberList");
      await expect(editor.locator(`:scope > h3[data-combination="preset"]`)).toHaveCount(1);
    }

    // Chrome can represent the first typed line as a root text node and lines
    // created with Enter as DIVs. All six lines, including line one, must list.
    await page.evaluate(() => {
      const reset = document.createElement("style");
      reset.textContent = ".editra-editor li { display:block; list-style-type:none; }";
      document.head.append(reset);
    });
    await setContent(page, "First ABC<div>Second ABC</div><div>Third ABC</div>" +
      "<div>Fourth ABC</div><div>Fifth ABC</div><div>Sixth ABC</div>");
    await page.evaluate(() => {
      const instance = globalThis.formattingCombinationsEditor;
      const range = document.createRange();
      range.selectNodeContents(instance.editor);
      const selection = getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
      instance.captureSelection();
    });
    const bulletStyleControl = toolbar.locator('[data-command="setBulletListStyle"]');
    await bulletStyleControl.dispatchEvent("pointerdown");
    // Reproduce the collapsed caret Chrome can expose while a native select is
    // open. The pointerdown-saved six-line selection must remain authoritative.
    await page.evaluate(() => {
      const instance = globalThis.formattingCombinationsEditor;
      const thirdLine = instance.editor.querySelectorAll(":scope > div")[1];
      const range = document.createRange();
      range.selectNodeContents(thirdLine);
      range.collapse(true);
      const selection = getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
    });
    await bulletStyleControl.selectOption("square");
    await expect(editor.locator(":scope > ul > li")).toHaveCount(6);
    await expect(editor.locator(":scope > ul > li").first()).toContainText("First ABC");
    expect(await editor.locator(":scope > ul > li").evaluateAll((items) =>
      items.every((item) => getComputedStyle(item).display === "list-item" &&
        getComputedStyle(item).listStyleType === "square"),
    )).toBe(true);
    await choose("setNumberListStyle", "decimal");
    await expect(editor.locator(":scope > ol > li")).toHaveCount(6);
    await expect(editor.locator(":scope > ol > li").first()).toContainText("First ABC");
    expect(await editor.locator(":scope > ol > li").evaluateAll((items) =>
      items.every((item) => getComputedStyle(item).display === "list-item" &&
        getComputedStyle(item).listStyleType === "decimal"),
    )).toBe(true);

    await setContent(page, "First number<div>Second number</div><div>Third number</div>");
    await page.evaluate(() => {
      const instance = globalThis.formattingCombinationsEditor;
      const range = document.createRange();
      range.selectNodeContents(instance.editor);
      const selection = getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
      instance.captureSelection();
    });
    const numberStyleControl = toolbar.locator('[data-command="setNumberListStyle"]');
    await numberStyleControl.dispatchEvent("pointerdown");
    await page.evaluate(() => {
      const instance = globalThis.formattingCombinationsEditor;
      const secondLine = instance.editor.querySelector(":scope > div");
      const range = document.createRange();
      range.selectNodeContents(secondLine);
      range.collapse(true);
      const selection = getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
    });
    await numberStyleControl.selectOption("upper-roman");
    await expect(editor.locator(":scope > ol > li")).toHaveCount(3);
    await expect(editor.locator(":scope > ol > li").first()).toContainText("First number");
    expect(await editor.locator(":scope > ol > li").evaluateAll((items) =>
      items.every((item) => getComputedStyle(item).display === "list-item" &&
        getComputedStyle(item).listStyleType === "upper-roman"),
    )).toBe(true);

    await setContent(page,
      "<table><tbody><tr><td>First cell line<div>Second cell line</div>" +
      "<div>Third cell line</div><div>Fourth cell line</div></td>" +
      "<td>Untouched cell</td></tr></tbody></table>",
    );
    await selectContents(page, "td:first-child");
    await choose("setBulletListStyle", "square");
    await expect(editor.locator("td:first-child > ul > li")).toHaveCount(4);
    await expect(editor.locator("td:first-child > ul > li").first()).toContainText(
      "First cell line",
    );
    await expect(editor.locator(":scope > ul")).toHaveCount(0);
    await expect(editor.locator("table")).toHaveCount(1);
    expect(await editor.locator("td:first-child > ul > li").evaluateAll((items) =>
      items.every((item) => getComputedStyle(item).display === "list-item" &&
        getComputedStyle(item).listStyleType === "square"),
    )).toBe(true);
    await choose("setNumberListStyle", "upper-alpha");
    await expect(editor.locator("td:first-child > ol > li")).toHaveCount(4);
    await expect(editor.locator(":scope > ol")).toHaveCount(0);
    expect(await editor.locator("td:first-child > ol > li").evaluateAll((items) =>
      items.every((item) => getComputedStyle(item).listStyleType === "upper-alpha"),
    )).toBe(true);
    await click("numberList");
    await expect(editor.locator("td:first-child > ol, td:first-child > ul")).toHaveCount(0);
    await expect(editor.locator("td:first-child")).toContainText("First cell line");
    await expect(editor.locator("td:nth-child(2)")).toHaveText("Untouched cell");

    await setContent(page,
      '<table><tbody><tr><td><h3 data-combination="cell-heading"><strong>Cell heading</strong></h3></td></tr></tbody></table>',
    );
    await selectContents(page, '[data-combination="cell-heading"]');
    await choose("setBulletListStyle", "check");
    await expect(editor.locator(
      'td > ul[data-editra-list-style="check"] > li > h3[data-combination="cell-heading"] > strong',
    )).toHaveCount(1);

    for (const tag of ["p", "h1", "h2", "h3", "h4", "h5", "h6"]) {
      await setContent(page, `<p data-combination="${tag}">Combined ${tag.toUpperCase()}</p>`);
      await selectContents(page, `[data-combination="${tag}"]`);
      await choose("setHeading", tag);
      await choose("setFontFamily", "Georgia");
      await choose("setFontSize", "22px");
      const startsBold = await page.evaluate(() => {
        const instance = globalThis.formattingCombinationsEditor;
        instance.emitState();
        return instance.lastEmittedState.bold;
      });
      await click("bold");
      // Headings start visually bold. Exercise the off transition, then turn
      // Bold back on so the remaining combination retains visible emphasis.
      if (startsBold) await click("bold");
      await click("italic");
      await click("underline");
      await choose("setAlignment", "right");
      await choose("setLineHeight", "2");
      await page.evaluate(() =>
        globalThis.formattingCombinationsEditor.executeCommand("setForeColor", "#2468ac"),
      );

      await click("bulletList");
      const blockSelector = tag === "p"
        ? `ul > li[data-combination="${tag}"], ul > li > p[data-combination="${tag}"]`
        : `ul > li > ${tag}[data-combination="${tag}"]`;
      const combinedBlock = editor.locator(blockSelector);
      await expect(combinedBlock).toHaveCount(1);
      await expect.poll(() => combinedBlock.evaluate((element) => {
        const text = [...element.querySelectorAll("*")].at(-1) || element;
        const textStyle = getComputedStyle(text);
        const block = element.matches("li") ? element : element.closest("p,h1,h2,h3,h4,h5,h6");
        const blockStyle = getComputedStyle(block);
        return {
          family: textStyle.fontFamily,
          size: textStyle.fontSize,
          color: textStyle.color,
          bold: Boolean(element.querySelector("b,strong")) ||
            Number.parseInt(textStyle.fontWeight, 10) >= 600,
          italic: Boolean(element.querySelector("i,em")) ||
            textStyle.fontStyle === "italic",
          underline: Boolean(element.querySelector("u")) ||
            textStyle.textDecorationLine.includes("underline"),
          alignment: blockStyle.textAlign,
          lineHeightRatio:
            Number.parseFloat(blockStyle.lineHeight) /
            Number.parseFloat(blockStyle.fontSize),
        };
      })).toEqual({
        family: expect.stringMatching(/Georgia/i),
        size: "22px",
        color: "rgb(36, 104, 172)",
        bold: true,
        italic: true,
        underline: true,
        alignment: "right",
        lineHeightRatio: expect.closeTo(2, 1),
      });

      await page.evaluate(() =>
        globalThis.formattingCombinationsEditor.executeCommand("numberList", {
          style: "upper-roman",
        }),
      );
      await expect(editor.locator("ol")).toHaveCSS("list-style-type", "upper-roman");
      if (tag !== "p") {
        await expect(editor.locator(`ol > li > ${tag}[data-combination="${tag}"]`)).toHaveCount(1);
      }

      await selectContents(page, `[data-combination="${tag}"]`);
      await choose("setHeading", "p");
      await expect(editor.locator(`ol > li > p[data-combination="${tag}"]`)).toHaveCount(1);

      await click("numberList");
      await expect(editor.locator(`:scope > p[data-combination="${tag}"]`)).toHaveCount(1);
    }

    await setContent(page,
      '<p data-combination="level-one">First level</p><h3 data-combination="level-two">Nested heading</h3>',
    );
    await page.evaluate(() => {
      const instance = globalThis.formattingCombinationsEditor;
      const first = instance.editor.querySelector('[data-combination="level-one"]');
      const second = instance.editor.querySelector('[data-combination="level-two"]');
      const range = document.createRange();
      range.setStartBefore(first);
      range.setEndAfter(second);
      const selection = getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
      instance.captureSelection();
    });
    await click("bulletList");
    await selectContents(page, '[data-combination="level-two"]');
    await click("multilevelList");
    await expect(editor.locator(
      'ul > li > ul > li > h3[data-combination="level-two"]',
    )).toHaveCount(1);
    await choose("setBulletListStyle", "check");
    await expect(editor.locator("ul > li > ul")).toHaveAttribute(
      "data-editra-list-style",
      "check",
    );

    await setContent(page, '<h5 data-combination="todo-heading">Heading task</h5>');
    await selectContents(page, '[data-combination="todo-heading"]');
    await click("todoList");
    await expect(editor.locator(
      'ul.editra-todo-list > li.editra-todo-item > h5[data-combination="todo-heading"]',
    )).toHaveCount(1);
    const checkbox = editor.locator(".editra-todo-item > input");
    await checkbox.check({ force: true });
    await expect(editor.locator(".editra-todo-item")).toHaveClass(/is-complete/);
  });
}
