"use strict";

const { test, expect } = require("@playwright/test");

async function openFullEditor(page) {
  await page.goto("/examples/full.html");
  await page.waitForFunction(() => globalThis.demoEditor);
  await page.evaluate(async () => {
    const editor = globalThis.demoEditor;
    for (const name of editor.plugins.keys()) await editor.ensurePlugin(name);
  });
}

test("every rendered toolbar and menu tool has a command handler and valid choices", async ({ page }) => {
  await openFullEditor(page);
  const audit = await page.evaluate(() => {
    const editor = globalThis.demoEditor;
    const toolbar = [...editor.toolbar.element.querySelectorAll("[data-command]")];
    const menu = [...editor.menubar.element.querySelectorAll(".editra-menu-item[data-command]")];
    const missingToolbar = toolbar
      .map((item) => item.dataset.command)
      .filter((command) => !editor.commands.has(command));
    const missingMenu = menu
      .map((item) => item.dataset.command)
      .filter((command) => !editor.commands.has(command));
    const invalidToolbarSelects = toolbar
      .filter((item) => item instanceof HTMLSelectElement)
      .filter((item) => {
        const values = [...item.options].map((option) => option.value);
        return !values.length || new Set(values).size !== values.length;
      })
      .map((item) => item.dataset.command);
    const invalidMenuChoosers = menu
      .filter((item) => item.classList.contains("has-submenu"))
      .filter((item) => {
        const control = editor.menubar.controlFor(item);
        return !control ||
          !["select", "color"].includes(control.type) ||
          (control.type === "select" && !control.options?.length);
      })
      .map((item) => item.dataset.command);
    return {
      toolbarCommands: [...new Set(toolbar.map((item) => item.dataset.command))],
      menuCommands: [...new Set(menu.map((item) => item.dataset.command))],
      missingToolbar,
      missingMenu,
      invalidToolbarSelects,
      invalidMenuChoosers,
      bulletToolbarOptions: editor.toolbar.getControl("setBulletListStyle")
        ?.options.map(([value]) => value),
      numberToolbarOptions: editor.toolbar.getControl("setNumberListStyle")
        ?.options.map(([value]) => value),
      bulletMenuOptions: editor.menubar.controlFor(
        editor.menubar.element.querySelector('[data-command="bulletList"]'),
      )?.options.map(([value]) => value),
      numberMenuOptions: editor.menubar.controlFor(
        editor.menubar.element.querySelector('[data-command="numberList"]'),
      )?.options.map(([value]) => value),
    };
  });

  expect(audit.toolbarCommands.length).toBeGreaterThan(35);
  expect(audit.menuCommands.length).toBeGreaterThan(60);
  expect(audit.missingToolbar).toEqual([]);
  expect(audit.missingMenu).toEqual([]);
  expect(audit.invalidToolbarSelects).toEqual([]);
  expect(audit.invalidMenuChoosers).toEqual([]);
  expect(audit.bulletToolbarOptions).toEqual(audit.bulletMenuOptions);
  expect(audit.numberToolbarOptions).toEqual(audit.numberMenuOptions);
  expect(audit.bulletToolbarOptions).toEqual([
    "disc", "circle", "square", "dash", "arrow", "check", "diamond", "none",
  ]);
  expect(audit.numberToolbarOptions).toEqual([
    "decimal", "decimal-leading-zero", "lower-alpha", "upper-alpha",
    "lower-roman", "upper-roman", "lower-greek", "arabic-indic",
  ]);
});

