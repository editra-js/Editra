"use strict";

const childProcess = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const zlib = require("node:zlib");
const { chromium } = require("@playwright/test");

const root = path.resolve(__dirname, "../..");
const port = 8197;
const url = `http://127.0.0.1:${port}/tests/security/browser-security.html`;
const browsers = [
  ["Chrome", "C:/Program Files/Google/Chrome/Application/chrome.exe"],
  ["Edge", "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"],
].filter(([, executable]) => fs.existsSync(executable));

function crc32(buffer) {
  let value = 0xffffffff;
  for (const byte of buffer) {
    value ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      value = (value >>> 1) ^ (value & 1 ? 0xedb88320 : 0);
    }
  }
  return (value ^ 0xffffffff) >>> 0;
}

function createDocx(extraEntries = {}) {
  const entries = {
    "[Content_Types].xml":
      '<?xml version="1.0" encoding="UTF-8"?>' +
      '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
      '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
      '<Default Extension="xml" ContentType="application/xml"/>' +
      '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>' +
      '<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>' +
      '<Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/>' +
      "</Types>",
    "_rels/.rels":
      '<?xml version="1.0" encoding="UTF-8"?>' +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>' +
      "</Relationships>",
    "word/document.xml":
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
      '<w:body><w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:rPr><w:b/><w:color w:val="1F4E78"/><w:sz w:val="32"/></w:rPr><w:t>Imported Word document</w:t></w:r></w:p>' +
      '<w:p><w:pPr><w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr></w:pPr><w:r><w:t>First styled list item</w:t></w:r></w:p>' +
      '<w:p><w:pPr><w:tabs><w:tab w:val="left" w:pos="1440"/></w:tabs><w:pBdr><w:bottom w:val="single" w:sz="8" w:color="auto"/></w:pBdr><w:rPr><w:rFonts w:ascii="Verdana" w:hAnsi="Verdana"/><w:sz w:val="20"/></w:rPr></w:pPr><w:r><w:t xml:space="preserve">  Preserved</w:t><w:tab/><w:t>Tab stop</w:t></w:r></w:p>' +
      '<w:tbl><w:tblPr><w:tblW w:w="0" w:type="auto"/><w:tblLayout w:type="fixed"/></w:tblPr><w:tblGrid><w:gridCol w:w="2400"/><w:gridCol w:w="3600"/></w:tblGrid><w:tr><w:tc><w:tcPr><w:tcW w:w="2400" w:type="dxa"/></w:tcPr><w:p><w:r><w:t>Grid A</w:t></w:r></w:p></w:tc><w:tc><w:tcPr><w:tcW w:w="3600" w:type="dxa"/></w:tcPr><w:p><w:r><w:t>Grid B</w:t></w:r></w:p></w:tc></w:tr></w:tbl>' +
      '<w:p><w:r><w:t>End of first page</w:t><w:br w:type="page"/><w:t>Second page content</w:t></w:r></w:p>' +
      '<w:sectPr><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/></w:sectPr></w:body></w:document>',
    "word/_rels/document.xml.rels":
      '<?xml version="1.0" encoding="UTF-8"?>' +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>' +
      '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering" Target="numbering.xml"/>' +
      "</Relationships>",
    "word/styles.xml":
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">' +
      '<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/><w:sz w:val="22"/></w:rPr></w:style>' +
      "</w:styles>",
    "word/numbering.xml":
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<w:numbering xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">' +
      '<w:abstractNum w:abstractNumId="0"><w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="decimal"/><w:lvlText w:val="%1."/><w:suff w:val="space"/></w:lvl></w:abstractNum>' +
      '<w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num></w:numbering>',
    ...extraEntries,
  };
  const localParts = [];
  const centralParts = [];
  let localOffset = 0;
  Object.entries(entries).forEach(([entryName, source]) => {
    const name = Buffer.from(entryName);
    const content = Buffer.from(source);
    const compressed = zlib.deflateRawSync(content);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(8, 8);
    local.writeUInt32LE(crc32(content), 14);
    local.writeUInt32LE(compressed.length, 18);
    local.writeUInt32LE(content.length, 22);
    local.writeUInt16LE(name.length, 26);
    localParts.push(local, name, compressed);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(8, 10);
    central.writeUInt32LE(crc32(content), 16);
    central.writeUInt32LE(compressed.length, 20);
    central.writeUInt32LE(content.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt32LE(localOffset, 42);
    centralParts.push(central, name);
    localOffset += local.length + name.length + compressed.length;
  });
  const centralOffset = localOffset;
  const centralSize = centralParts.reduce((size, part) => size + part.length, 0);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(Object.keys(entries).length, 8);
  end.writeUInt16LE(Object.keys(entries).length, 10);
  end.writeUInt32LE(centralSize, 12);
  end.writeUInt32LE(centralOffset, 16);
  return Buffer.concat([...localParts, ...centralParts, end]);
}

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

async function verifyRealObjectMovement(page, browserName) {
  await page.setViewportSize({ width: 1400, height: 1800 });
  const variants = [
    ["Word", "div"],
    ["Word", "textarea"],
    ["Classic", "div"],
    ["Classic", "textarea"],
  ];
  for (const [theme, hostType] of variants) {
    await page.goto(`http://127.0.0.1:${port}/examples/word-theme.html`, {
      waitUntil: "networkidle",
    });
    await page.waitForFunction(() => globalThis.demoEditor);
    await page.evaluate(async ({ themeName, elementName }) => {
      globalThis.demoEditor.destroy();
      const host = document.createElement(elementName);
      host.id = "movement-test-host";
      document.body.replaceChildren(host);
      const editor = await globalThis.Editra.init({
        selector: "#movement-test-host",
        theme: themeName,
        showMenuBar: false,
      });
      globalThis.movementTestEditor = editor;
      editor.setCode(
        '<h2 data-format-detection="true" style="text-align:right;line-height:1.85"><span style="font-family:Georgia;font-size:19px;color:#123456;background-color:#fedcba;font-weight:700;font-style:italic;text-decoration:underline">Formatted selection</span></h2><p><span data-unsupported-format="true" style="font-family:Imaginary Font;font-size:77px">Unsupported preset</span></p><p data-movement-start="true">Start</p><p data-movement-target="true">Target</p>',
      );
      await new Promise((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(resolve)),
      );
      editor.placeCaretAtEnd();
      await editor.executeCommand("insertBarcode", {
        value: "MOVE123",
        format: "CODE128",
      });
      editor.placeCaretAtEnd();
      await editor.executeCommand("insertQrCode", { value: "move-qr" });
      editor.placeCaretAtEnd();
      await editor.executeCommand("insertTable", { rows: 3, columns: 3 });
      editor.placeCaretAtEnd();
      await editor.executeCommand("insertImage", {
        url: "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==",
        alt: "Movable test image",
      });
      editor.placeCaretAtEnd();
      await editor.executeCommand("insertEmoji", { emoji: "\u{1F642}" });
      const emojiTarget = document.createElement("p");
      emojiTarget.dataset.emojiMovementTarget = "true";
      emojiTarget.textContent = "Emoji target";
      editor.editor.querySelector(".editra-emoji-frame")?.after(emojiTarget);
      await new Promise((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(resolve)),
      );
    }, { themeName: theme, elementName: hostType });

    const editableCell = page.locator(".editra-table-frame td").first();
    await editableCell.click({ position: { x: 24, y: 18 } });
    await page.keyboard.type("Editable table text");
    const tableTyping = await editableCell.textContent();
    if (!tableTyping.includes("Editable table text")) {
      throw new Error(
        `${browserName} ${theme}/${hostType} table cell did not accept mouse typing.`,
      );
    }
    await page.keyboard.press("Tab");
    await page.keyboard.type("Next table cell");
    const nextCellTyping = await page.locator(".editra-table-frame td").nth(1)
      .textContent();
    if (!nextCellTyping.includes("Next table cell")) {
      const tabDebug = await page.evaluate(() => {
        const selection = getSelection();
        const anchor = selection?.anchorNode;
        const element = anchor?.nodeType === Node.ELEMENT_NODE
          ? anchor
          : anchor?.parentElement;
        return {
          activeCell: element?.closest?.("td,th")?.cellIndex ?? null,
          cells: [...document.querySelectorAll(".editra-table-frame td")].map(
            (cell) => cell.textContent,
          ),
        };
      });
      throw new Error(
        `${browserName} ${theme}/${hostType} Tab did not move editing to the next table cell: ${JSON.stringify(tabDebug)}`,
      );
    }
    const tableContent = await page.evaluate(async () => {
      const editor = globalThis.movementTestEditor;
      const cells = [...editor.editor.querySelectorAll(".editra-table-frame th, .editra-table-frame td")];
      const textCell = cells.find((cell) =>
        cell.textContent.includes("Editable table text"),
      );
      const text = textCell.firstChild;
      const textRange = document.createRange();
      textRange.selectNodeContents(text);
      const selection = getSelection();
      selection.removeAllRanges();
      selection.addRange(textRange);
      editor.captureSelection();
      await editor.executeCommand("bold");
      await editor.executeCommand("setFontFamily", "Arial");
      await editor.executeCommand("setFontSize", "16px");
      await editor.executeCommand("setForeColor", "#2457a6");

      const placeCaret = (cell) => {
        const range = document.createRange();
        range.selectNodeContents(cell);
        range.collapse(false);
        selection.removeAllRanges();
        selection.addRange(range);
        editor.selection = range.cloneRange();
      };
      placeCaret(cells[2]);
      await editor.executeCommand("insertBarcode", {
        value: "CELL123",
        format: "CODE128",
      });
      placeCaret(cells[3]);
      await editor.executeCommand("insertQrCode", { value: "cell-qr" });
      placeCaret(cells[4]);
      await editor.executeCommand("insertImage", {
        url: "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==",
        alt: "Table cell image",
      });
      placeCaret(cells[5]);
      const videoUrl = URL.createObjectURL(
        new Blob([new Uint8Array([0, 0, 0, 0])], { type: "video/mp4" }),
      );
      editor.insertVideo(videoUrl, {
        source: "local",
        name: "table-cell-video.mp4",
        mime: "video/mp4",
      });
      placeCaret(cells[6]);
      await editor.executeCommand("insertEmoji", { emoji: "🙂" });
      await new Promise((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(resolve)),
      );

      const walker = document.createTreeWalker(textCell, NodeFilter.SHOW_TEXT);
      let formattedText = null;
      while (walker.nextNode()) {
        if (walker.currentNode.nodeValue.includes("Editable table text")) {
          formattedText = walker.currentNode;
          break;
        }
      }
      const computed = getComputedStyle(formattedText?.parentElement || textCell);
      const frames = [...editor.editor.querySelectorAll(
        ".editra-table-frame .editra-media-frame[data-editra-media]",
      )];
      return {
        fontFamily: computed.fontFamily,
        fontSize: computed.fontSize,
        fontWeight: computed.fontWeight,
        color: computed.color,
        mediaKinds: frames.map((frame) => frame.dataset.editraMedia),
        allInsideCells: frames.every((frame) => Boolean(frame.closest("td,th"))),
        allDraggable: frames.every(
          (frame) => frame.draggable && frame.dataset.editraDraggable === "true",
        ),
        allResizable: frames.every(
          (frame) => frame.querySelectorAll(":scope > .editra-resize-handle").length === 4,
        ),
        textCellHTML: textCell.innerHTML,
      };
    });
    if (
      !tableContent.fontFamily.toLowerCase().includes("arial") ||
      tableContent.fontSize !== "16px" ||
      Number.parseInt(tableContent.fontWeight, 10) < 600 ||
      tableContent.color !== "rgb(36, 87, 166)" ||
      !["barcode", "qr", "image", "video", "emoji"].every((kind) =>
        tableContent.mediaKinds.includes(kind),
      ) ||
      !tableContent.allInsideCells ||
      !tableContent.allDraggable ||
      !tableContent.allResizable
    ) {
      throw new Error(
        `${browserName} ${theme}/${hostType} table content behavior failed: ${JSON.stringify(tableContent)}`,
      );
    }

    const detectedFormatting = await page.evaluate(() => {
      const editor = globalThis.movementTestEditor;
      const text = editor.editor.querySelector("[data-format-detection] span")
        .firstChild;
      const range = document.createRange();
      range.setStart(text, 2);
      range.setEnd(text, 11);
      const selection = getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
      editor.captureSelection();
      editor.emitState();
      const value = (command) =>
        editor.toolbar.element.querySelector(`[data-command="${command}"]`)?.value;
      return {
        state: editor.lastEmittedState,
        toolbar: {
          fontFamily: value("setFontFamily"),
          fontSize: value("setFontSize"),
          heading: value("setHeading"),
          alignment: value("setAlignment"),
          lineHeight: value("setLineHeight"),
          foreColor: editor.toolbar.element.querySelector(
            '[data-command="setForeColor"] input[type="color"]',
          )?.value,
          backgroundColor: editor.toolbar.element.querySelector(
            '[data-command="setBackgroundColor"] input[type="color"]',
          )?.value,
        },
      };
    });
    const detectedState = detectedFormatting.state;
    const detectedToolbar = detectedFormatting.toolbar;
    if (
      detectedState.fontFamily !== "Georgia" ||
      detectedState.fontSize !== "19px" ||
      detectedState.foreColor !== "#123456" ||
      detectedState.backgroundColor !== "#fedcba" ||
      detectedState.heading !== "h2" ||
      detectedState.alignment !== "right" ||
      detectedState.lineHeight !== "1.85" ||
      !detectedState.bold ||
      !detectedState.italic ||
      !detectedState.underline ||
      detectedToolbar.fontFamily !== "Georgia" ||
      detectedToolbar.fontSize !== "19px" ||
      detectedToolbar.heading !== "h2" ||
      detectedToolbar.alignment !== "right" ||
      detectedToolbar.lineHeight !== "1.85" ||
      detectedToolbar.foreColor !== "#123456" ||
      detectedToolbar.backgroundColor !== "#fedcba"
    ) {
      throw new Error(
        `${browserName} ${theme}/${hostType} selection formatting detection failed: ${JSON.stringify(detectedFormatting)}`,
      );
    }
    const unsupportedPreset = await page.evaluate(() => {
      const editor = globalThis.movementTestEditor;
      const text = editor.editor.querySelector("[data-unsupported-format]")
        .firstChild;
      const range = document.createRange();
      range.selectNodeContents(text);
      const selection = getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
      editor.captureSelection();
      editor.emitState();
      const fontFamily = editor.toolbar.element.querySelector(
        '[data-command="setFontFamily"]',
      );
      const fontSize = editor.toolbar.element.querySelector(
        '[data-command="setFontSize"]',
      );
      return {
        fontFamilyValue: fontFamily.value,
        fontSizeValue: fontSize.value,
        generatedOptions: editor.toolbar.element.querySelectorAll(
          "option[data-editra-detected]",
        ).length,
      };
    });
    if (
      unsupportedPreset.fontFamilyValue !== "" ||
      unsupportedPreset.fontSizeValue !== "" ||
      unsupportedPreset.generatedOptions !== 0
    ) {
      throw new Error(
        `${browserName} ${theme}/${hostType} unsupported formatting was added to the toolbar: ${JSON.stringify(unsupportedPreset)}`,
      );
    }
    const detectedObject = await page.evaluate(() => {
      const editor = globalThis.movementTestEditor;
      const barcode = editor.editor.querySelector(
        '.editra-media-frame[data-editra-media="barcode"]',
      );
      editor.selectObject(barcode);
      return editor.lastEmittedState.selectedProperties;
    });
    if (
      detectedObject.type !== "barcode" ||
      detectedObject.tag !== "figure" ||
      detectedObject.width <= 0 ||
      detectedObject.height <= 0
    ) {
      throw new Error(
        `${browserName} ${theme}/${hostType} object property detection failed: ${JSON.stringify(detectedObject)}`,
      );
    }

    const dragTo = async (
      source,
      target,
      position,
      horizontal = "left",
      previewMode = "ghost",
    ) => {
      await source.scrollIntoViewIfNeeded();
      await target.scrollIntoViewIfNeeded();
      const sourceBox = await source.boundingBox();
      const targetBox = await target.boundingBox();
      if (!sourceBox || !targetBox) {
        throw new Error("movable object or drop target has no pointer geometry");
      }
      await page.mouse.move(
        sourceBox.x + sourceBox.width / 2,
        sourceBox.y + sourceBox.height / 2,
      );
      await page.mouse.down();
      await page.mouse.move(
        horizontal === "right"
          ? targetBox.x + targetBox.width * 0.75
          : targetBox.x + Math.min(20, targetBox.width / 2),
        position === "before" ? targetBox.y + 2 : targetBox.y + targetBox.height - 2,
        { steps: 12 },
      );
      const preview = await page.evaluate(() => {
        const ghost = document.querySelector(".editra-object-drag-ghost");
        const live = document.querySelector("[data-editra-live-drag='true']");
        return {
          exists: Boolean(ghost),
          transform: ghost?.style.transform || "",
          live: Boolean(live),
          liveTransform: live?.style.transform || "",
        };
      });
      const previewFailed = previewMode === "live"
        ? !preview.live || !preview.liveTransform.includes("translate3d(")
        : !preview.exists || /translate3d\(0px, 0px, 0/.test(preview.transform);
      if (previewFailed) {
        const sourceDescription = await source.evaluate((element) => ({
          className: element.className,
          media: element.closest("[data-editra-media]")?.dataset.editraMedia || "",
          tagName: element.tagName,
        }));
        throw new Error(
          `smooth pointer preview failed for ${JSON.stringify(sourceDescription)}: ${JSON.stringify(preview)}`,
        );
      }
      await page.mouse.up();
    };

    const target = page.locator('[data-movement-target="true"]');
    await dragTo(
      page.locator('.editra-emoji-frame > .editra-emoji-object').first(),
      page.locator('[data-emoji-movement-target="true"]'),
      "after",
      "right",
      "live",
    );
    await dragTo(
      page.locator('.editra-media-frame[data-editra-media="barcode"] > .editra-object-move-handle').first(),
      target,
      "before",
      "left",
      "live",
    );
    await dragTo(
      page.locator('.editra-media-frame[data-editra-media="qr"] > .editra-object-move-handle').first(),
      target,
      "after",
      "left",
      "live",
    );
    await dragTo(
      page.locator(".editra-table-frame .editra-table-select-handle"),
      page.locator('[data-movement-start="true"]'),
      "before",
    );
    await dragTo(
      page.locator('.editra-media-frame[data-editra-media="image"] > .editra-object-move-handle').first(),
      page.locator('[data-movement-start="true"]'),
      "after",
      "right",
      "live",
    );

    const movement = await page.evaluate(() => {
      const editor = globalThis.movementTestEditor;
      const start = editor.editor.querySelector('[data-movement-start="true"]');
      const target = editor.editor.querySelector('[data-movement-target="true"]');
      const transformed = (kind) =>
        [...editor.editor.querySelectorAll(
          `.editra-media-frame[data-editra-media="${kind}"]`,
        )].find((frame) => frame.style.transform.includes("translate3d("))
          ?.style.transform || "";
      return {
        barcodeTransform: transformed("barcode"),
        barcodeLabelStyle: editor.editor.querySelector(
          '.editra-media-frame[data-editra-media="barcode"] svg text',
        )?.getAttribute("style") || "",
        qrTransform: transformed("qr"),
        tableBeforeStart:
          start.previousElementSibling?.classList.contains("editra-table-frame"),
        imageTransform: editor.editor.querySelector(
          '.editra-media-frame[data-editra-media="image"]',
        )?.style.transform || "",
        emojiTransform: editor.editor.querySelector(
          '.editra-emoji-frame[data-editra-media="emoji"]',
        )?.style.transform || "",
        order: [...editor.editor.children].map((element) =>
          element.dataset.editraMedia ||
          (element.hasAttribute("data-movement-start") ? "start" : "") ||
          (element.hasAttribute("data-movement-target") ? "target" : "") ||
          (element.classList.contains("editra-table-frame") ? "table" : "") ||
          element.tagName.toLowerCase(),
        ),
        dragging: Boolean(editor.editor.querySelector(".is-object-dragging")),
        hostType: editor.host.tagName.toLowerCase(),
        theme: editor.options.theme,
      };
    });
    if (
      !movement.barcodeTransform.includes("translate3d(") ||
      !/Arial/i.test(movement.barcodeLabelStyle) ||
      /Editra\s+(?:Code|EAN)/i.test(movement.barcodeLabelStyle) ||
      !movement.qrTransform.includes("translate3d(") ||
      !movement.tableBeforeStart ||
      !movement.imageTransform.includes("translate3d(") ||
      !movement.emojiTransform.includes("translate3d(") ||
      movement.dragging ||
      movement.hostType !== hostType ||
      movement.theme !== theme
    ) {
      throw new Error(
        `${browserName} ${theme}/${hostType} real pointer movement failed: ${JSON.stringify(movement)}`,
      );
    }

    const measureTable = () => page.evaluate(() => {
      const table = globalThis.movementTestEditor.editor.querySelector(
        ".editra-table-frame table",
      );
      return {
        columns: [...table.querySelectorAll(":scope > colgroup > col")].map(
          (column) => column.getBoundingClientRect().width,
        ),
        firstRowHeight: table.rows[0].getBoundingClientRect().height,
        height: table.getBoundingClientRect().height,
        width: table.getBoundingClientRect().width,
      };
    });
    const resizeBy = async (locator, deltaX, deltaY) => {
      await locator.scrollIntoViewIfNeeded();
      const box = await locator.boundingBox();
      if (!box) throw new Error("table resize handle has no pointer geometry");
      const vertical = box.height > box.width;
      const x = vertical
        ? box.x + box.width / 2
        : box.x + Math.min(24, box.width / 4);
      const y = vertical
        ? box.y + Math.min(16, box.height / 4)
        : box.y + box.height / 2;
      await page.mouse.move(x, y);
      await page.mouse.down();
      await page.mouse.move(x + deltaX, y + deltaY, { steps: 10 });
      await page.mouse.up();
      await page.waitForTimeout(30);
    };

    const internalBefore = await measureTable();
    await resizeBy(
      page.locator(".editra-table-frame .editra-table-column-handle").first(),
      60,
      0,
    );
    const internalAfter = await measureTable();
    if (
      Math.abs(internalAfter.width - internalBefore.width) > 2 ||
      internalAfter.columns[0] - internalBefore.columns[0] < 45 ||
      internalBefore.columns[1] - internalAfter.columns[1] < 45
    ) {
      throw new Error(
        `${browserName} ${theme}/${hostType} internal table divider resize failed: ${JSON.stringify({ internalBefore, internalAfter })}`,
      );
    }

    const outerBefore = await measureTable();
    await resizeBy(
      page.locator(".editra-table-frame .editra-table-column-handle").last(),
      -40,
      0,
    );
    const outerAfter = await measureTable();
    if (
      outerBefore.width - outerAfter.width < 30 ||
      outerBefore.columns.at(-1) - outerAfter.columns.at(-1) < 30
    ) {
      throw new Error(
        `${browserName} ${theme}/${hostType} outer table resize failed: ${JSON.stringify({ outerBefore, outerAfter })}`,
      );
    }

    const rowBefore = await measureTable();
    await resizeBy(
      page.locator(".editra-table-frame .editra-table-row-handle").first(),
      0,
      36,
    );
    const rowAfter = await measureTable();
    if (rowAfter.firstRowHeight - rowBefore.firstRowHeight < 28) {
      throw new Error(
        `${browserName} ${theme}/${hostType} table row resize failed: ${JSON.stringify({ rowBefore, rowAfter })}`,
      );
    }

    const cornerBefore = await measureTable();
    await resizeBy(
      page.locator(".editra-table-frame .editra-table-corner-handle"),
      -60,
      32,
    );
    const cornerReduced = await measureTable();
    if (
      cornerBefore.width - cornerReduced.width < 45 ||
      cornerReduced.height - cornerBefore.height < 20 ||
      cornerReduced.columns.some((width) => width < 47)
    ) {
      throw new Error(
        `${browserName} ${theme}/${hostType} corner table reduction failed: ${JSON.stringify({ cornerBefore, cornerReduced })}`,
      );
    }
    await resizeBy(
      page.locator(".editra-table-frame .editra-table-corner-handle"),
      80,
      24,
    );
    const cornerIncreased = await measureTable();
    if (
      cornerIncreased.width - cornerReduced.width < 65 ||
      cornerIncreased.height - cornerReduced.height < 14
    ) {
      throw new Error(
        `${browserName} ${theme}/${hostType} corner table increase failed: ${JSON.stringify({ cornerReduced, cornerIncreased })}`,
      );
    }

    const emojiFrame = page.locator(
      '.editra-emoji-frame[data-editra-media="emoji"]',
    ).first();
    const emojiBefore = await emojiFrame.boundingBox();
    await resizeBy(
      emojiFrame.locator(".editra-resize-se"),
      34,
      34,
    );
    const emojiAfter = await emojiFrame.boundingBox();
    if (
      !emojiBefore ||
      !emojiAfter ||
      emojiAfter.width - emojiBefore.width < 26 ||
      emojiAfter.height - emojiBefore.height < 26 ||
      Math.abs(emojiAfter.width - emojiAfter.height) > 2
    ) {
      throw new Error(
        `${browserName} ${theme}/${hostType} emoji resize failed: ${JSON.stringify({ emojiBefore, emojiAfter })}`,
      );
    }

    const barcodeBeforeKey = await page.locator(
      '.editra-media-frame[data-editra-media="barcode"]',
    ).first().getAttribute("style");
    await page.locator(
      '.editra-media-frame[data-editra-media="barcode"] > .editra-object-move-handle',
    ).first().click();
    await page.keyboard.press("Alt+Shift+ArrowDown");
    const barcodeAfterKey = await page.locator(
      '.editra-media-frame[data-editra-media="barcode"]',
    ).first().getAttribute("style");
    const keyboardMoved = barcodeBeforeKey !== barcodeAfterKey;
    if (!keyboardMoved) {
      throw new Error(
        `${browserName} ${theme}/${hostType} keyboard object movement failed.`,
      );
    }
    await page.evaluate(() => globalThis.movementTestEditor.destroy());
  }
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
          const failure = request.failure()?.errorText || "failed";
          if (
            request.resourceType() === "media" &&
            request.url().startsWith("blob:") &&
            /ERR_(?:ABORTED|FILE_NOT_FOUND)/.test(failure)
          ) {
            // Synthetic media blobs are intentionally revoked during editor
            // cleanup and page navigation. Edge reports that lifecycle as a
            // failed request even though insertion and cleanup are asserted.
            return;
          }
          requestFailures.push(
            `${request.resourceType()} ${request.url()}: ${failure}`,
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
        await page.evaluate(() => {
          globalThis.__docxOpenError = "";
          globalThis.demoEditor.editor.addEventListener(
            "editra:file-open-error",
            (event) => {
              globalThis.__docxOpenError = event.detail?.message || "Unknown import error";
            },
            { once: true },
          );
        });
        const fileChooserPromise = page.waitForEvent("filechooser");
        await page.evaluate(() => globalThis.demoEditor.executeCommand("open"));
        const fileChooser = await fileChooserPromise;
        await fileChooser.setFiles({
          name: "existing.docx",
          mimeType:
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          buffer: createDocx(),
        });
        await page.waitForFunction(
          () =>
            globalThis.demoEditor.getText().includes("Imported Word document") ||
            Boolean(globalThis.__docxOpenError),
        );
        const importedWord = await page.evaluate(() => ({
          html: globalThis.demoEditor.getCode(),
          text: globalThis.demoEditor.getText(),
          error: globalThis.__docxOpenError,
          state: {
            orientation: globalThis.demoEditor.state.orientation,
            pageCount: globalThis.demoEditor.state.pageCount,
            pageSize: globalThis.demoEditor.state.pageSize,
          },
          appearance: (() => {
            const walker = document.createTreeWalker(
              globalThis.demoEditor.editor,
              NodeFilter.SHOW_TEXT,
            );
            let node;
            while ((node = walker.nextNode())) {
              if (node.nodeValue.includes("Imported Word document")) break;
            }
            const run = node?.parentElement;
            const paragraph = run?.closest("p");
            const runStyle = run ? getComputedStyle(run) : null;
            return {
              color: runStyle?.color || "",
              fontSize: runStyle?.fontSize || "",
              fontWeight: runStyle?.fontWeight || "",
              textAlign: paragraph ? getComputedStyle(paragraph).textAlign : "",
            };
          })(),
          layoutFidelity: (() => {
            const paragraphs = [...globalThis.demoEditor.editor.querySelectorAll("p")];
            const paragraph = paragraphs.find((item) =>
              item.textContent.includes("Preserved"),
            );
            const preserved = paragraph?.querySelector('span[style*="white-space"]');
            const tab = paragraph?.querySelector('[data-editra-word-tab="true"]');
            const table = globalThis.demoEditor.editor.querySelector("table");
            const columns = table ? [...table.querySelectorAll("col")] : [];
            const paragraphStyle = paragraph ? getComputedStyle(paragraph) : null;
            const tableStyle = table ? getComputedStyle(table) : null;
            return {
              borderBottomWidth: paragraphStyle?.borderBottomWidth || "",
              fontFamily: paragraphStyle?.fontFamily || "",
              fontSize: paragraphStyle?.fontSize || "",
              marginBottom: paragraphStyle?.marginBottom || "",
              marginTop: paragraphStyle?.marginTop || "",
              preservedWhiteSpace: preserved
                ? getComputedStyle(preserved).whiteSpace
                : "",
              tableLayout: tableStyle?.tableLayout || "",
              tableWidth: tableStyle?.width || "",
              columnWidths: columns.map((column) => getComputedStyle(column).width),
              tabStop: tab?.dataset.editraTabStop || "",
              tabWidth: tab ? getComputedStyle(tab).width : "",
            };
          })(),
          pages: [...globalThis.demoEditor.editor.querySelectorAll(
            'section[data-editra-imported-document="docx"]',
          )].map((page) => {
            const style = getComputedStyle(page);
            return {
              height: style.minHeight,
              orientation: page.dataset.editraPageOrientation,
              paddingLeft: style.paddingLeft,
              paddingTop: style.paddingTop,
              width: style.width,
            };
          }),
        }));
        if (
          !importedWord.text.includes("Imported Word document") ||
          !importedWord.text.includes("1. First styled list item") ||
          importedWord.text.includes("[Content_Types].xml") ||
          importedWord.text.startsWith("PK") ||
          importedWord.appearance.color !== "rgb(31, 78, 120)" ||
          !["700", "bold"].includes(importedWord.appearance.fontWeight) ||
          importedWord.appearance.textAlign !== "center" ||
          importedWord.layoutFidelity.marginTop !== "0px" ||
          importedWord.layoutFidelity.marginBottom !== "0px" ||
          importedWord.layoutFidelity.borderBottomWidth !== "1px" ||
          !importedWord.layoutFidelity.fontFamily.includes("Verdana") ||
          importedWord.layoutFidelity.fontSize !== "13.3333px" ||
          importedWord.layoutFidelity.preservedWhiteSpace !== "pre-wrap" ||
          Number(importedWord.layoutFidelity.tabStop) !== 96 ||
          Number.parseFloat(importedWord.layoutFidelity.tabWidth) <= 1 ||
          importedWord.layoutFidelity.tableLayout !== "fixed" ||
          Math.abs(Number.parseFloat(importedWord.layoutFidelity.tableWidth) - 400) > 1 ||
          importedWord.layoutFidelity.columnWidths.length !== 2 ||
          Math.abs(Number.parseFloat(importedWord.layoutFidelity.columnWidths[0]) - 160) > 1 ||
          Math.abs(Number.parseFloat(importedWord.layoutFidelity.columnWidths[1]) - 240) > 1 ||
          importedWord.state.pageCount !== 2 ||
          importedWord.state.pageSize !== "Letter" ||
          importedWord.state.orientation !== "portrait" ||
          importedWord.pages.length !== 2 ||
          importedWord.pages.some(
            (page) =>
              page.width !== "816px" ||
              page.height !== "1056px" ||
              page.paddingTop !== "96px" ||
              page.paddingLeft !== "96px" ||
              page.orientation !== "portrait",
          )
        ) {
          throw new Error(
            `${name} DOCX open regression: ${JSON.stringify(importedWord)}`,
          );
        }
        const unsafeDocxError = await page.evaluate(async (bytes) => {
          try {
            await globalThis.demoEditor.executeCommand("importWord", {
              file: new File([new Uint8Array(bytes)], "macro.docx", {
                type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
              }),
            });
            return "";
          } catch (error) {
            return error.message;
          }
        }, [...createDocx({ "word/vbaProject.bin": "not-a-real-macro" })]);
        if (!unsafeDocxError.includes("Unsafe DOCX file blocked")) {
          throw new Error(
            `${name} unsafe DOCX scan regression: ${unsafeDocxError || "file was accepted"}`,
          );
        }
        const exportedWordAppearance = await page.evaluate(async () => {
          const result = await globalThis.demoEditor.executeCommand("exportHTML", {
            download: false,
            returnHTML: true,
          });
          return result;
        });
        if (
          exportedWordAppearance.pageCount !== 2 ||
          !exportedWordAppearance.html.includes("Imported Word document") ||
          !/color:\s*(?:rgb\(31,\s*78,\s*120\)|#1f4e78)/i.test(
            exportedWordAppearance.html,
          ) ||
          !/text-align:\s*center/i.test(exportedWordAppearance.html)
        ) {
          throw new Error(
            `${name} styled DOCX export regression: ${JSON.stringify({
              pageCount: exportedWordAppearance.pageCount,
              html: exportedWordAppearance.html.slice(0, 1200),
            })}`,
          );
        }
        const htmlImport = await page.evaluate(async () => {
          const safeFile = new File(
            [
              '<!doctype html><html><head><style>.report-card{color:#214f8b;background-color:#f1e7c8;border:3px solid #8b4513;padding:17px;text-align:right}.report-card strong{font-size:23px}</style></head><body><section class="report-card"><strong>Styled HTML import</strong></section></body></html>',
            ],
            "styled.html",
            { type: "text/html" },
          );
          await globalThis.demoEditor.executeCommand("importHTML", {
            file: safeFile,
          });
          await new Promise(requestAnimationFrame);
          const card = globalThis.demoEditor.editor.querySelector(".report-card");
          const strong = card?.querySelector("strong");
          const exported = await globalThis.demoEditor.executeCommand("exportHTML", {
            download: false,
            returnHTML: true,
          });
          let unsafeError = "";
          try {
            await globalThis.demoEditor.executeCommand("importHTML", {
              file: new File(
                ['<style>p{background:url(https://evil.invalid/x)}</style><script>alert(1)</script><p>Unsafe replacement</p>'],
                "unsafe.html",
                { type: "text/html" },
              ),
            });
          } catch (error) {
            unsafeError = error.message;
          }
          return {
            cardColor: card ? getComputedStyle(card).color : "",
            cardPadding: card ? getComputedStyle(card).paddingTop : "",
            cardTextAlign: card ? getComputedStyle(card).textAlign : "",
            strongSize: strong ? getComputedStyle(strong).fontSize : "",
            exportHTML: exported.html,
            unsafeError,
            retainedSafeContent:
              globalThis.demoEditor.getText().includes("Styled HTML import"),
          };
        });
        if (
          htmlImport.cardColor !== "rgb(33, 79, 139)" ||
          htmlImport.cardPadding !== "17px" ||
          htmlImport.cardTextAlign !== "right" ||
          htmlImport.strongSize !== "23px" ||
          !htmlImport.exportHTML.includes("Styled HTML import") ||
          !/padding(?:-top)?:\s*17px/i.test(htmlImport.exportHTML) ||
          !htmlImport.unsafeError.includes("Unsafe HTML file blocked") ||
          !htmlImport.retainedSafeContent
        ) {
          throw new Error(
            `${name} styled HTML import regression: ${JSON.stringify(htmlImport)}`,
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
        await verifyRealObjectMovement(page, name);
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
