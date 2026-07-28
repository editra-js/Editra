(function (global) {
  "use strict";

  const installations = new WeakMap();
  let tableSequence = 0;

  function nextFrame() {
    return new Promise((resolve) => global.requestAnimationFrame(resolve));
  }

  function getTable(value) {
    if (value instanceof HTMLTableElement) return value;
    if (value instanceof HTMLTableCellElement) return value.closest("table");
    return value?.table ?? value?.cell?.closest("table") ?? null;
  }

  function getCell(options = {}) {
    return options instanceof HTMLTableCellElement
      ? options
      : options.cell ?? null;
  }

  function visualColumnIndex(cell) {
    return [...cell.parentElement.cells]
      .slice(0, cell.cellIndex)
      .reduce((index, item) => index + Math.max(1, item.colSpan), 0);
  }

  function visualColumnCount(table) {
    return Math.max(
      table.querySelector(":scope > colgroup")?.children.length ?? 0,
      ...[...table.rows].map((row) =>
        [...row.cells].reduce(
          (count, cell) => count + Math.max(1, cell.colSpan),
          0,
        ),
      ),
      1,
    );
  }

  function visualColumnWidths(table) {
    const cells = [...(table.rows[0]?.cells ?? [])];
    const widths = [];
    cells.forEach((cell) => {
      const span = Math.max(1, cell.colSpan);
      const width = cell.getBoundingClientRect().width / span;
      for (let index = 0; index < span; index += 1) widths.push(width);
    });
    return widths;
  }

  function findCellAtColumn(row, column) {
    let cursor = 0;
    for (const cell of row.cells) {
      const end = cursor + Math.max(1, cell.colSpan);
      if (column >= cursor && column < end) {
        return { cell, start: cursor, end };
      }
      cursor = end;
    }
    return null;
  }

  function insertCellAtColumn(row, column) {
    let cursor = 0;
    for (const cell of row.cells) {
      if (cursor >= column) {
        const inserted = row.insertCell(cell.cellIndex);
        inserted.append(document.createElement("br"));
        return inserted;
      }
      cursor += Math.max(1, cell.colSpan);
    }
    const inserted = row.insertCell();
    inserted.append(document.createElement("br"));
    return inserted;
  }

  function appendCellContent(target, source) {
    if (
      target.textContent?.trim() ||
      target.querySelector("img, video, table, iframe")
    ) {
      target.append(document.createElement("br"));
    }
    while (source.firstChild) target.append(source.firstChild);
  }

  function positionHandles(core, wrapper) {
    wrapper.dataset.editraTableId ||= String(++tableSequence);
    core.scheduleUpdate(`table-handles-${wrapper.dataset.editraTableId}`, () => {
      if (!wrapper.isConnected) return;
      const table = wrapper.querySelector("table");
      const firstRowCells = [...(table?.rows[0]?.cells ?? [])];
      if (!table || !firstRowCells.length) return;

      const wrapperRect = wrapper.getBoundingClientRect();
      wrapper
        .querySelectorAll('[data-editra-table-axis="column"]')
        .forEach((handle, column) => {
          let cursor = 0;
          const cell = firstRowCells.find((item) => {
            const end = cursor + Math.max(1, item.colSpan);
            if (column >= cursor && column < end) return true;
            cursor = end;
            return false;
          });
          if (!cell) return;
          const rect = cell.getBoundingClientRect();
          const withinSpan = column - cursor + 1;
          handle.style.left = `${
            rect.left -
            wrapperRect.left +
            (rect.width * withinSpan) / Math.max(1, cell.colSpan)
          }px`;
        });

      wrapper
        .querySelectorAll('[data-editra-table-axis="row"]')
        .forEach((handle, index) => {
          const row = table.rows[index];
          if (row) {
            handle.style.top = `${
              row.getBoundingClientRect().bottom - wrapperRect.top
            }px`;
          }
        });
    });
  }

  function ensureColumns(table) {
    const columnCount = visualColumnCount(table);
    let colgroup = table.querySelector(":scope > colgroup");
    if (!colgroup) {
      colgroup = document.createElement("colgroup");
      table.prepend(colgroup);
    }
    while (colgroup.children.length < columnCount) {
      const column = document.createElement("col");
      column.style.width = `${100 / columnCount}%`;
      colgroup.append(column);
    }
    while (colgroup.children.length > columnCount) {
      colgroup.lastElementChild.remove();
    }
    return colgroup;
  }

  function decorateTable(core, table) {
    let wrapper = table.closest(".editra-table-frame");
    if (!wrapper) {
      wrapper = document.createElement("div");
      wrapper.className = "editra-table-frame";
      if (table.isConnected) table.before(wrapper);
      wrapper.append(table);
    }

    table.style.tableLayout = "fixed";
    const colgroup = ensureColumns(table);
    wrapper
      .querySelectorAll("[data-editra-table-handle]")
      .forEach((handle) => handle.remove());

    const controls = document.createDocumentFragment();
    const selector = document.createElement("span");
    selector.className = "editra-table-select-handle";
    selector.dataset.editraTableHandle = "true";
    selector.dataset.editraTableAxis = "select";
    selector.contentEditable = "false";
    selector.setAttribute("role", "button");
    selector.setAttribute("aria-label", "Select entire table");
    selector.title = "Select table";
    controls.append(selector);
    [...colgroup.children].forEach((_, index) => {
      const handle = document.createElement("span");
      handle.className = "editra-table-column-handle";
      handle.dataset.editraTableHandle = "true";
      handle.dataset.editraTableAxis = "column";
      handle.dataset.index = String(index);
      handle.contentEditable = "false";
      handle.setAttribute("aria-hidden", "true");
      controls.append(handle);
    });

    [...table.rows].forEach((_, index) => {
      const handle = document.createElement("span");
      handle.className = "editra-table-row-handle";
      handle.dataset.editraTableHandle = "true";
      handle.dataset.editraTableAxis = "row";
      handle.dataset.index = String(index);
      handle.contentEditable = "false";
      handle.setAttribute("aria-hidden", "true");
      controls.append(handle);
    });
    wrapper.append(controls);
    positionHandles(core, wrapper);
    return wrapper;
  }

  async function createTable(rows, columns) {
    const table = document.createElement("table");
    table.dataset.editraBorder = "solid";
    table.dataset.editraBorderColor = "#1f1f1f";
    table.dataset.editraAllowRowSplitting = "true";
    table.dataset.editraKeepRowsTogether = "false";
    table.dataset.editraKeepTableTogether = "false";
    table.dataset.editraRepeatHeader = "true";
    const safeRows = Math.min(1000, Math.max(1, Number(rows) || 1));
    const safeColumns = Math.min(100, Math.max(1, Number(columns) || 1));
    const header = table.createTHead().insertRow();
    for (
      let columnIndex = 0;
      columnIndex < safeColumns;
      columnIndex += 1
    ) {
      const cell = document.createElement("th");
      cell.scope = "col";
      cell.style.border = "1px solid #1f1f1f";
      cell.append(document.createElement("br"));
      header.append(cell);
    }
    const body = table.createTBody();

    for (let start = 1; start < safeRows; start += 25) {
      const fragment = document.createDocumentFragment();
      const end = Math.min(start + 25, safeRows);
      for (let rowIndex = start; rowIndex < end; rowIndex += 1) {
        const row = document.createElement("tr");
        for (
          let columnIndex = 0;
          columnIndex < safeColumns;
          columnIndex += 1
        ) {
          const cell = document.createElement("td");
          cell.style.border = "1px solid #1f1f1f";
          cell.append(document.createElement("br"));
          row.append(cell);
        }
        fragment.append(row);
      }
      body.append(fragment);
      if (end < safeRows) await nextFrame();
    }
    return table;
  }

  async function createAndInsertTable(core, rows, columns) {
    const table = await createTable(rows, columns);
    const wrapper = decorateTable(core, table);
    core.insertNode(wrapper);
    positionHandles(core, wrapper);
    return table;
  }

  function commit(core, table) {
    if (table?.isConnected) decorateTable(core, table);
    core.recordHistory();
    core.scheduleUpdate("table-change", () => core.emitChange());
    return true;
  }

  function selectTable(core, state, options = {}) {
    const table =
      getTable(options) ||
      state.activeCell?.closest("table") ||
      activeTable(core);
    if (!table || !core.editor.contains(table)) return false;
    state.selectedTable
      ?.closest(".editra-table-frame")
      ?.classList.remove("is-table-selected");
    state.selectedTable = table;
    const wrapper = table.closest(".editra-table-frame");
    wrapper?.classList.add("is-table-selected");
    const range = document.createRange();
    range.selectNode(table);
    const selection = global.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
    core.selection = range.cloneRange();
    core.state.tableSelected = true;
    core.emitState();
    return table;
  }

  function deleteTable(core, state, options = {}) {
    const table =
      getTable(options) ||
      state.selectedTable ||
      state.activeCell?.closest("table") ||
      activeTable(core);
    if (!table || !core.editor.contains(table)) return false;
    const wrapper = table.closest(".editra-table-frame");
    const paragraph = document.createElement("p");
    paragraph.append(document.createElement("br"));
    (wrapper || table).before(paragraph);
    (wrapper || table).remove();
    state.selectedTable = null;
    state.activeCell = null;
    core.state.tableSelected = false;
    const range = document.createRange();
    range.selectNodeContents(paragraph);
    range.collapse(true);
    const selection = global.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
    core.selection = range.cloneRange();
    core.focus();
    return commit(core, null);
  }

  function mergeCells(core, options = {}) {
    const cell = getCell(options);
    const table = getTable(cell);
    if (!cell || !table) return false;
    const direction = options.direction ?? "horizontal";
    const count = Math.max(2, Number(options.count) || 2);

    if (direction === "vertical") {
      const column = visualColumnIndex(cell);
      let lastRow = cell.parentElement.rowIndex + Math.max(1, cell.rowSpan);
      let merged = 1;
      while (lastRow < table.rows.length && merged < count) {
        const match = findCellAtColumn(table.rows[lastRow], column);
        if (!match) break;
        appendCellContent(cell, match.cell);
        cell.rowSpan += Math.max(1, match.cell.rowSpan);
        lastRow += Math.max(1, match.cell.rowSpan);
        match.cell.remove();
        merged += 1;
      }
      if (merged === 1) return false;
    } else {
      let merged = 1;
      while (cell.nextElementSibling && merged < count) {
        const next = cell.nextElementSibling;
        cell.colSpan += Math.max(1, next.colSpan);
        appendCellContent(cell, next);
        next.remove();
        merged += 1;
      }
      if (merged === 1) return false;
    }

    return commit(core, table);
  }

  function splitCell(core, options = {}) {
    const cell = getCell(options);
    const table = getTable(cell);
    if (!cell || !table) return false;
    const columns = Math.max(1, cell.colSpan);
    const rows = Math.max(1, cell.rowSpan);
    if (columns === 1 && rows === 1) return false;

    const startColumn = visualColumnIndex(cell);
    const startRow = cell.parentElement.rowIndex;
    cell.colSpan = 1;
    cell.rowSpan = 1;

    for (let column = 1; column < columns; column += 1) {
      const inserted = cell.parentElement.insertCell(cell.cellIndex + column);
      inserted.append(document.createElement("br"));
    }

    for (let rowOffset = 1; rowOffset < rows; rowOffset += 1) {
      const row = table.rows[startRow + rowOffset];
      if (!row) break;
      for (let column = 0; column < columns; column += 1) {
        insertCellAtColumn(row, startColumn + column);
      }
    }
    return commit(core, table);
  }

  function addRow(core, options = {}) {
    const cell = getCell(options);
    const table = getTable(options) ?? getTable(cell);
    if (!table) return false;
    const anchorRow = cell?.parentElement;
    const position = options.position ?? "after";
    const rowIndex = anchorRow
      ? anchorRow.rowIndex + (position === "before" ? 0 : 1)
      : table.rows.length;
    const row = table.insertRow(rowIndex);
    const columns = visualColumnCount(table);
    for (let index = 0; index < columns; index += 1) {
      row.insertCell().append(document.createElement("br"));
    }
    return commit(core, table);
  }

  function deleteRow(core, options = {}) {
    const cell = getCell(options);
    const table = getTable(options) ?? getTable(cell);
    const row = cell?.parentElement ?? options.row;
    if (!table || !row) return false;
    if (table.rows.length === 1) {
      table.closest(".editra-table-frame")?.remove();
      return commit(core, null);
    }
    table.deleteRow(row.rowIndex);
    return commit(core, table);
  }

  function addColumn(core, options = {}) {
    const cell = getCell(options);
    const table = getTable(options) ?? getTable(cell);
    if (!table) return false;
    const position = options.position ?? "after";
    const column = cell
      ? visualColumnIndex(cell) +
        (position === "before" ? 0 : Math.max(1, cell.colSpan))
      : visualColumnCount(table);

    const colgroup = ensureColumns(table);
    [...table.rows].forEach((row) => {
      const match = findCellAtColumn(row, column);
      if (match && column > match.start && column < match.end) {
        match.cell.colSpan += 1;
      } else {
        insertCellAtColumn(row, column);
      }
    });
    const reference = colgroup.children[column] ?? null;
    const newColumn = document.createElement("col");
    newColumn.style.width = `${100 / visualColumnCount(table)}%`;
    colgroup.insertBefore(newColumn, reference);
    return commit(core, table);
  }

  function deleteColumn(core, options = {}) {
    const cell = getCell(options);
    const table = getTable(options) ?? getTable(cell);
    if (!table || visualColumnCount(table) <= 1) return false;
    const column = cell
      ? visualColumnIndex(cell)
      : Math.max(0, Number(options.column) || 0);

    [...table.rows].forEach((row) => {
      const match = findCellAtColumn(row, column);
      if (!match) return;
      if (match.cell.colSpan > 1) match.cell.colSpan -= 1;
      else match.cell.remove();
    });
    table.querySelector(":scope > colgroup")?.children[column]?.remove();
    return commit(core, table);
  }

  function setTableBorder(core, options = {}) {
    const table = getTable(options);
    if (!table) return false;
    const style = ["solid", "dashed", "none"].includes(options.style)
      ? options.style
      : "solid";
    table.dataset.editraBorder = style;
    [...table.querySelectorAll("td, th")].forEach((cell) => {
      cell.style.borderStyle = style;
    });
    return commit(core, table);
  }

  function activeTable(core) {
    core.restoreSelection();
    const node = global.getSelection()?.anchorNode;
    const element =
      node?.nodeType === Node.ELEMENT_NODE ? node : node?.parentElement;
    return element?.closest("table") ?? null;
  }

  function setTableBorderColor(core, value = {}) {
    const options =
      typeof value === "string" ? { color: value } : value ?? {};
    const table = getTable(options) ?? activeTable(core);
    if (!table) return false;
    const requested =
      options.color || global.prompt("Table border color:", "#1f1f1f");
    const color = String(requested || "").trim();
    if (!global.CSS?.supports?.("color", color)) return false;
    table.dataset.editraBorderColor = color;
    [...table.querySelectorAll("td, th")].forEach((cell) => {
      cell.style.borderColor = color;
      cell.style.borderWidth ||= "1px";
      cell.style.borderStyle ||= table.dataset.editraBorder || "solid";
    });
    return commit(core, table);
  }

  function setCellBackground(core, options = {}) {
    const cell = getCell(options);
    const table = getTable(cell);
    if (!cell || !table) return false;
    const color = options.color || "#fff2a8";
    const scope = options.scope ?? "cell";
    let cells = [cell];
    if (scope === "row") cells = [...cell.parentElement.cells];
    else if (scope === "column") {
      const column = visualColumnIndex(cell);
      cells = [...table.rows]
        .map((row) => findCellAtColumn(row, column)?.cell)
        .filter(Boolean);
    }
    cells.forEach((item) => {
      item.style.backgroundColor = color;
    });
    return commit(core, table);
  }

  function setTableAlignment(core, options = {}) {
    const cell = getCell(options);
    const table = getTable(options) ?? getTable(cell);
    if (!table) return false;
    const alignment = ["left", "center", "right"].includes(options.alignment)
      ? options.alignment
      : "left";
    const cells = cell ? [cell] : [...table.querySelectorAll("td, th")];
    cells.forEach((item) => {
      item.style.textAlign = alignment;
    });
    return commit(core, table);
  }

  function openGridSelector(core, options = {}) {
    document
      .querySelector(".editra-table-picker")
      ?.dispatchEvent(new CustomEvent("editra:close"));

    const gridRows = Math.max(1, Number(options.gridRows) || 10);
    const gridColumns = Math.max(1, Number(options.gridColumns) || 10);
    const picker = document.createElement("div");
    picker.className = "editra-table-picker";
    picker.setAttribute("role", "dialog");
    picker.setAttribute("aria-label", "Choose table size");

    const grid = document.createElement("div");
    grid.className = "editra-table-grid";
    grid.style.setProperty("--editra-grid-columns", String(gridColumns));
    grid.setAttribute("role", "grid");

    const status = document.createElement("div");
    status.className = "editra-table-status";
    status.setAttribute("aria-live", "polite");
    status.textContent = "Drag to select table size";

    const fragment = document.createDocumentFragment();
    for (let row = 1; row <= gridRows; row += 1) {
      for (let column = 1; column <= gridColumns; column += 1) {
        const gridCell = document.createElement("button");
        gridCell.type = "button";
        gridCell.className = "editra-table-grid-cell";
        gridCell.dataset.row = String(row);
        gridCell.dataset.column = String(column);
        gridCell.setAttribute("role", "gridcell");
        gridCell.setAttribute("aria-label", `${row} by ${column} table`);
        gridCell.tabIndex = row === 1 && column === 1 ? 0 : -1;
        fragment.append(gridCell);
      }
    }
    grid.append(fragment);
    picker.append(grid, status);
    document.body.append(picker);

    const trigger = core.toolbar.getButton("table");
    const triggerRect = trigger?.getBoundingClientRect();
    if (triggerRect) {
      const pickerWidth = Math.min(340, gridColumns * 22 + 32);
      picker.style.width = `${pickerWidth}px`;
      picker.style.left = `${Math.max(
        12,
        Math.min(triggerRect.left, innerWidth - pickerWidth - 12),
      )}px`;
      picker.style.top = `${Math.min(
        triggerRect.bottom + 8,
        innerHeight - 300,
      )}px`;
    }

    let dragging = false;
    let selectedRows = 0;
    let selectedColumns = 0;
    let unregister = () => {};
    let closed = false;

    function gridCellFrom(target) {
      return target instanceof Element
        ? target.closest(".editra-table-grid-cell")
        : null;
    }

    function updateSelection(gridCell) {
      if (!gridCell) return;
      selectedRows = Number(gridCell.dataset.row);
      selectedColumns = Number(gridCell.dataset.column);
      core.scheduleUpdate("table-grid-highlight", () => {
        status.textContent = `${selectedRows} x ${selectedColumns} table`;
        grid.querySelectorAll(".editra-table-grid-cell").forEach((item) => {
          const active =
            Number(item.dataset.row) <= selectedRows &&
            Number(item.dataset.column) <= selectedColumns;
          item.classList.toggle("is-selected", active);
          item.setAttribute("aria-selected", String(active));
        });
      });
    }

    function handleDown(event) {
      const gridCell = gridCellFrom(event.target);
      if (!gridCell) return;
      event.preventDefault();
      dragging = true;
      updateSelection(gridCell);
    }

    function handleOver(event) {
      const gridCell = gridCellFrom(event.target);
      if (gridCell && (dragging || event.pointerType === "mouse")) {
        updateSelection(gridCell);
      }
    }

    function handleUp(event) {
      if (!dragging) return;
      const gridCell = gridCellFrom(event.target);
      if (gridCell) updateSelection(gridCell);
      dragging = false;
      if (selectedRows && selectedColumns) {
        close();
        createAndInsertTable(core, selectedRows, selectedColumns);
      }
    }

    function handleKeydown(event) {
      const gridCell = gridCellFrom(event.target);
      if (event.key === "Escape") close();
      else if (event.key === "Enter" && gridCell) {
        updateSelection(gridCell);
        close();
        createAndInsertTable(core, selectedRows, selectedColumns);
      }
    }

    function handleOutside(event) {
      if (!picker.contains(event.target) && event.target !== trigger) close();
    }

    function close() {
      if (closed) return;
      closed = true;
      grid.removeEventListener("pointerdown", handleDown);
      grid.removeEventListener("pointerover", handleOver);
      document.removeEventListener("pointerup", handleUp);
      document.removeEventListener("pointerdown", handleOutside);
      picker.removeEventListener("keydown", handleKeydown);
      picker.removeEventListener("editra:close", close);
      picker.remove();
      unregister();
    }

    grid.addEventListener("pointerdown", handleDown);
    grid.addEventListener("pointerover", handleOver);
    document.addEventListener("pointerup", handleUp);
    document.addEventListener("pointerdown", handleOutside);
    picker.addEventListener("keydown", handleKeydown);
    picker.addEventListener("editra:close", close);
    unregister = core.registerCleanup(close);
    return picker;
  }

  function insertTable(core, options = {}) {
    const rows = Number(options.rows);
    const columns = Number(options.columns);
    if (rows > 0 && columns > 0) {
      return createAndInsertTable(core, rows, columns);
    }
    return openGridSelector(core, options);
  }

  function openContextMenu(core, state, cell, x, y) {
    state.contextMenu?.remove();
    state.activeCell = cell;

    const menu = document.createElement("div");
    menu.className = "editra-table-context-menu";
    menu.setAttribute("role", "menu");
    menu.innerHTML = `
      <div class="editra-table-context-title">Table cell</div>
      <div class="editra-table-context-grid">
        <button data-table-command="mergeCells" data-direction="horizontal">Merge right</button>
        <button data-table-command="mergeCells" data-direction="vertical">Merge down</button>
        <button data-table-command="splitCell">Split cell</button>
        <button data-table-command="addRow">Add row</button>
        <button data-table-command="deleteRow">Delete row</button>
        <button data-table-command="addColumn">Add column</button>
        <button data-table-command="deleteColumn">Delete column</button>
        <button data-table-command="deleteTable">Delete table</button>
      </div>
      <div class="editra-table-context-section">Borders</div>
      <div class="editra-table-context-actions">
        <button data-table-command="setTableBorder" data-style="solid">Solid</button>
        <button data-table-command="setTableBorder" data-style="dashed">Dashed</button>
        <button data-table-command="setTableBorder" data-style="none">None</button>
      </div>
      <div class="editra-table-color-row">
        <label>Border <input type="color" value="#1f1f1f" data-border-color></label>
      </div>
      <div class="editra-table-context-section">Alignment</div>
      <div class="editra-table-context-actions">
        <button data-table-command="setTableAlignment" data-alignment="left">Left</button>
        <button data-table-command="setTableAlignment" data-alignment="center">Center</button>
        <button data-table-command="setTableAlignment" data-alignment="right">Right</button>
      </div>
      <div class="editra-table-context-section">Background</div>
      <div class="editra-table-color-row">
        <label>Cell <input type="color" value="#fff2a8" data-color-scope="cell"></label>
        <label>Row <input type="color" value="#e8f0ff" data-color-scope="row"></label>
        <label>Column <input type="color" value="#f2eaff" data-color-scope="column"></label>
      </div>
    `;
    document.body.append(menu);
    const rect = menu.getBoundingClientRect();
    menu.style.left = `${Math.max(8, Math.min(x, innerWidth - rect.width - 8))}px`;
    menu.style.top = `${Math.max(8, Math.min(y, innerHeight - rect.height - 8))}px`;
    state.contextMenu = menu;
  }

  function install(core) {
    if (installations.has(core)) return installations.get(core);
    const state = {
      activeCell: null,
      selectedTable: null,
      activeDragCleanup: null,
      contextMenu: null,
      unregisterCommands: [],
    };

    const commands = {
      insertTable: (options) => insertTable(core, options),
      mergeCells: (options) => mergeCells(core, options),
      splitCell: (options) => splitCell(core, options),
      addRow: (options) => addRow(core, options),
      deleteRow: (options) => deleteRow(core, options),
      addColumn: (options) => addColumn(core, options),
      deleteColumn: (options) => deleteColumn(core, options),
      setTableBorder: (options) => setTableBorder(core, options),
      setTableBorderColor: (options) => setTableBorderColor(core, options),
      setCellBackground: (options) => setCellBackground(core, options),
      setTableAlignment: (options) => setTableAlignment(core, options),
      selectTable: (options) => selectTable(core, state, options),
      deleteTable: (options) => deleteTable(core, state, options),
      tableStressTest: async (options = {}) => {
        const rows = Math.max(100, Number(options.rows) || 120);
        const columns = Math.max(1, Number(options.columns) || 12);
        const startedAt = performance.now();
        const table = await createAndInsertTable(core, rows, columns);
        await nextFrame();
        const result = {
          rows,
          columns,
          cells: rows * columns,
          renderMs: Math.round(performance.now() - startedAt),
        };
        if (!options.keep) {
          table.closest(".editra-table-frame")?.remove();
          core.recordHistory();
        }
        return result;
      },
    };
    Object.entries(commands).forEach(([name, handler]) => {
      state.unregisterCommands.push(
        core.registerCommand(name, handler, {
          plugin: "table",
          source: "plugin",
        }),
      );
    });

    function handleResizeDown(event) {
      const handle = event.target.closest?.("[data-editra-table-handle]");
      const wrapper = handle?.closest(".editra-table-frame");
      const table = wrapper?.querySelector("table");
      if (!handle || !table || !core.editor.contains(wrapper)) return;

      event.preventDefault();
      state.activeDragCleanup?.();
      const axis = handle.dataset.editraTableAxis;
      if (axis === "select") {
        event.preventDefault();
        selectTable(core, state, { table });
        return;
      }
      const index = Number(handle.dataset.index);
      const startX = event.clientX;
      const startY = event.clientY;
      const rows = [...table.rows];
      const columns = [...ensureColumns(table).children];
      const initialWidths = visualColumnWidths(table);
      const initialTableWidth = table.getBoundingClientRect().width;
      const initialRowHeight = rows[index]?.getBoundingClientRect().height ?? 36;
      let latestX = startX;
      let latestY = startY;

      columns.forEach((column, columnIndex) => {
        column.style.width = `${initialWidths[columnIndex] ?? 80}px`;
      });
      table.style.width = `${initialTableWidth}px`;

      function applyResize() {
        if (axis === "column" && columns[index]) {
          const width = Math.max(48, initialWidths[index] + latestX - startX);
          columns[index].style.width = `${Math.round(width)}px`;
          table.style.width = `${Math.round(
            initialTableWidth + width - initialWidths[index],
          )}px`;
        } else if (axis === "row" && rows[index]) {
          const height = Math.max(32, initialRowHeight + latestY - startY);
          rows[index].style.height = `${Math.round(height)}px`;
        }
        positionHandles(core, wrapper);
      }

      function handleMove(moveEvent) {
        latestX = moveEvent.clientX;
        latestY = moveEvent.clientY;
        core.scheduleUpdate(`table-resize-${axis}`, applyResize);
      }

      function cleanupDrag() {
        document.removeEventListener("pointermove", handleMove);
        document.removeEventListener("pointerup", handleUp);
        document.removeEventListener("pointercancel", handleUp);
        state.activeDragCleanup = null;
      }

      function handleUp(upEvent) {
        latestX = upEvent.clientX;
        latestY = upEvent.clientY;
        applyResize();
        cleanupDrag();
        commit(core, table);
      }

      state.activeDragCleanup = cleanupDrag;
      document.addEventListener("pointermove", handleMove);
      document.addEventListener("pointerup", handleUp);
      document.addEventListener("pointercancel", handleUp);
    }

    function handleContextMenu(event) {
      const cell = event.target.closest?.("td, th");
      if (!cell || !core.editor.contains(cell)) return;
      event.preventDefault();
      openContextMenu(core, state, cell, event.clientX, event.clientY);
    }

    function handleContextClick(event) {
      const button = event.target.closest?.("[data-table-command]");
      if (!button || !state.contextMenu?.contains(button)) return;
      const command = button.dataset.tableCommand;
      core.executeCommand(command, {
        cell: state.activeCell,
        table: state.activeCell?.closest("table"),
        direction: button.dataset.direction,
        style: button.dataset.style,
        alignment: button.dataset.alignment,
      });
      state.contextMenu.remove();
      state.contextMenu = null;
    }

    function handleColor(event) {
      const borderInput = event.target.closest?.("[data-border-color]");
      if (borderInput && state.contextMenu?.contains(borderInput)) {
        core.executeCommand("setTableBorderColor", {
          table: state.activeCell?.closest("table"),
          color: borderInput.value,
        });
        return;
      }
      const input = event.target.closest?.("[data-color-scope]");
      if (!input || !state.contextMenu?.contains(input)) return;
      core.executeCommand("setCellBackground", {
        cell: state.activeCell,
        scope: input.dataset.colorScope,
        color: input.value,
      });
    }

    function handleOutside(event) {
      if (
        state.selectedTable &&
        !event.target.closest?.(".editra-table-frame")
      ) {
        state.selectedTable
          .closest(".editra-table-frame")
          ?.classList.remove("is-table-selected");
        state.selectedTable = null;
        core.state.tableSelected = false;
        core.emitState();
      }
      if (
        state.contextMenu &&
        !state.contextMenu.contains(event.target)
      ) {
        state.contextMenu.remove();
        state.contextMenu = null;
      }
    }

    function handleKeydown(event) {
      if (
        (event.key === "Delete" || event.key === "Backspace") &&
        state.selectedTable?.isConnected
      ) {
        event.preventDefault();
        event.stopImmediatePropagation();
        deleteTable(core, state);
        return;
      }
      if (event.key === "Escape" && state.contextMenu) {
        state.contextMenu.remove();
        state.contextMenu = null;
      }
    }

    const observer = new MutationObserver(() => {
      core.scheduleUpdate("table-removal-cleanup", () => {
        if (state.activeCell && !state.activeCell.isConnected) {
          state.contextMenu?.remove();
          state.contextMenu = null;
          state.activeCell = null;
        }
        if (state.selectedTable && !state.selectedTable.isConnected) {
          state.selectedTable = null;
          core.state.tableSelected = false;
        }
      });
    });
    observer.observe(core.editor, { childList: true, subtree: true });

    core.editor.addEventListener("pointerdown", handleResizeDown);
    core.editor.addEventListener("contextmenu", handleContextMenu);
    document.addEventListener("click", handleContextClick);
    document.addEventListener("change", handleColor);
    document.addEventListener("pointerdown", handleOutside);
    document.addEventListener("keydown", handleKeydown);

    core.registerCleanup(() => {
      state.activeDragCleanup?.();
      state.contextMenu?.remove();
      observer.disconnect();
      core.editor.removeEventListener("pointerdown", handleResizeDown);
      core.editor.removeEventListener("contextmenu", handleContextMenu);
      document.removeEventListener("click", handleContextClick);
      document.removeEventListener("change", handleColor);
      document.removeEventListener("pointerdown", handleOutside);
      document.removeEventListener("keydown", handleKeydown);
      state.unregisterCommands.forEach((unregister) => unregister());
      installations.delete(core);
    });

    installations.set(core, state);
    return state;
  }

  function TablePlugin(core, options) {
    install(core);
    return insertTable(core, options);
  }

  TablePlugin.install = install;
  TablePlugin.hydrate = function hydrate(core, root) {
    install(core);
    root.querySelectorAll("table").forEach((table) => {
      decorateTable(core, table);
    });
  };
  TablePlugin.stressTest = (core, options) =>
    core.executeCommand("tableStressTest", options);

  TablePlugin.plugin = Object.freeze({
    name: "table",
    label: "Insert table",
    icon: "table",
    command: "insertTable",
  });

  global.TablePlugin = TablePlugin;
  (global.EditraPlugins ??= Object.create(null)).table = TablePlugin;
})(window);