test("every declared formatting, layout, language, and list option applies", async ({ page }) => {
  test.setTimeout(90000);
  await openFullEditor(page);
  const failures = await page.evaluate(async () => {
    const editor = globalThis.demoEditor;
    const failures = [];
    const check = (condition, label, actual = "") => {
      if (!condition) failures.push(`${label}: ${String(actual)}`);
    };
    const frames = async () =>
      new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const setContent = async (html) => {
      editor.setCode(html);
      for (let attempt = 0; attempt < 10 && editor.pendingCode !== null; attempt += 1) {
        await frames();
      }
      if (editor.pendingCode !== null) {
        throw new Error(`Audit content update did not settle: ${editor.pendingCode}`);
      }
    };
    const select = (selector) => {
      const element = editor.editor.querySelector(selector);
      if (!element) {
        throw new Error(`Audit selection target missing: ${selector}; ${editor.editor.innerHTML}`);
      }
      const range = document.createRange();
      range.selectNodeContents(element);
      const selection = getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
      editor.captureSelection();
      return element;
    };
    const leaf = (element) => [...element.querySelectorAll("*")].at(-1) || element;
    const options = (command) => {
      const toolbarControl = editor.toolbar.getControl(command);
      if (toolbarControl?.options) return toolbarControl.options.map(([value]) => value);
      const item = editor.menubar.element.querySelector(`[data-command="${command}"]`);
      return editor.menubar.controlFor(item)?.options?.map(([value]) => value) || [];
    };
    const menuColors = (command) => {
      const item = editor.menubar.element.querySelector(`[data-command="${command}"]`);
      editor.menubar.openChooser(item, editor.menubar.controlFor(item));
      const values = [...editor.menubar.chooser.querySelectorAll("[data-menu-value]")]
        .map((choice) => choice.dataset.menuValue);
      editor.menubar.closeChooser();
      return values;
    };
    const rgb = (hex) => {
      if (hex === "transparent") return "rgba(0, 0, 0, 0)";
      const value = Number.parseInt(hex.slice(1), 16);
      return `rgb(${(value >> 16) & 255}, ${(value >> 8) & 255}, ${value & 255})`;
    };

    for (const family of options("setFontFamily")) {
      await setContent('<p data-audit="inline">Option audit</p>');
      select('[data-audit="inline"]');
      await editor.executeCommand("setFontFamily", family);
      await frames();
      const actual = getComputedStyle(leaf(editor.editor.querySelector('[data-audit="inline"]')))
        .fontFamily.split(",")[0].replace(/["']/g, "").trim().toLowerCase();
      check(actual === family.toLowerCase(), `font family ${family}`, actual);
    }
    for (const size of options("setFontSize")) {
      await setContent('<p data-audit="inline">Option audit</p>');
      select('[data-audit="inline"]');
      await editor.executeCommand("setFontSize", size);
      await frames();
      const actual = getComputedStyle(leaf(editor.editor.querySelector('[data-audit="inline"]'))).fontSize;
      check(actual === size, `font size ${size}`, actual);
    }
    for (const command of ["setForeColor", "setBackgroundColor", "highlightText"]) {
      for (const color of menuColors(command)) {
        await setContent('<p data-audit="inline">Option audit</p>');
        select('[data-audit="inline"]');
        await editor.executeCommand(command, color);
        await frames();
        const property = command === "setForeColor" ? "color" : "backgroundColor";
        const actual = getComputedStyle(leaf(editor.editor.querySelector('[data-audit="inline"]')))[property];
        check(actual === rgb(color), `${command} ${color}`, actual);
      }
    }
    const caseResults = {
      lowercase: "mixed case",
      uppercase: "MIXED CASE",
      title: "Mixed Case",
      sentence: "Mixed case",
    };
    for (const mode of options("case-change")) {
      await setContent('<p data-audit="case"><strong>mIxEd</strong> cAsE</p>');
      select('[data-audit="case"]');
      await editor.executeCommand("case-change", mode);
      const block = editor.editor.querySelector('[data-audit="case"]');
      check(block.textContent === caseResults[mode], `case change ${mode}`, block.textContent);
      check(Boolean(block.querySelector("strong")), `case change preserves formatting ${mode}`);
    }

    for (const tag of options("setHeading")) {
      await setContent(`<p data-audit="block">${tag}</p>`);
      select('[data-audit="block"]');
      await editor.executeCommand("setHeading", tag);
      check(Boolean(editor.editor.querySelector(`${tag}[data-audit="block"]`)), `heading ${tag}`);
    }
    for (const alignment of options("setAlignment")) {
      await setContent('<h3 data-audit="block">alignment</h3>');
      select('[data-audit="block"]');
      await editor.executeCommand("setAlignment", alignment);
      check(getComputedStyle(editor.editor.querySelector('[data-audit="block"]')).textAlign === alignment,
        `alignment ${alignment}`,
        getComputedStyle(editor.editor.querySelector('[data-audit="block"]')).textAlign);
    }
    for (const lineHeight of options("setLineHeight")) {
      await setContent('<h3 data-audit="block">line height</h3>');
      select('[data-audit="block"]');
      await editor.executeCommand("setLineHeight", lineHeight);
      const block = editor.editor.querySelector('[data-audit="block"]');
      const style = getComputedStyle(block);
      const ratio = Number.parseFloat(style.lineHeight) / Number.parseFloat(style.fontSize);
      check(Math.abs(ratio - Number(lineHeight)) < 0.08, `line height ${lineHeight}`, ratio);
    }

    for (const [command, listTag] of [["bulletList", "ul"], ["numberList", "ol"]]) {
      for (const style of options(command)) {
        await setContent(`<h4 data-audit="list">${style}</h4>`);
        select('[data-audit="list"]');
        await editor.executeCommand(command, { style });
        const list = editor.editor.querySelector(`${listTag}`);
        check(Boolean(list?.querySelector("li > h4[data-audit='list']")), `${command} preserves heading ${style}`);
        check(list?.dataset.editraListStyle === style, `${command} stores style ${style}`,
          list?.dataset.editraListStyle);
        if (!new Set(["dash", "arrow", "check", "diamond"]).has(style)) {
          check(getComputedStyle(list).listStyleType === style, `${command} style ${style}`,
            getComputedStyle(list).listStyleType);
        }
      }
    }

    for (const language of options("setLanguage")) {
      await editor.executeCommand("setLanguage", language);
      check(editor.editor.lang === language, `language ${language}`, editor.editor.lang);
      check(editor.editor.dir === (["ar", "ur"].includes(language) ? "rtl" : "ltr"),
        `language direction ${language}`, editor.editor.dir);
    }
    for (const size of options("setPageSize")) {
      const result = await editor.executeCommand("setPageSize", size);
      check(result?.pageSize === size, `page size ${size}`, result?.pageSize);
    }
    for (const orientation of options("setOrientation")) {
      const result = await editor.executeCommand("setOrientation", orientation);
      check(result?.orientation === orientation, `orientation ${orientation}`, result?.orientation);
    }
    for (const margin of options("setMargin")) {
      await editor.executeCommand("setMargin", margin);
      check(Boolean(editor.state.margins?.left), `margin ${margin}`, editor.state.margins?.left);
    }
    return failures;
  });

  expect(failures).toEqual([]);
});
