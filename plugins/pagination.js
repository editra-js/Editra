/**
 * Page-flow rules and visual pagination for the Word editing surface.
 *
 * Layout measurement is animation-frame batched. Spacers used to preview page
 * boundaries are editor-only elements and are excluded from serialized output.
 */
(function (global) {
  "use strict";

  const installations = new WeakMap();
  const DEFAULT_RULES = Object.freeze({
    keepParagraphsTogether: false,
    keepListItemsTogether: false,
    allowRowSplitting: true,
    keepRowsTogether: false,
    keepTableTogether: false,
    keepCodeBlocksTogether: true,
    repeatTableHeader: true,
  });
  const INDIVISIBLE_SELECTOR = [
    "img",
    "video",
    "iframe",
    "canvas",
    "svg",
    "form",
    "object",
    "embed",
    "figure",
    ".editra-media-frame",
    "[data-editra-chart]",
    "[data-editra-graph]",
    "[data-editra-embedded]",
  ].join(",");

  const nextFrame = () =>
    new Promise((resolve) => requestAnimationFrame(resolve));

  /** Returns a supplied boolean or preserves the previous rule value. */
  function booleanValue(value, fallback) {
    return typeof value === "boolean" ? value : fallback;
  }

  /** Merges a partial pagination update with the current effective rules. */
  function normalizeRules(value = {}, previous = DEFAULT_RULES) {
    const options = value && typeof value === "object" ? value : {};
    return {
      keepParagraphsTogether: booleanValue(
        options.keepParagraphsTogether,
        previous.keepParagraphsTogether,
      ),
      keepListItemsTogether: booleanValue(
        options.keepListItemsTogether,
        previous.keepListItemsTogether,
      ),
      allowRowSplitting: booleanValue(
        options.allowRowSplitting,
        previous.allowRowSplitting,
      ),
      keepRowsTogether: booleanValue(
        options.keepRowsTogether,
        previous.keepRowsTogether,
      ),
      keepTableTogether: booleanValue(
        options.keepTableTogether,
        previous.keepTableTogether,
      ),
      keepCodeBlocksTogether: booleanValue(
        options.keepCodeBlocksTogether,
        previous.keepCodeBlocksTogether,
      ),
      repeatTableHeader: booleanValue(
        options.repeatTableHeader,
        previous.repeatTableHeader,
      ),
    };
  }

  /** Resolves the selected matching element with an optional first-item fallback. */
  function currentElement(core, selector, options = {}) {
    if (options?.selector) {
      const selected = core.editor.querySelector(options.selector);
      if (selected?.matches(selector)) return selected;
      const nested = selected?.querySelector(selector);
      if (nested) return nested;
    }
    core.restoreSelection();
    const selection = global.getSelection();
    const node = selection?.rangeCount
      ? selection.getRangeAt(0).commonAncestorContainer
      : null;
    const element =
      node?.nodeType === Node.ELEMENT_NODE ? node : node?.parentElement;
    const match = element?.closest(selector);
    if (match && core.editor.contains(match)) return match;
    return options?.fallbackToFirst === false
      ? null
      : core.editor.querySelector(selector);
  }

  /** Resolves the top-level document block containing the current selection. */
  function directBlock(core, options = {}) {
    let element = currentElement(
      core,
      "p,h1,h2,h3,h4,h5,h6,li,pre,blockquote,table,figure,form,div,section,article",
      { ...options, fallbackToFirst: false },
    );
    while (element?.parentElement && element.parentElement !== core.editor) {
      element = element.parentElement;
    }
    return element?.parentElement === core.editor ? element : null;
  }

  /** Stores a pagination flag only when the target element exists. */
  function setBooleanAttribute(element, name, enabled) {
    if (!element) return false;
    if (enabled) element.setAttribute(name, "true");
    else element.removeAttribute(name);
    return element;
  }

  /** Mirrors effective pagination rules to CSS-readable data attributes. */
  function applyRuleAttributes(core, state) {
    const rules = state.rules;
    core.editor.classList.add("editra-pagination-enabled");
    core.editor.dataset.editraKeepParagraphs =
      String(rules.keepParagraphsTogether);
    core.editor.dataset.editraKeepListItems =
      String(rules.keepListItemsTogether);
    core.editor.dataset.editraKeepCodeBlocks =
      String(rules.keepCodeBlocksTogether);
    core.editor
      .querySelectorAll(INDIVISIBLE_SELECTOR)
      .forEach((element) =>
        element.setAttribute("data-editra-indivisible", "true"),
      );
    core.editor.querySelectorAll("table").forEach((table) => {
      if (!table.hasAttribute("data-editra-allow-row-splitting")) {
        table.dataset.editraAllowRowSplitting =
          String(rules.allowRowSplitting);
      }
      if (!table.hasAttribute("data-editra-keep-rows-together")) {
        table.dataset.editraKeepRowsTogether =
          String(rules.keepRowsTogether);
      }
      if (!table.hasAttribute("data-editra-keep-table-together")) {
        table.dataset.editraKeepTableTogether =
          String(rules.keepTableTogether);
      }
      if (!table.hasAttribute("data-editra-repeat-header")) {
        table.dataset.editraRepeatHeader = String(rules.repeatTableHeader);
      }
    });
  }

  /** Reports whether a block should move intact when it fits on one page. */
  function isKeptBlock(block, rules) {
    if (!block || block.dataset.editraKeepTogether === "false") return false;
    if (
      block.dataset.editraKeepTogether === "true" ||
      block.matches(INDIVISIBLE_SELECTOR) ||
      block.querySelector(`:scope > ${INDIVISIBLE_SELECTOR}`)
    ) {
      return true;
    }
    if (block.matches("p") && rules.keepParagraphsTogether) return true;
    if (block.matches("pre,.editra-code-block")) {
      return rules.keepCodeBlocksTogether;
    }
    if (block.matches("table,.editra-table-frame")) {
      const table = block.matches("table") ? block : block.querySelector("table");
      return table?.dataset.editraKeepTableTogether === "true";
    }
    return false;
  }

  /** Creates a non-persistent spacer that moves content to a page boundary. */
  function makeSpacer(height, kind) {
    const spacer = document.createElement("div");
    spacer.className = "editra-pagination-spacer";
    spacer.dataset.editraUi = "true";
    spacer.dataset.editraFlowSpacer = kind;
    spacer.contentEditable = "false";
    spacer.setAttribute("aria-hidden", "true");
    spacer.style.height = `${Math.max(0, Math.ceil(height))}px`;
    return spacer;
  }

  /** Calculates usable page height after top and bottom margins. */
  function pageFlowMetrics(core, pageHeight) {
    const style = getComputedStyle(core.editor);
    const paddingTop = Number.parseFloat(style.paddingTop) || 0;
    const paddingBottom = Number.parseFloat(style.paddingBottom) || 0;
    return {
      paddingTop,
      paddingBottom,
      contentHeight: Math.max(1, pageHeight - paddingTop - paddingBottom),
    };
  }

  /** Maps a vertical document position to its page content boundaries. */
  function flowPosition(top, pageHeight, metrics) {
    const page = Math.max(0, Math.floor(top / pageHeight));
    return {
      page,
      contentStart: page * pageHeight + metrics.paddingTop,
      contentEnd: (page + 1) * pageHeight - metrics.paddingBottom,
      nextContentStart: (page + 1) * pageHeight + metrics.paddingTop,
    };
  }

  /** Detects short text blocks that must not remain inside a page margin. */
  function isSingleLineBlock(block, height) {
    if (block.matches("table,ul,ol,pre,blockquote,figure,form,section,article")) {
      return false;
    }
    const lineHeight = Number.parseFloat(getComputedStyle(block).lineHeight);
    return Number.isFinite(lineHeight) && height <= lineHeight * 1.5;
  }

  /**
   * Adds visual copies of a table header where body rows enter a new page.
   * Copies are marked as editor UI so persistence and export never duplicate
   * the semantic `thead` stored in the document.
   */
  async function repeatTableHeaders(
    core,
    state,
    pageHeight,
    editorTop,
    generation,
  ) {
    core.editor
      .querySelectorAll("[data-editra-repeated-header]")
      .forEach((row) => row.remove());
    const tables = [...core.editor.querySelectorAll(
      'table[data-editra-repeat-header="true"]',
    )];
    let processed = 0;
    for (const table of tables) {
      const headerRows = [...(table.tHead?.rows ?? [])];
      const rows = [...table.tBodies].flatMap((body) => [...body.rows]);
      if (!headerRows.length || !rows.length) continue;
      let previousPage = Math.floor(
        Math.max(0, rows[0].getBoundingClientRect().top - editorTop) /
          pageHeight,
      );
      for (const row of rows.slice(1)) {
        if (generation !== state.generation || core.destroyed) return false;
        const page = Math.floor(
          Math.max(0, row.getBoundingClientRect().top - editorTop) /
            pageHeight,
        );
        if (page > previousPage) {
          const fragment = document.createDocumentFragment();
          headerRows.forEach((headerRow) => {
            const repeat = headerRow.cloneNode(true);
            repeat.classList.add("editra-repeated-table-header");
            repeat.dataset.editraRepeatedHeader = "true";
            repeat.dataset.editraUi = "true";
            repeat.contentEditable = "false";
            fragment.append(repeat);
          });
          row.before(fragment);
        }
        previousPage = page;
        processed += 1;
        if (processed % 100 === 0) await nextFrame();
      }
    }
    return true;
  }

  /**
   * Recomputes visual page flow using temporary spacer elements.
   * A generation number cancels stale measurements when content changes again
   * before an earlier asynchronous pass has completed.
   */
  async function reflow(core, state) {
    const generation = ++state.generation;
    state.reflowing = true;
    core.editor
      .querySelectorAll(":scope > .editra-pagination-spacer")
      .forEach((spacer) => spacer.remove());
    applyRuleAttributes(core, state);
    if (core.options.theme === "Classic") {
      state.reflowing = false;
      core.refreshPageLayout();
      return true;
    }
    await nextFrame();
    if (generation !== state.generation || core.destroyed) return false;

    const pageHeight = core.resolveEditorPixels(
      core.options.editorHeight,
      "1056px",
    );
    const flowMetrics = pageFlowMetrics(core, pageHeight);
    const editorTop = core.editor.getBoundingClientRect().top;
    await repeatTableHeaders(
      core,
      state,
      pageHeight,
      editorTop,
      generation,
    );
    if (generation !== state.generation || core.destroyed) return false;
    const blocks = [...core.editor.children].filter(
      (block) =>
        !block.matches(
          "[data-editra-ui],[data-editra-document-part],.editra-pagination-spacer",
        ),
    );

    // Measure in chunks to keep large documents responsive. Each chunk yields
    // before continuing, and a newer generation can cancel the remaining work.
    for (let start = 0; start < blocks.length; start += 60) {
      const chunk = blocks.slice(start, start + 60);
      for (const block of chunk) {
        if (generation !== state.generation || core.destroyed) return false;
        const top =
          block.getBoundingClientRect().top - editorTop + core.editor.scrollTop;
        const position = flowPosition(top, pageHeight, flowMetrics);
        const ownHeight = block.getBoundingClientRect().height;

        if (block.classList.contains("editra-page-break")) {
          const spacerHeight = position.nextContentStart - top;
          if (spacerHeight > 2) {
            block.before(makeSpacer(spacerHeight, "forced"));
          }
          continue;
        }

        // Every page has its own top and bottom margin. A short line created by
        // pressing Enter must never remain in that non-editable margin band.
        const startsInMargin =
          position.page > 0 && top < position.contentStart - 1;
        const crossesBottomMargin =
          top < position.contentEnd &&
          top + ownHeight > position.contentEnd + 1 &&
          isSingleLineBlock(block, ownHeight);
        const startsAfterContent = top >= position.contentEnd - 1;
        if (startsInMargin || crossesBottomMargin || startsAfterContent) {
          const destination = startsInMargin
            ? position.contentStart
            : position.nextContentStart;
          block.before(makeSpacer(destination - top, "automatic-flow"));
          continue;
        }

        const remaining = position.contentEnd - top;

        const next = block.nextElementSibling;
        const groupHeight =
          block.dataset.editraKeepWithNext === "true" && next
            ? ownHeight + next.getBoundingClientRect().height
            : ownHeight;
        const shouldKeep =
          isKeptBlock(block, state.rules) ||
          block.dataset.editraKeepWithNext === "true";
        block.classList.toggle(
          "is-editra-oversize-block",
          shouldKeep && groupHeight > flowMetrics.contentHeight,
        );
        if (
          shouldKeep &&
          groupHeight <= flowMetrics.contentHeight &&
          groupHeight > remaining + 1 &&
          remaining > 2
        ) {
          block.before(
            makeSpacer(position.nextContentStart - top, "automatic"),
          );
        }
      }
      if (start + 60 < blocks.length) await nextFrame();
    }

    core.pageGuideSignature = "";
    core.refreshPageLayout();
    state.reflowing = false;
    return true;
  }

  /** Schedules one deduplicated pagination pass on the next animation frame. */
  function scheduleReflow(core, state) {
    core.scheduleUpdate("pagination-reflow", () => {
      reflow(core, state).catch(() => {
        state.reflowing = false;
      });
    });
    return true;
  }

  /** Records rule changes, emits content updates, and schedules reflow. */
  function commit(core, state) {
    core.recordHistory();
    core.state.pagination = { ...state.rules };
    core.scheduleUpdate("pagination-change", () => {
      core.emitChange();
      core.emitState();
      scheduleReflow(core, state);
    });
    return true;
  }

  /** Applies a partial set of document-wide pagination rules. */
  function setPaginationRules(core, state, options = {}) {
    state.rules = normalizeRules(options, state.rules);
    core.options.pagination = { ...state.rules };
    applyRuleAttributes(core, state);
    commit(core, state);
    return { ...state.rules };
  }

  /** Sets keep-together behavior on the selected top-level block. */
  function setKeepTogether(core, state, value = true) {
    const options = value && typeof value === "object" ? value : {};
    const block = directBlock(core, options);
    const enabled =
      typeof value === "boolean"
        ? value
        : booleanValue(options.enabled, true);
    if (!setBooleanAttribute(block, "data-editra-keep-together", enabled)) {
      return false;
    }
    commit(core, state);
    return block;
  }

  /** Toggles keep-together behavior on the selected block. */
  function toggleKeepTogether(core, state, options = {}) {
    const block = directBlock(core, options);
    if (!block) return false;
    return setKeepTogether(core, state, {
      ...options,
      enabled: block.dataset.editraKeepTogether !== "true",
    });
  }

  /** Keeps the selected block with its following sibling when both fit. */
  function keepWithNext(core, state, options = {}) {
    const block = directBlock(core, options);
    if (!block) return false;
    const enabled =
      typeof options === "boolean"
        ? options
        : booleanValue(
            options.enabled,
            block.dataset.editraKeepWithNext !== "true",
          );
    setBooleanAttribute(block, "data-editra-keep-with-next", enabled);
    commit(core, state);
    return block;
  }

  /** Controls whether list items may split across physical pages. */
  function setListItemSplitting(core, state, options = {}) {
    const list = currentElement(core, "ul,ol", options);
    if (!list) return false;
    const allowSplitting = booleanValue(
      typeof options === "boolean" ? options : options.allowSplitting,
      true,
    );
    list.dataset.editraAllowItemSplitting = String(allowSplitting);
    commit(core, state);
    return list;
  }

  /** Applies table, row-splitting, and repeated-header pagination settings. */
  function setTablePagination(core, state, options = {}) {
    const table = currentElement(core, "table", options);
    if (!table) return false;
    const allowRowSplitting = booleanValue(
      options.allowRowSplitting,
      table.dataset.editraAllowRowSplitting !== "false",
    );
    table.dataset.editraAllowRowSplitting = String(allowRowSplitting);
    table.dataset.editraKeepRowsTogether = String(
      booleanValue(options.keepRowsTogether, !allowRowSplitting),
    );
    table.dataset.editraKeepTableTogether = String(
      booleanValue(
        options.keepTableTogether,
        table.dataset.editraKeepTableTogether === "true",
      ),
    );
    table.dataset.editraRepeatHeader = String(
      booleanValue(
        options.repeatHeader,
        table.dataset.editraRepeatHeader !== "false",
      ),
    );
    commit(core, state);
    return table;
  }

  /** Controls whether the selected code block may split across pages. */
  function setCodeBlockSplitting(core, state, options = {}) {
    const block = currentElement(core, "pre,.editra-code-block", options);
    if (!block) return false;
    const allowSplitting = booleanValue(
      typeof options === "boolean" ? options : options.allowSplitting,
      true,
    );
    block.dataset.editraAllowSplitting = String(allowSplitting);
    setBooleanAttribute(
      block,
      "data-editra-keep-together",
      !allowSplitting,
    );
    commit(core, state);
    return block;
  }

  /** Inserts an explicit page break and immediately schedules new page flow. */
  function insertPageBreak(core, state) {
    const pageBreak = document.createElement("div");
    pageBreak.className = "editra-page-break";
    pageBreak.contentEditable = "false";
    pageBreak.setAttribute("role", "separator");
    pageBreak.setAttribute("aria-label", "Page break");
    const block = directBlock(core, { fallbackToFirst: false });
    const paragraph = document.createElement("p");
    paragraph.append(document.createElement("br"));
    if (block) block.after(pageBreak, paragraph);
    else core.editor.append(pageBreak, paragraph);
    const range = document.createRange();
    range.selectNodeContents(paragraph);
    range.collapse(true);
    const selection = global.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
    core.selection = range.cloneRange();
    commit(core, state);
    return pageBreak;
  }

  /** Measures repeated pagination changes for regression and performance tests. */
  async function paginationStressTest(core, state, options = {}) {
    const blocks = Math.max(100, Number(options.blocks) || 1000);
    const startedAt = performance.now();
    const container = document.createElement("div");
    for (let start = 0; start < blocks; start += 250) {
      const fragment = document.createDocumentFragment();
      for (
        let index = start;
        index < Math.min(start + 250, blocks);
        index += 1
      ) {
        const paragraph = document.createElement("p");
        paragraph.textContent = `Pagination stress block ${index + 1}`;
        if (index % 10 === 0) {
          paragraph.dataset.editraKeepTogether = "true";
        }
        fragment.append(paragraph);
      }
      container.append(fragment);
      if (start + 250 < blocks) await nextFrame();
    }
    return {
      blocks,
      htmlBytes: new Blob([container.innerHTML]).size,
      durationMs: Math.round(performance.now() - startedAt),
      rules: { ...state.rules },
    };
  }

  /** Installs pagination commands and cleanup once per editor instance. */
  function install(core) {
    if (installations.has(core)) return installations.get(core);
    const state = {
      rules: normalizeRules(core.options.pagination, DEFAULT_RULES),
      generation: 0,
      reflowing: false,
      unregisterCommands: [],
      observer: null,
    };
    const commands = {
      setPaginationRules: (options) =>
        setPaginationRules(core, state, options),
      toggleKeepTogether: (options) =>
        toggleKeepTogether(core, state, options),
      setKeepTogether: (value) => setKeepTogether(core, state, value),
      setListItemSplitting: (options) =>
        setListItemSplitting(core, state, options),
      setTablePagination: (options) =>
        setTablePagination(core, state, options),
      setCodeBlockSplitting: (options) =>
        setCodeBlockSplitting(core, state, options),
      KeepWithNext: (options) => keepWithNext(core, state, options),
      keepWithNext: (options) => keepWithNext(core, state, options),
      InsertPageBreak: () => insertPageBreak(core, state),
      reflowPagination: () => scheduleReflow(core, state),
      paginationStressTest: (options) =>
        paginationStressTest(core, state, options),
    };
    Object.entries(commands).forEach(([name, handler]) => {
      state.unregisterCommands.push(
        core.registerCommand(name, handler, {
          plugin: "pagination",
          source: "plugin",
        }),
      );
    });

    const requestReflow = () => {
      if (!state.reflowing) scheduleReflow(core, state);
    };
    core.editor.addEventListener("input", requestReflow);
    core.editor.addEventListener("editra:pageChange", requestReflow);
    state.observer = new MutationObserver((mutations) => {
      if (state.reflowing) return;
      const meaningful = mutations.some((mutation) =>
        [...mutation.addedNodes, ...mutation.removedNodes].some(
          (node) =>
            node.nodeType !== Node.ELEMENT_NODE ||
            !node.matches("[data-editra-ui]"),
        ),
      );
      if (meaningful) requestReflow();
    });
    state.observer.observe(core.editor, { childList: true, subtree: true });
    core.registerCleanup(() => {
      state.generation += 1;
      core.editor.removeEventListener("input", requestReflow);
      core.editor.removeEventListener("editra:pageChange", requestReflow);
      state.observer?.disconnect();
      state.unregisterCommands.forEach((unregister) => unregister());
      core.editor
        .querySelectorAll(":scope > .editra-pagination-spacer")
        .forEach((spacer) => spacer.remove());
      installations.delete(core);
    });
    installations.set(core, state);
    applyRuleAttributes(core, state);
    core.state.pagination = { ...state.rules };
    scheduleReflow(core, state);
    return state;
  }

  /** Plugin entry that installs pagination and optionally applies initial rules. */
  function PaginationPlugin(core, options = {}) {
    const state = install(core);
    return setPaginationRules(core, state, options);
  }

  PaginationPlugin.install = install;
  PaginationPlugin.hydrate = install;
  PaginationPlugin.plugin = Object.freeze({
    name: "pagination",
    label: "Pagination",
    icon: "keepTogether",
    command: "toggleKeepTogether",
  });

  global.PaginationPlugin = PaginationPlugin;
  (global.EditraPlugins ??= Object.create(null)).pagination =
    PaginationPlugin;
})(window);
