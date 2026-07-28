// Version: 2.0.0
/**
 * Product: Editra
 * Version: 2.0.0
 * Purpose: Implements the Editra ruler plugin and its editor commands.
 * Licensing: MIT License (open source)
 */

(function (global) {
  "use strict";

  const installations = new WeakMap();
  const MIN_CONTENT_WIDTH = 120;

  function pageWidth(core) {
    return core.editor.getBoundingClientRect().width ||
      Number.parseFloat(core.options.editorWidth) ||
      816;
  }

  function clamp(value, minimum, maximum) {
    return Math.min(maximum, Math.max(minimum, Number(value) || 0));
  }

  function savedState(core) {
    const source = core.editor.querySelector("[data-editra-ruler-state]");
    if (!source) return {};
    try {
      return JSON.parse(source.dataset.editraRulerState || "{}");
    } catch {
      return {};
    }
  }

  function initialState(core) {
    const style = getComputedStyle(core.editor);
    const margins = core.state.margins ?? {};
    const saved = savedState(core);
    const savedNumber = (name, fallback) => {
      const value = Number(saved[name]);
      return Number.isFinite(value) ? value : fallback;
    };
    return {
      visible: Boolean(saved.visible),
      leftMargin: savedNumber(
        "leftMargin",
        Number.parseFloat(margins.left) ||
        Number.parseFloat(style.paddingLeft) ||
        72,
      ),
      rightMargin: savedNumber(
        "rightMargin",
        Number.parseFloat(margins.right) ||
        Number.parseFloat(style.paddingRight) ||
        72,
      ),
      leftIndent: savedNumber("leftIndent", 0),
      firstLineIndent: savedNumber("firstLineIndent", 0),
      tabStops: Array.isArray(saved.tabStops)
        ? saved.tabStops.map(Number).filter(Number.isFinite)
        : [],
      frameId: null,
      pendingReason: null,
      drag: null,
    };
  }

  function createRuler(core, state) {
    const ruler = document.createElement("div");
    ruler.className = "editra-ruler";
    ruler.dataset.editraUi = "true";
    ruler.hidden = !state.visible;
    ruler.setAttribute("role", "group");
    ruler.setAttribute("aria-label", "Document ruler");
    ruler.innerHTML = `
      <div class="editra-ruler-track" data-ruler-track>
        <div class="editra-ruler-ticks" aria-hidden="true"></div>
        <button type="button" class="editra-ruler-marker is-margin" data-ruler-marker="leftMargin" aria-label="Left margin"></button>
        <button type="button" class="editra-ruler-marker is-margin is-right" data-ruler-marker="rightMargin" aria-label="Right margin"></button>
        <button type="button" class="editra-ruler-marker is-indent" data-ruler-marker="leftIndent" aria-label="Left indent"></button>
        <button type="button" class="editra-ruler-marker is-first-line" data-ruler-marker="firstLineIndent" aria-label="First-line indent"></button>
        <div class="editra-ruler-tab-stops" data-ruler-tab-stops></div>
      </div>
    `;
    const ticks = ruler.querySelector(".editra-ruler-ticks");
    const fragment = document.createDocumentFragment();
    for (let index = 0; index <= 20; index += 1) {
      const tick = document.createElement("span");
      tick.className = index % 2 ? "is-half" : "is-whole";
      tick.style.left = `${index * 5}%`;
      if (index % 2 === 0) tick.dataset.label = String(index / 2);
      fragment.append(tick);
    }
    ticks.append(fragment);
    core.toolbar.card.insertBefore(ruler, core.toolbar.workspace);
    state.element = ruler;
    state.track = ruler.querySelector("[data-ruler-track]");
    state.tabContainer = ruler.querySelector("[data-ruler-tab-stops]");
    return ruler;
  }

  function scheduleRender(core, state, reason = null) {
    if (reason) state.pendingReason = reason;
    if (state.frameId !== null) return;
    state.frameId = requestAnimationFrame(() => {
      state.frameId = null;
      render(core, state);
      if (state.pendingReason) {
        const pendingReason = state.pendingReason;
        state.pendingReason = null;
        notify(core, state, pendingReason, false);
      }
    });
  }

  function persistState(core, state) {
    let source = core.editor.querySelector("[data-editra-ruler-state]");
    if (!source) {
      source = document.createElement("span");
      source.hidden = true;
      source.contentEditable = "false";
      source.className = "editra-ruler-state";
      core.editor.prepend(source);
    }
    source.dataset.editraRulerState = JSON.stringify({
      visible: state.visible,
      leftMargin: state.leftMargin,
      rightMargin: state.rightMargin,
      leftIndent: state.leftIndent,
      firstLineIndent: state.firstLineIndent,
      tabStops: [...state.tabStops],
    });
  }

  function render(core, state) {
    if (!state.element?.isConnected) return;
    const width = pageWidth(core);
    const maxMargin = Math.max(0, (width - MIN_CONTENT_WIDTH) / 2);
    state.leftMargin = clamp(state.leftMargin, 0, maxMargin);
    state.rightMargin = clamp(state.rightMargin, 0, maxMargin);
    state.leftIndent = clamp(
      state.leftIndent,
      -state.leftMargin,
      width - state.leftMargin - state.rightMargin - MIN_CONTENT_WIDTH,
    );
    state.firstLineIndent = clamp(
      state.firstLineIndent,
      -state.leftMargin - state.leftIndent,
      width - state.leftMargin - state.leftIndent - state.rightMargin - 20,
    );
    state.element.style.width = `${Math.round(width)}px`;
    const positions = {
      leftMargin: state.leftMargin,
      rightMargin: width - state.rightMargin,
      leftIndent: state.leftMargin + state.leftIndent,
      firstLineIndent:
        state.leftMargin + state.leftIndent + state.firstLineIndent,
    };
    Object.entries(positions).forEach(([name, position]) => {
      const marker = state.element.querySelector(
        `[data-ruler-marker="${name}"]`,
      );
      marker.style.left = `${(position / width) * 100}%`;
      marker.setAttribute("aria-valuenow", String(Math.round(position)));
    });

    const tabs = document.createDocumentFragment();
    state.tabStops.forEach((position) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "editra-ruler-tab";
      button.dataset.tabStop = String(position);
      button.style.left = `${(position / width) * 100}%`;
      button.setAttribute("aria-label", `Tab stop ${Math.round(position)} pixels`);
      tabs.append(button);
    });
    state.tabContainer.replaceChildren(tabs);

    core.applyPageMargins(
      { left: state.leftMargin, right: state.rightMargin },
      false,
    );
    core.editor.style.setProperty(
      "--editra-left-indent",
      `${state.leftIndent}px`,
    );
    core.editor.style.setProperty(
      "--editra-first-line-indent",
      `${state.firstLineIndent}px`,
    );
    core.state.ruler = {
      visible: state.visible,
      leftMargin: state.leftMargin,
      rightMargin: state.rightMargin,
      leftIndent: state.leftIndent,
      firstLineIndent: state.firstLineIndent,
      tabStops: [...state.tabStops],
    };
    persistState(core, state);
  }

  function notify(core, state, reason, updateState = true) {
    const detail = {
      reason,
      ...core.state.ruler,
      editor: core,
    };
    if (typeof core.options.onRulerAdjust === "function") {
      core.options.onRulerAdjust(detail);
    }
    core.editor.dispatchEvent(
      new CustomEvent("editra:rulerAdjust", { detail, bubbles: true }),
    );
    if (updateState) core.emitState();
    return detail;
  }

  function commit(core, state, reason) {
    render(core, state);
    core.recordHistory();
    core.scheduleUpdate("ruler-content-change", () => core.emitChange());
    return notify(core, state, reason);
  }

  function setRulerMargins(core, state, options, value) {
    if (typeof options === "string") options = { [options]: value };
    if (typeof options === "number") options = { left: options, right: options };
    options ||= {};
    if (options.left !== undefined) state.leftMargin = Number(options.left);
    if (options.right !== undefined) state.rightMargin = Number(options.right);
    return commit(core, state, "margin");
  }

  function setIndent(core, state, options, value) {
    if (typeof options === "string") options = { [options]: value };
    if (typeof options === "number") options = { left: options };
    options ||= {};
    if (options.left !== undefined) state.leftIndent = Number(options.left);
    if (options.firstLine !== undefined) {
      state.firstLineIndent = Number(options.firstLine);
    }
    if (options.hanging !== undefined) {
      state.firstLineIndent = -Math.abs(Number(options.hanging));
    }
    return commit(core, state, "indent");
  }

  function setTabStop(core, state, options) {
    const position = Number(
      typeof options === "object" ? options.position : options,
    );
    if (!Number.isFinite(position)) return false;
    const width = pageWidth(core);
    const normalized = clamp(position, state.leftMargin, width - state.rightMargin);
    if (!state.tabStops.some((tab) => Math.abs(tab - normalized) < 3)) {
      state.tabStops.push(normalized);
      state.tabStops.sort((a, b) => a - b);
    }
    return commit(core, state, "tabStop");
  }

  function removeTabStop(core, state, options) {
    const position = Number(
      typeof options === "object" ? options.position : options,
    );
    const index = state.tabStops.findIndex((tab) => Math.abs(tab - position) < 4);
    if (index < 0) return false;
    state.tabStops.splice(index, 1);
    return commit(core, state, "removeTabStop");
  }

  function toggleRuler(core, state, options = {}) {
    state.visible =
      typeof options.visible === "boolean" ? options.visible : !state.visible;
    state.element.hidden = !state.visible;
    core.toolbar.card.classList.toggle("editra-show-ruler", state.visible);
    render(core, state);
    core.scheduleUpdate("ruler-content-change", () => core.emitChange());
    return notify(core, state, "visibility");
  }

  function pointerPosition(core, state, event) {
    const rect = state.track.getBoundingClientRect();
    return clamp(event.clientX - rect.left, 0, pageWidth(core));
  }

  function bindInteractions(core, state) {
    function pointerDown(event) {
      const marker = event.target.closest("[data-ruler-marker],[data-tab-stop]");
      if (marker) {
        event.preventDefault();
        event.stopPropagation();
        state.drag = {
          type: marker.dataset.rulerMarker || "tabStop",
          originalTab: Number(marker.dataset.tabStop),
          pointerId: event.pointerId,
        };
        state.element.classList.add("is-dragging");
        marker.classList.add("is-active");
        core.toolbar.card.classList.add("editra-ruler-adjusting");
        try {
          state.track.setPointerCapture?.(event.pointerId);
        } catch {
          // Document listeners remain as the cross-browser fallback.
        }
        document.addEventListener("pointermove", pointerMove);
        document.addEventListener("pointerup", pointerUp);
        document.addEventListener("pointercancel", pointerUp);
        return;
      }
      if (event.target.closest("[data-ruler-track]")) {
        setTabStop(core, state, pointerPosition(core, state, event));
      }
    }

    function pointerMove(event) {
      if (!state.drag || event.pointerId !== state.drag.pointerId) return;
      const position = pointerPosition(core, state, event);
      const width = pageWidth(core);
      if (state.drag.type === "leftMargin") state.leftMargin = position;
      else if (state.drag.type === "rightMargin") {
        state.rightMargin = width - position;
      } else if (state.drag.type === "leftIndent") {
        state.leftIndent = position - state.leftMargin;
      } else if (state.drag.type === "firstLineIndent") {
        state.firstLineIndent =
          position - state.leftMargin - state.leftIndent;
      } else {
        const index = state.tabStops.findIndex(
          (tab) => Math.abs(tab - state.drag.originalTab) < 4,
        );
        if (index >= 0) {
          const tabPosition = clamp(
            position,
            state.leftMargin,
            width - state.rightMargin,
          );
          state.tabStops[index] = tabPosition;
          state.drag.originalTab = tabPosition;
        }
      }
      scheduleRender(core, state, "dragging");
    }

    function pointerUp(event) {
      if (!state.drag || event.pointerId !== state.drag.pointerId) return;
      document.removeEventListener("pointermove", pointerMove);
      document.removeEventListener("pointerup", pointerUp);
      document.removeEventListener("pointercancel", pointerUp);
      try {
        state.track.releasePointerCapture?.(event.pointerId);
      } catch {
        // The browser may already have released this pointer.
      }
      state.drag = null;
      state.pendingReason = null;
      state.element.classList.remove("is-dragging");
      state.element
        .querySelectorAll(".is-active")
        .forEach((marker) => marker.classList.remove("is-active"));
      core.toolbar.card.classList.remove("editra-ruler-adjusting");
      state.tabStops.sort((a, b) => a - b);
      render(core, state);
      core.recordHistory();
      core.scheduleUpdate("ruler-content-change", () => core.emitChange());
      notify(core, state, "drag");
    }

    function doubleClick(event) {
      const tab = event.target.closest("[data-tab-stop]");
      if (tab) removeTabStop(core, state, Number(tab.dataset.tabStop));
    }

    function pageChange() {
      scheduleRender(core, state);
    }

    state.element.addEventListener("pointerdown", pointerDown);
    state.element.addEventListener("dblclick", doubleClick);
    core.editor.addEventListener("editra:pageChange", pageChange);
    return () => {
      state.element.removeEventListener("pointerdown", pointerDown);
      state.element.removeEventListener("dblclick", doubleClick);
      core.editor.removeEventListener("editra:pageChange", pageChange);
      document.removeEventListener("pointermove", pointerMove);
      document.removeEventListener("pointerup", pointerUp);
      document.removeEventListener("pointercancel", pointerUp);
      core.toolbar.card.classList.remove("editra-ruler-adjusting");
    };
  }

  async function rulerStressTest(core, options = {}) {
    const adjustments = Math.max(100, Number(options.adjustments) || 2000);
    const state = installations.get(core);
    const startedAt = performance.now();
    for (let start = 0; start < adjustments; start += 100) {
      const end = Math.min(start + 100, adjustments);
      for (let index = start; index < end; index += 1) {
        state.leftMargin = 40 + (index % 40);
        state.leftIndent = index % 24;
      }
      render(core, state);
      if (end < adjustments) {
        await new Promise((resolve) => requestAnimationFrame(resolve));
      }
    }
    return {
      adjustments,
      durationMs: Math.round((performance.now() - startedAt) * 100) / 100,
      state: { ...core.state.ruler },
    };
  }

  function install(core) {
    if (installations.has(core)) return installations.get(core);
    const state = initialState(core);
    createRuler(core, state);
    const unbind = bindInteractions(core, state);
    render(core, state);
    core.toolbar.card.classList.toggle("editra-show-ruler", state.visible);
    const handlers = {
      toggleRuler: (options) => toggleRuler(core, state, options),
      setRulerMargins: (options, value) =>
        setRulerMargins(core, state, options, value),
      setIndent: (options, value) => setIndent(core, state, options, value),
      setTabStop: (options) => setTabStop(core, state, options),
      removeTabStop: (options) => removeTabStop(core, state, options),
      rulerStressTest: (options) => rulerStressTest(core, options),
    };
    state.unregister = Object.entries(handlers).map(([name, handler]) =>
      core.registerCommand(name, handler, {
        plugin: "ruler",
        source: "plugin",
      }),
    );
    core.registerCleanup(() => {
      if (state.frameId !== null) cancelAnimationFrame(state.frameId);
      unbind();
      state.unregister.forEach((remove) => remove());
      state.element.remove();
      installations.delete(core);
    });
    installations.set(core, state);
    return state;
  }

  function RulerPlugin(core, options) {
    const state = install(core);
    return toggleRuler(core, state, options);
  }

  RulerPlugin.install = install;
  RulerPlugin.hydrate = install;
  RulerPlugin.plugin = Object.freeze({
    name: "ruler",
    label: "Document ruler",
    command: "toggleRuler",
  });
  global.RulerPlugin = RulerPlugin;
  (global.EditraPlugins ??= Object.create(null)).ruler = RulerPlugin;
})(window);
