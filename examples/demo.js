(function () {
  "use strict";

  const tableHTML = `
    <h2>Editable project table</h2>
    <p>Use the small upper-left square to select the complete table.</p>
    <table>
      <tbody>
        <tr><td>Feature</td><td>Status</td><td>Owner</td></tr>
        <tr><td>Page fidelity</td><td>Ready</td><td>Editra</td></tr>
        <tr><td>Premium theme</td><td>Ready</td><td>Editorial</td></tr>
      </tbody>
    </table>`;
  const flowingTableHTML = `
    <h2>Cross-page results</h2>
    <p data-editra-keep-with-next="true">The following table repeats its semantic header whenever export pagination creates another page.</p>
    <table id="flowing-results-table"
      data-editra-repeat-header="true"
      data-editra-allow-row-splitting="true"
      data-editra-keep-table-together="false">
      <thead><tr><th>Row</th><th>Pagination behavior</th><th>Status</th></tr></thead>
      <tbody>
        ${Array.from(
          { length: 36 },
          (_, index) =>
            `<tr><td>${index + 1}</td><td>Flowing table record ${index + 1}</td><td>${index % 3 ? "Ready" : "Reviewed"}</td></tr>`,
        ).join("")}
      </tbody>
    </table>`;
  const mediaHTML = `
    <h2>Media document</h2>
    <p>The image uses an embedded, dependency-free placeholder. Use the toolbar to choose a local file or URL.</p>
    <figure class="editra-media-frame" data-editra-media="image" style="width:520px;max-width:100%">
      <img alt="Editra image placeholder" width="520" height="220"
        src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw=="
        style="width:100%;height:220px;background:linear-gradient(135deg,#172033,#2b78d4)">
    </figure>
    <p>A video element is ready for a local or permitted remote source.</p>
    <figure class="editra-media-frame" data-editra-media="video" style="width:520px;height:292px;max-width:100%">
      <video controls aria-label="Video placeholder" style="background:#111;width:100%;height:100%"></video>
    </figure>`;
  const multipageHTML = `
    <h1>Editra multipage report</h1>
    <p>This first page combines headings, paragraphs, and document structure.</p>
    ${tableHTML}
    <div class="editra-page-break"></div>
    <h2>Media page</h2>
    ${mediaHTML}
    <div class="editra-page-break"></div>
    <h2>Closing page</h2>
    <p>Headers, footers, margins, and explicit page boundaries are retained by page-fidelity exports.</p>`;

  const definitions = {
    full: {
      title: "Full Editra",
      description: "All default plugins, menus, toolbar controls, page tools, flow rules, and export commands.",
      config: {
        pagination: {
          keepParagraphsTogether: false,
          keepListItemsTogether: true,
          allowRowSplitting: true,
          keepCodeBlocksTogether: true,
        },
      },
      content: "<h1 data-editra-keep-with-next='true'>Complete editing experience</h1><p>Select text, explore every menu, insert content, and switch pagination rules.</p>" + tableHTML,
    },
    "hidden-menu": {
      title: "Hidden Menu",
      description: "A focused editor with the top menu completely disabled.",
      config: { showMenuBar: false, toolbar: "bold italic underline | undo redo" },
      content: "<h2>Distraction-free editing</h2><p>The toolbar remains available while the menu bar is hidden.</p>",
    },
    "custom-tools": {
      title: "Custom Toolbar",
      description: "Only explicitly listed tools and menus are rendered.",
      config: {
        toolbar: "bold italic underline | fontFamily fontSize | insertTable insertImage | undo redo",
        menu: { File: ["Save", "Export HTML"], Edit: ["Undo", "Redo"], Insert: ["Table", "Image"] },
      },
      content: "<h2>Curated controls</h2><p>This configuration demonstrates feature-level UI governance.</p>",
    },
    "sized-editor": {
      title: "Custom Editor Size",
      description: "A custom 720 Ã— 900 pixel document page.",
      config: { editorWidth: "720px", editorHeight: "900px" },
      content: "<h2>Custom page dimensions</h2><p>Dimensions are preserved by HTML, Word, and PDF export.</p>",
    },
    media: {
      title: "Image and Video",
      description: "Resizable image and video blocks that move intact when they do not fit on the current page.",
      config: { plugins: ["image", "video"] },
      preload: ["image", "video"],
      content: "<p>Extra lead-in content demonstrates page-aware media movement.</p>".repeat(12) + mediaHTML,
    },
    multipage: {
      title: "Multipage Document",
      description: "Multiple explicit pages containing text, a table, image, and video.",
      config: {
        header: { text: "Editra Report", dateTime: true },
        footer: { pageNumber: "Page {{page}} of {{pages}}" },
      },
      preload: ["table", "image", "video"],
      content: multipageHTML + flowingTableHTML,
    },
    "header-footer": {
      title: "Headers and Footers",
      description: "Repeated text, current date/time, custom fields, and page numbering.",
      config: {
        header: { text: "Editra Document", dateTime: true, fields: { Department: "Editorial" } },
        footer: { pageNumber: "Page {{page}} of {{pages}}" },
      },
      content: "<h1>Header and footer fidelity</h1><p>Export this document to verify repeated page content.</p><div class='editra-page-break'></div><h2>Second page</h2><p>The header and footer repeat here.</p>",
    },
    "page-sizes": {
      title: "Page Sizes and Orientation",
      description: "Choose standard A4, Letter, Legal, or landscape page layout.",
      config: { pageSize: "A4", orientation: "portrait" },
      actions: [
        ["A4 Portrait", "setPageSize", { size: "A4", orientation: "portrait" }],
        ["Letter Portrait", "setPageSize", { size: "Letter", orientation: "portrait" }],
        ["Legal Portrait", "setPageSize", { size: "Legal", orientation: "portrait" }],
        ["A4 Landscape", "setPageSize", { size: "A4", orientation: "landscape" }],
      ],
      content: "<h1>Page setup</h1><p>Use the buttons above or Layout menu to change size and orientation.</p>",
    },
    "custom-print": {
      title: "Content-only Printing",
      description: "Print only the vertical area covered by document content.",
      config: { printContentOnly: true },
      actions: [["Print text area", "printContentOnly"]],
      content: "<h1>Compact print area</h1><p>The print page is cropped after this content instead of including unused document height.</p>",
    },
    tables: {
      title: "Table Selection and Deletion",
      description: "Compare row splitting, rows kept together, repeated headers, and complete-table flow.",
      config: { plugins: ["table"] },
      preload: ["table"],
      actions: [
        ["Allow row splitting", "setTablePagination", { selector: "#flowing-results-table", allowRowSplitting: true, keepRowsTogether: false }],
        ["Keep rows together", "setTablePagination", { selector: "#flowing-results-table", allowRowSplitting: false, keepRowsTogether: true }],
        ["Keep table together", "setTablePagination", { selector: "#flowing-results-table", keepTableTogether: true }],
        ["Allow table to flow", "setTablePagination", { selector: "#flowing-results-table", keepTableTogether: false }],
        ["Select table", "selectTable"],
        ["Delete selected table", "deleteTable"],
      ],
      content: flowingTableHTML,
    },
    shortcuts: {
      title: "Keyboard Shortcuts",
      description: "Try Ctrl/Cmd+B, I, U, Z, Y, S, A, F, K, P, and table Tab navigation.",
      config: { plugins: ["bold", "italic", "underline", "table"], toolbar: "bold italic underline | undo redo" },
      preload: ["table"],
      content: "<h2>Shortcut practice</h2><p>Select this sentence and try formatting shortcuts. Use Ctrl/Cmd+S to save.</p>" + tableHTML,
    },
    minimal: {
      title: "Minimal Editra",
      description: "Three formatting plugins, no menu, and a compact toolbar.",
      config: { plugins: ["bold", "italic", "underline"], showMenuBar: false, toolbar: "bold italic underline" },
      content: "<p>A minimal integration can still provide familiar rich-text formatting.</p>",
    },
    "premium-ui": {
      title: "Premium UI",
      description: "Formal borders, Word-like typography, responsive toolbar wrapping, and premium menus.",
      actions: [["Toggle theme", "toggleTheme"], ["Show ruler", "toggleRuler"]],
      content: "<h1>Premium document surface</h1><p>Resize the browser to observe toolbar wrapping without horizontal scrolling.</p>",
    },
    help: {
      title: "Help",
      description: "Frequently used support links and troubleshooting guidance.",
      config: { showMenuBar: false, toolbar: "bold italic | undo redo" },
      content: "<h1>Editra Help</h1><p>See <a href='../docs/HELP.md'>HELP.md</a> for FAQs, errors, keyboard shortcuts, and support information.</p>",
    },
    about: {
      title: "About Editra",
      description: "Project ownership, goals, technology, author, and MIT licensing.",
      config: { showMenuBar: false, toolbar: "bold italic | undo redo" },
      content: "<h1>About Editra</h1><p>Editra is a standalone, MIT-licensed WYSIWYG editor. Release metadata is maintained centrally.</p><p><a href='../docs/ABOUT.md'>Read project details</a></p>",
    },
    bold: {
      title: "Bold",
      description: "Apply semantic bold formatting from the toolbar or Ctrl/Cmd+B.",
      config: { plugins: ["bold"], showMenuBar: false, toolbar: "bold undo redo" },
      content: "<p>Select this text and apply bold emphasis.</p>",
    },
    italic: {
      title: "Italic",
      description: "Apply italic emphasis from the toolbar or Ctrl/Cmd+I.",
      config: { plugins: ["italic"], showMenuBar: false, toolbar: "italic undo redo" },
      content: "<p>Select this text and apply italic emphasis.</p>",
    },
    underline: {
      title: "Underline",
      description: "Underline selected text from the toolbar or Ctrl/Cmd+U.",
      config: { plugins: ["underline"], showMenuBar: false, toolbar: "underline undo redo" },
      content: "<p>Select this text and apply an underline.</p>",
    },
    ruler: {
      title: "Document Ruler",
      description: "Drag margins and indents; click to add and double-click to remove tab stops.",
      config: { plugins: ["ruler", "margins"] },
      preload: ["ruler"],
      actions: [["Show/hide ruler", "toggleRuler"], ["Add 180px tab", "setTabStop", { position: 180 }]],
      content: "<h2>Ruler layout</h2><p>Drag each marker and watch the page layout update immediately.</p>",
    },
    margins: {
      title: "Page Margins",
      description: "Apply four-sided margin presets or adjust horizontal margins with the ruler.",
      config: { margins: { top: 72, right: 72, bottom: 72, left: 72 } },
      actions: [
        ["Normal", "setMargin", "normal"],
        ["Narrow", "setMargin", "narrow"],
        ["Wide", "setMargin", "wide"],
        ["Show ruler", "toggleRuler"],
      ],
      content: "<h2>Margin controls</h2><p>Margins are reflected in saved and exported documents.</p>",
    },
    export: {
      title: "Export",
      description: "Generate fixed-page HTML, Word-compatible HTML, PDF print output, or Markdown.",
      actions: [
        ["Save HTML", "exportHTML"],
        ["Export Word", "exportWord"],
        ["Export PDF", "exportPDF"],
        ["Export Markdown", "exportMarkdown"],
      ],
      content: "<h1>Export fidelity</h1><p>Page dimensions, margins, headers, footers, tables, and media are serialized.</p>",
    },
    theme: {
      title: "Theme Toggle",
      description: "Switch menus, toolbar, dialogs, ruler, workspace, and page surface between light and dark.",
      config: { colorScheme: "light" },
      actions: [
        ["Toggle", "toggleTheme"],
        ["Light", "setTheme", "light"],
        ["Dark", "setTheme", "dark"],
        ["System", "setTheme", "system"],
      ],
      content: "<h1>Theme consistency</h1><p>Open menus and dialogs while switching modes to verify contrast.</p>",
    },
    image: {
      title: "Image Plugin",
      description: "Insert images from local files, clipboard data, or URLs and resize them.",
      config: { plugins: ["image"] },
      content: mediaHTML.split("<p>A video")[0],
    },
    video: {
      title: "Video Plugin",
      description: "Insert local or permitted remote videos with inline playback and resizing.",
      config: { plugins: ["video"] },
      content: "<h2>Video insertion</h2><p>Use the video toolbar button to select a local file or enter a URL.</p><video controls style='width:520px;max-width:100%;height:292px;background:#111'></video>",
    },
    formatting: {
      title: "Core Formatting",
      description: "Fonts, colors, highlight, sup/subscript, block quotes, alignment, line height, and Format Painter.",
      config: {
        plugins: ["formatting", "fonts", "headings", "productivity"],
        toolbar: "fontFamily fontSize foreColor backgroundColor highlighter | strikethrough superscript subscript blockQuote formatPainter | alignment lineHeight | undo redo",
      },
      content: "<h2>Formatting controls</h2><p>Select this text and combine font, color, highlight, strikethrough, superscript, subscript, block quote, alignment, spacing, and Format Painter.</p>",
    },
    headings: {
      title: "Semantic Headings",
      description: "Convert document blocks to paragraph or semantic H1â€“H6 elements.",
      config: { plugins: ["headings"], toolbar: "heading undo redo" },
      content: "<p>Select this paragraph and choose a heading level.</p><h2>Existing heading</h2>",
    },
    lists: {
      title: "Lists",
      description: "Styled bullet and number lists, multilevel lists, TODO items, and indentation.",
      config: {
        plugins: ["lists"],
        toolbar: "bulletList numberList multilevelList todoList decreaseIndent increaseIndent | undo redo",
        menu: { Format: ["Bullet List", "Number List", "Multilevel List", "TODO List", "Decrease Indent", "Increase Indent"] },
      },
      content: "<h2>List editing</h2><p>Select these lines and choose a list style.</p><p>First item<br>Second item<br>Third item</p>",
    },
    structure: {
      title: "Document Structure",
      description: "Emoji, categorized symbols, date/time, codes, page breaks, headings, and table of contents.",
      config: {
        plugins: ["structure", "headings", "codes"],
        toolbar: "emoji specialCharacters dateTime insertBarcode insertQrCode | codeBlock horizontalLine pageBreak toc | heading undo redo",
      },
      content: "<h1>Structure demo</h1><h2>Section one</h2><p>Use the purpose-built toolbar and Insert menu to add characters, dates, codes, and structural elements.</p>",
    },
    "code-view": {
      title: "HTML Code View",
      description: "Compare code blocks that stay together with code blocks allowed to split, then inspect their HTML.",
      config: { plugins: ["codeview"], toolbar: "codeview undo redo" },
      actions: [
        ["Keep first code block together", "setCodeBlockSplitting", { selector: "#kept-code", allowSplitting: false }],
        ["Allow second code block to split", "setCodeBlockSplitting", { selector: "#split-code", allowSplitting: true }],
        ["Toggle code view", "toggleCodeView"],
      ],
      content: "<h2>Code pagination</h2><pre id='kept-code' data-editra-allow-splitting='false'><code>// This code block stays together.\\nfunction renderDocument() {\\n  return Editra.init({ selector: '#editor' });\\n}</code></pre><pre id='split-code' data-editra-allow-splitting='true'><code>// This longer code block may split across pages.\\nconst pages = document.querySelectorAll('.editra-page-guide');\\npages.forEach((page, index) => console.log(index + 1));</code></pre>",
    },
    productivity: {
      title: "Productivity Tools",
      description: "Find/replace, format painter, merge fields, preview, import, and export.",
      config: { plugins: ["productivity"] },
      actions: [["Find/replace", "findReplace"], ["Insert merge field", "insertMergeField"], ["Preview fields", "previewMergeFields"]],
      content: "<h2>Productivity</h2><p>Find this word and replace this word. Customer: {{Name}}</p>",
    },
    collaboration: {
      title: "Collaboration Features",
      description: "Track changes, comments, revision history, and application-provided co-authoring transport.",
      config: { plugins: ["collaboration"] },
      actions: [["Track changes", "trackChanges"], ["Add comment", "addComment"], ["Revision history", "viewRevisionHistory"]],
      content: "<h2>Collaborative review</h2><p>Select this sentence before adding a comment.</p>",
    },
    paste: {
      title: "Paste Handling",
      description: "Preserve raw HTML by default or sanitize unsafe tags with configuration.",
      config: { plugins: ["paste"], sanitizePaste: true },
      content: "<h2>Safe paste</h2><p>Paste formatted HTML here. This demo removes unsafe script and iframe elements.</p>",
    },
    "feedback-form": {
      title: "Feedback Form",
      description: "A working form that stores Editra HTML and plain-text feedback in localStorage.",
      config: {
        showMenuBar: false,
        toolbar: "bold italic underline | fontFamily fontSize | bulletList numberList | undo redo",
      },
      content: "<p>Share formatted feedback here. Your content remains on this device after saving.</p>",
    },
    pagination: {
      title: "Pagination and Flow Control",
      description: "Toggle paragraph, list, table, code, forced-break, and keep-with-next behavior.",
      config: {
        pagination: {
          keepParagraphsTogether: false,
          keepListItemsTogether: false,
          allowRowSplitting: true,
          keepRowsTogether: false,
          keepTableTogether: false,
          keepCodeBlocksTogether: true,
          repeatTableHeader: true,
        },
      },
      actions: [
        ["Keep selected block together", "toggleKeepTogether", { selector: "#pagination-paragraph" }],
        ["Keep heading with next", "KeepWithNext", { selector: "#pagination-heading", enabled: true }],
        ["Keep list items together", "setListItemSplitting", { selector: "#pagination-list", allowSplitting: false }],
        ["Allow list item splitting", "setListItemSplitting", { selector: "#pagination-list", allowSplitting: true }],
        ["Keep table together", "setTablePagination", { selector: "#pagination-table", keepTableTogether: true }],
        ["Allow table splitting", "setTablePagination", { selector: "#pagination-table", keepTableTogether: false, allowRowSplitting: true }],
        ["Insert page break", "InsertPageBreak"],
      ],
      content: `
        <h1 id="pagination-heading">Page-aware flow</h1>
        <p id="pagination-paragraph">Use Keep Together to move this complete paragraph to the next page whenever the remaining space is too small. Toggle it again to allow normal paragraph flow.</p>
        <ol id="pagination-list">
          <li>List item one can be kept intact.</li>
          <li>List item two demonstrates configurable splitting.</li>
          <li>List item three remains editable.</li>
        </ol>
        <pre data-editra-allow-splitting="false"><code>const rules = { keepCodeBlocksTogether: true };</code></pre>
        <table id="pagination-table" data-editra-repeat-header="true" data-editra-allow-row-splitting="true">
          <thead><tr><th>Rule</th><th>Result</th></tr></thead>
          <tbody><tr><td>Repeat header</td><td>Enabled</td></tr><tr><td>Row splitting</td><td>Allowed</td></tr></tbody>
        </table>`,
    },
  };

  function addAction(actions, label, handler) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = label;
    button.addEventListener("click", handler);
    actions.append(button);
    return button;
  }

  function ensureCodeOutput(actions) {
    let panel = document.querySelector("[data-demo-code-output]");
    if (panel) return panel;
    panel = document.createElement("section");
    panel.className = "demo-output";
    panel.dataset.demoCodeOutput = "";
    panel.hidden = true;
    panel.innerHTML =
      "<header><strong>Editor HTML</strong><button type='button' data-close-output aria-label='Close output'>Close</button></header><pre tabindex='0'></pre>";
    panel.querySelector("[data-close-output]").addEventListener("click", () => {
      panel.hidden = true;
    });
    actions.insertAdjacentElement("afterend", panel);
    return panel;
  }

  function showCode(actions, editor, label) {
    const panel = ensureCodeOutput(actions);
    panel.querySelector("strong").textContent = label;
    panel.querySelector("pre").textContent = editor.getCode();
    panel.hidden = false;
    panel.querySelector("pre").focus();
  }

  function exportRawHTML(editor, name) {
    const html = editor.getCode();
    const documentHTML =
      `<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<title>Editra export</title>\n</head>\n<body>\n${html}\n</body>\n</html>\n`;
    const url = URL.createObjectURL(
      new Blob([documentHTML], { type: "text/html;charset=utf-8" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = `editra-${name}.html`;
    link.hidden = true;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  function bindFeedbackForm(editor) {
    const form = document.querySelector("[data-feedback-form]");
    if (!form) return;

    const storageKey = "editra.feedback.v1";
    const saved = document.querySelector("[data-feedback-saved]");
    const liveHTML = document.querySelector("[data-feedback-live-html]");
    const liveText = document.querySelector("[data-feedback-live-text]");

    const readEntries = () => {
      try {
        const value = JSON.parse(localStorage.getItem(storageKey) || "[]");
        return Array.isArray(value) ? value : [];
      } catch {
        return [];
      }
    };

    const showRecord = (record) => {
      if (!record) {
        saved.hidden = true;
        return;
      }
      saved.hidden = false;
      saved.querySelector("[data-saved-name]").textContent = record.name;
      saved.querySelector("[data-saved-gender]").textContent = record.gender;
      saved.querySelector("[data-saved-date]").textContent =
        new Date(record.savedAt).toLocaleString();
      saved.querySelector("[data-saved-html]").textContent = record.html;
      saved.querySelector("[data-saved-text]").textContent = record.text;
    };

    const updateLive = () => {
      liveHTML.textContent = editor.getCode();
      liveText.textContent = editor.getText();
    };

    const previousOnChange = editor.options.onChange;
    editor.options.onChange = (html, instance) => {
      previousOnChange?.(html, instance);
      updateLive();
    };
    form.addEventListener("input", updateLive);
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const data = new FormData(form);
      const record = {
        name: String(data.get("name") || "").trim(),
        gender: String(data.get("gender") || ""),
        html: editor.getCode(),
        text: editor.getText(),
        savedAt: new Date().toISOString(),
      };
      if (!record.name || !record.gender) {
        form.querySelector("[data-feedback-status]").textContent =
          "Enter a name and choose a gender before saving.";
        return;
      }
      const entries = readEntries();
      entries.unshift(record);
      try {
        localStorage.setItem(storageKey, JSON.stringify(entries.slice(0, 25)));
        form.querySelector("[data-feedback-status]").textContent =
          "Feedback saved locally.";
        showRecord(record);
      } catch (error) {
        form.querySelector("[data-feedback-status]").textContent =
          `Unable to save feedback: ${error.message}`;
      }
    });

    updateLive();
    showRecord(readEntries()[0]);
  }

  async function boot() {
    const name = document.body.dataset.editraDemo || "full";
    const definition = definitions[name] || definitions.full;
    document.title = `${definition.title} â€” Editra`;
    document.querySelector("[data-demo-title]").textContent = definition.title;
    document.querySelector("[data-demo-description]").textContent =
      definition.description;
    const host = document.querySelector("#editra-editor");
    host.innerHTML = definition.content;
    const editor = await Editra.init({
      selector: host,
      pagination: {},
      ...definition.config,
    });
    for (const plugin of definition.preload || []) {
      await editor.ensurePlugin(plugin);
    }
    editor.rehydrate();
    const actions = document.querySelector("[data-demo-actions]");
    addAction(actions, "Get Code", () =>
      showCode(actions, editor, "Current editor code"),
    );
    addAction(actions, "Get HTML", () => exportRawHTML(editor, name));
    addAction(actions, "Insert on Focus", () => {
      editor.insertNode(document.createTextNode("Inserted at cursor position."));
    });
    (definition.actions || []).forEach(([label, command, value]) => {
      addAction(actions, label, () =>
        value === undefined
          ? editor.executeCommand(command)
          : editor.executeCommand(command, value),
      );
    });
    actions.hidden = !actions.childElementCount;
    bindFeedbackForm(editor);
    globalThis.demoEditor = editor;
  }

  boot().catch((error) => {
    const note = document.querySelector("[data-demo-error]");
    note.hidden = false;
    note.textContent = `Demo initialization failed: ${error.message}`;
  });
})();
