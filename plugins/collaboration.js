/**
 * Product: Editra
 * Author: Editra Team
 * Version: 1.17.0
 * Purpose: Implements the Editra collaboration plugin and its editor commands.
 * Licensing: MIT License (open source)
 */

(function (global) {
  "use strict";

  const installations = new WeakMap();
  const BLOCK_SELECTOR = ":scope > [data-editra-block-id]";
  const TRACKED_SELECTOR =
    "ins.editra-change-insert, del.editra-change-delete, .editra-change-format";

  function nextFrame() {
    return new Promise((resolve) => requestAnimationFrame(resolve));
  }

  function createId(prefix = "id") {
    return `${prefix}-${Date.now().toString(36)}-${crypto
      .getRandomValues(new Uint32Array(2))
      .join("-")}`;
  }

  function stableHash(value) {
    let hash = 2166136261;
    for (let index = 0; index < value.length; index += 1) {
      hash ^= value.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(36);
  }

  function safeText(value) {
    return String(value ?? "").trim();
  }

  function textFromHTML(core, html) {
    const template = document.createElement("template");
    template.innerHTML = core.security.trustedHTML(
      html,
      "collaboration message",
    );
    return template.content.textContent ?? "";
  }

  function authorOf(state, options = {}) {
    return {
      id: safeText(options.author?.id || state.user.id || state.clientId),
      name: safeText(options.author?.name || state.user.name || "Guest"),
      color: safeText(options.author?.color || state.user.color || "#7357d6"),
    };
  }

  function selectionRange(core, allowCollapsed = false) {
    core.restoreSelection();
    const selection = global.getSelection();
    if (!selection?.rangeCount) return null;
    const range = selection.getRangeAt(0);
    if (
      !core.isRangeInside(range) ||
      (!allowCollapsed && range.collapsed)
    ) {
      return null;
    }
    return range;
  }

  function placeAfter(core, node) {
    const range = document.createRange();
    range.setStartAfter(node);
    range.collapse(true);
    const selection = global.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
    core.selection = range.cloneRange();
  }

  function queueCollaborationMutation(core, state) {
    core.recordHistory();
    core.scheduleUpdate("collaboration-change", () => core.emitChange());
    if (state.connection && !state.applyingRemote) {
      core.scheduleUpdate("collaboration-local", () =>
        syncLocalBlocks(core, state),
      );
    }
    clearTimeout(state.revisionTimer);
    state.revisionTimer = global.setTimeout(
      () => captureRevision(core, state),
      700,
    );
  }

  function markChange(node, state, kind, detail = "") {
    const author = authorOf(state);
    node.classList.add(`editra-change-${kind}`);
    node.dataset.editraChange = kind;
    node.dataset.changeId = createId("change");
    node.dataset.authorId = author.id;
    node.dataset.authorName = author.name;
    node.dataset.changedAt = new Date().toISOString();
    if (detail) node.dataset.changeDetail = detail;
    node.title = `${kind[0].toUpperCase()}${kind.slice(1)} by ${author.name}`;
    return node;
  }

  function insertTrackedText(core, state, text) {
    const range = selectionRange(core, true);
    if (!range) return false;
    if (!range.collapsed) trackDeletion(core, state, range);
    const activeRange = selectionRange(core, true);
    const node = markChange(document.createElement("ins"), state, "insert");
    node.textContent = text;
    activeRange.insertNode(node);
    placeAfter(core, node);
    queueCollaborationMutation(core, state);
    return true;
  }

  function expandCollapsedDeletion(range, direction) {
    const selection = global.getSelection();
    if (typeof selection.modify !== "function") return null;
    selection.removeAllRanges();
    selection.addRange(range);
    selection.modify(
      "extend",
      direction === "forward" ? "forward" : "backward",
      "character",
    );
    return selection.rangeCount ? selection.getRangeAt(0).cloneRange() : null;
  }

  function trackDeletion(core, state, suppliedRange, direction = "backward") {
    let range = suppliedRange ?? selectionRange(core, true);
    if (!range) return false;
    if (range.collapsed) range = expandCollapsedDeletion(range, direction);
    if (!range || range.collapsed || !core.isRangeInside(range)) return false;

    const node = markChange(document.createElement("del"), state, "delete");
    node.contentEditable = "false";
    node.append(range.extractContents());
    range.insertNode(node);
    placeAfter(core, node);
    queueCollaborationMutation(core, state);
    return true;
  }

  function trackFormat(core, state, inputType) {
    const range = selectionRange(core);
    if (!range) return false;
    const formats = {
      formatBold: ["bold", "fontWeight", "700"],
      formatItalic: ["italic", "fontStyle", "italic"],
      formatUnderline: ["underline", "textDecoration", "underline"],
      formatStrikeThrough: ["strikethrough", "textDecoration", "line-through"],
    };
    const format = formats[inputType];
    if (!format) return false;
    const node = markChange(
      document.createElement("span"),
      state,
      "format",
      format[0],
    );
    node.style[format[1]] = format[2];
    node.append(range.extractContents());
    range.insertNode(node);
    const selected = document.createRange();
    selected.selectNodeContents(node);
    const selection = global.getSelection();
    selection.removeAllRanges();
    selection.addRange(selected);
    core.selection = selected.cloneRange();
    queueCollaborationMutation(core, state);
    return true;
  }

  function updateTrackingUI(core, state) {
    core.editor.classList.toggle("editra-track-changes", state.tracking);
    core.editor.dataset.trackChanges = String(state.tracking);
    core.state.trackChanges = state.tracking;
    const button = core.toolbar.getButton("trackChanges");
    button?.classList.toggle("is-active", state.tracking);
    button?.setAttribute("aria-pressed", String(state.tracking));
    core.scheduleUpdate("collaboration-state", () =>
      core.emitState({ trackChanges: state.tracking }),
    );
  }

  function toggleTrackChanges(core, state, options = {}) {
    state.tracking =
      typeof options.enabled === "boolean" ? options.enabled : !state.tracking;
    updateTrackingUI(core, state);
    return state.tracking;
  }

  function finalizeChanges(core, state, accept) {
    const changes = [...core.editor.querySelectorAll(TRACKED_SELECTOR)];
    let count = 0;
    changes.forEach((node) => {
      const kind = node.dataset.editraChange;
      if ((kind === "insert" && accept) || (kind === "delete" && !accept)) {
        node.replaceWith(...node.childNodes);
      } else if ((kind === "insert" && !accept) || (kind === "delete" && accept)) {
        node.remove();
      } else if (kind === "format" && accept) {
        node.classList.remove("editra-change-format");
        delete node.dataset.editraChange;
        delete node.dataset.changeDetail;
      } else {
        node.replaceWith(...node.childNodes);
      }
      count += 1;
    });
    if (count) {
      queueCollaborationMutation(core, state);
    }
    return count;
  }

  function wrapCommentSelection(core, state, comment, options = {}) {
    const range = selectionRange(core);
    if (!range) return false;
    const id = options.id || createId("comment");
    const author = authorOf(state, options);
    const marker = document.createElement("mark");
    marker.className = "editra-comment-anchor";
    marker.dataset.commentId = id;
    marker.tabIndex = 0;
    marker.append(range.extractContents());
    range.insertNode(marker);
    placeAfter(core, marker);

    state.comments.set(id, {
      id,
      text: safeText(comment),
      quote: safeText(marker.textContent),
      author,
      createdAt: new Date().toISOString(),
      resolved: false,
      replies: [],
    });
    state.showComments = true;
    core.toolbar.card.classList.add("editra-comments-visible");
    sendMessage(state, {
      type: "comment",
      thread: state.comments.get(id),
    });
    renderComments(core, state);
    queueCollaborationMutation(core, state);
    return id;
  }

  function openCommentComposer(core, state, options = {}) {
    const range = selectionRange(core);
    if (!range) {
      showNotice(core, state, "Select text before adding a comment.");
      return false;
    }
    state.composer?.dispatchEvent(new CustomEvent("editra:close"));
    const box = document.createElement("form");
    box.className = "editra-comment-composer";
    box.dataset.editraUi = "true";
    box.setAttribute("aria-label", "Add comment");
    box.innerHTML = `
      <label>Add comment
        <textarea rows="3" placeholder="Write a comment…" required></textarea>
      </label>
      <div>
        <button type="button" data-comment-cancel>Cancel</button>
        <button type="submit">Comment</button>
      </div>
    `;
    core.toolbar.card.append(box);
    let unregister = () => {};
    let closed = false;

    function close() {
      if (closed) return;
      closed = true;
      box.removeEventListener("submit", submit);
      box.removeEventListener("click", click);
      box.removeEventListener("editra:close", close);
      box.remove();
      state.composer = null;
      unregister();
    }
    function submit(event) {
      event.preventDefault();
      const text = safeText(box.querySelector("textarea").value);
      if (!text) return;
      core.selection = range.cloneRange();
      wrapCommentSelection(core, state, text, options);
      close();
    }
    function click(event) {
      if (event.target.closest("[data-comment-cancel]")) close();
    }

    box.addEventListener("submit", submit);
    box.addEventListener("click", click);
    box.addEventListener("editra:close", close);
    unregister = core.registerCleanup(close);
    state.composer = box;
    box.querySelector("textarea").focus({ preventScroll: true });
    return box;
  }

  function addComment(core, state, options = {}) {
    const text = safeText(options.comment || options.text);
    return text
      ? wrapCommentSelection(core, state, text, options)
      : openCommentComposer(core, state, options);
  }

  function showNotice(core, state, message) {
    state.notice?.remove();
    const notice = document.createElement("div");
    notice.className = "editra-collaboration-notice";
    notice.dataset.editraUi = "true";
    notice.textContent = message;
    core.toolbar.card.append(notice);
    state.notice = notice;
    global.setTimeout(() => {
      if (state.notice === notice) state.notice = null;
      notice.remove();
    }, 2400);
  }

  function createCommentsSidebar(core, state) {
    if (state.sidebar?.isConnected) return state.sidebar;
    const sidebar = document.createElement("aside");
    sidebar.className = "editra-comments-sidebar";
    sidebar.dataset.editraUi = "true";
    sidebar.setAttribute("aria-label", "Document comments");
    sidebar.innerHTML = `
      <header>
        <strong>Comments</strong>
        <button type="button" data-comments-close aria-label="Hide comments">×</button>
      </header>
      <div class="editra-comment-list"></div>
    `;
    core.toolbar.card.append(sidebar);
    sidebar.addEventListener("click", state.handleSidebarClick);
    sidebar.addEventListener("submit", state.handleSidebarSubmit);
    state.sidebar = sidebar;
    return sidebar;
  }

  function renderComments(core, state) {
    if (!state.showComments) return;
    const sidebar = createCommentsSidebar(core, state);
    const list = sidebar.querySelector(".editra-comment-list");
    const fragment = document.createDocumentFragment();
    [...state.comments.values()].forEach((thread) => {
      const card = document.createElement("article");
      card.className = "editra-comment-thread";
      card.dataset.commentThread = thread.id;
      card.classList.toggle("is-resolved", thread.resolved);
      const title = document.createElement("div");
      title.className = "editra-comment-meta";
      title.textContent = `${thread.author.name} · ${new Date(
        thread.createdAt,
      ).toLocaleString()}`;
      const quote = document.createElement("blockquote");
      quote.textContent = thread.quote;
      const body = document.createElement("p");
      body.textContent = thread.text;
      card.append(title, quote, body);
      thread.replies.forEach((reply) => {
        const replyNode = document.createElement("div");
        replyNode.className = "editra-comment-reply";
        const strong = document.createElement("strong");
        strong.textContent = reply.author.name;
        replyNode.append(strong, document.createTextNode(` ${reply.text}`));
        card.append(replyNode);
      });
      const form = document.createElement("form");
      form.className = "editra-comment-reply-form";
      form.innerHTML = `
        <input name="reply" aria-label="Reply" placeholder="Reply…" required>
        <button type="submit">Reply</button>
        <button type="button" data-resolve-comment>
          ${thread.resolved ? "Reopen" : "Resolve"}
        </button>
      `;
      card.append(form);
      fragment.append(card);
    });
    if (!fragment.childNodes.length) {
      const empty = document.createElement("p");
      empty.className = "editra-comments-empty";
      empty.textContent = "No comments yet.";
      fragment.append(empty);
    }
    core.scheduleUpdate("comments-render", () => list.replaceChildren(fragment));
  }

  function toggleComments(core, state, options = {}) {
    state.showComments =
      typeof options.visible === "boolean"
        ? options.visible
        : !state.showComments;
    core.toolbar.card.classList.toggle(
      "editra-comments-visible",
      state.showComments,
    );
    if (state.showComments) renderComments(core, state);
    else state.sidebar?.remove();
    return state.showComments;
  }

  function replyComment(core, state, options = {}) {
    const thread = state.comments.get(options.id);
    const text = safeText(options.text);
    if (!thread || !text) return false;
    thread.replies.push({
      id: createId("reply"),
      text,
      author: authorOf(state, options),
      createdAt: new Date().toISOString(),
    });
    sendMessage(state, { type: "comment", thread });
    renderComments(core, state);
    return true;
  }

  function resolveComment(core, state, options = {}) {
    const thread = state.comments.get(options.id);
    if (!thread) return false;
    thread.resolved =
      typeof options.resolved === "boolean"
        ? options.resolved
        : !thread.resolved;
    core.editor
      .querySelectorAll(`[data-comment-id="${CSS.escape(thread.id)}"]`)
      .forEach((anchor) =>
        anchor.classList.toggle("is-resolved", thread.resolved),
      );
    sendMessage(state, { type: "comment", thread });
    queueCollaborationMutation(core, state);
    renderComments(core, state);
    return thread.resolved;
  }

  function captureRevision(core, state, options = {}) {
    const html = core.editor.innerHTML;
    if (!options.force && html === state.lastRevisionHTML) return false;
    const author = authorOf(state, options);
    const revision = {
      id: createId("revision"),
      html,
      text: core.editor.textContent ?? "",
      author,
      label:
        safeText(options.label) ||
        `Version ${state.revisions.length + 1}`,
      createdAt: new Date().toISOString(),
    };
    state.revisions.push(revision);
    if (state.revisions.length > state.revisionLimit) state.revisions.shift();
    state.lastRevisionHTML = html;
    return revision;
  }

  function revisionDifference(currentText, revisionText) {
    let prefix = 0;
    while (
      prefix < currentText.length &&
      prefix < revisionText.length &&
      currentText[prefix] === revisionText[prefix]
    ) {
      prefix += 1;
    }
    let suffix = 0;
    while (
      suffix < currentText.length - prefix &&
      suffix < revisionText.length - prefix &&
      currentText[currentText.length - 1 - suffix] ===
        revisionText[revisionText.length - 1 - suffix]
    ) {
      suffix += 1;
    }
    return {
      added: Math.max(0, currentText.length - prefix - suffix),
      removed: Math.max(0, revisionText.length - prefix - suffix),
    };
  }

  function openRevisionHistory(core, state) {
    captureRevision(core, state);
    state.revisionOverlay?.dispatchEvent(new CustomEvent("editra:close"));
    const overlay = document.createElement("div");
    overlay.className = "editra-revision-overlay";
    overlay.dataset.editraUi = "true";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-label", "Revision history");
    const currentText = core.editor.textContent ?? "";
    const heading = document.createElement("header");
    heading.innerHTML =
      "<strong>Revision History</strong><button type=\"button\" data-revision-close aria-label=\"Close\">×</button>";
    const list = document.createElement("div");
    list.className = "editra-revision-list";
    [...state.revisions].reverse().forEach((revision, index) => {
      const difference = revisionDifference(currentText, revision.text);
      const item = document.createElement("article");
      item.className = "editra-revision-item";
      item.dataset.revisionId = revision.id;
      const name = document.createElement("strong");
      name.textContent =
        index === 0 ? `${revision.label} (current)` : revision.label;
      const meta = document.createElement("span");
      meta.textContent = `${revision.author.name} · ${new Date(
        revision.createdAt,
      ).toLocaleString()}`;
      const comparison = document.createElement("small");
      comparison.textContent = `${difference.added} added · ${difference.removed} removed`;
      const actions = document.createElement("div");
      actions.innerHTML =
        '<button type="button" data-revision-preview>Compare</button><button type="button" data-revision-restore>Restore</button>';
      item.append(name, meta, comparison, actions);
      list.append(item);
    });
    const preview = document.createElement("div");
    preview.className = "editra-revision-preview";
    preview.textContent = "Choose Compare to preview a version.";
    overlay.append(heading, list, preview);
    core.toolbar.card.append(overlay);
    let unregister = () => {};
    let closed = false;

    function close() {
      if (closed) return;
      closed = true;
      overlay.removeEventListener("click", click);
      overlay.removeEventListener("editra:close", close);
      overlay.remove();
      state.revisionOverlay = null;
      unregister();
    }
    function click(event) {
      if (event.target.closest("[data-revision-close]")) return close();
      const item = event.target.closest("[data-revision-id]");
      if (!item) return;
      const revision = state.revisions.find(
        (entry) => entry.id === item.dataset.revisionId,
      );
      if (!revision) return;
      if (event.target.closest("[data-revision-preview]")) {
        const frame = document.createElement("div");
        frame.className = "editra-revision-document";
        frame.innerHTML = core.security.trustedHTML(
          revision.html,
          "revision preview",
        );
        preview.replaceChildren(frame);
      } else if (event.target.closest("[data-revision-restore]")) {
        restoreRevision(core, state, { id: revision.id });
        close();
      }
    }
    overlay.addEventListener("click", click);
    overlay.addEventListener("editra:close", close);
    unregister = core.registerCleanup(close);
    state.revisionOverlay = overlay;
    return overlay;
  }

  function restoreRevision(core, state, options = {}) {
    const revision =
      state.revisions.find((entry) => entry.id === options.id) ??
      state.revisions[Number(options.index)];
    if (!revision) return false;
    captureRevision(core, state, { force: true, label: "Before restore" });
    core.setHTML(revision.html);
    state.lastRevisionHTML = revision.html;
    return true;
  }

  function ensureBlocks(core, state) {
    if (!core.editor.children.length && core.editor.textContent) {
      const paragraph = document.createElement("p");
      paragraph.textContent = core.editor.textContent;
      core.editor.replaceChildren(paragraph);
    }
    [...core.editor.children].forEach((block, index) => {
      if (!block.dataset.editraBlockId) {
        block.dataset.editraBlockId = state.blocksInitialized
          ? createId("block")
          : `block-${index}-${stableHash(block.outerHTML)}`;
      }
      if (!state.blockVersions.has(block.dataset.editraBlockId)) {
        state.blockVersions.set(block.dataset.editraBlockId, {
          clock: 0,
          clientId: state.clientId,
        });
      }
      if (!state.blockPositions.has(block.dataset.editraBlockId)) {
        state.blockPositions.set(block.dataset.editraBlockId, index);
      }
    });
    state.blocksInitialized = true;
  }

  function newerVersion(incoming, existing) {
    if (!existing) return true;
    if (incoming.clock !== existing.clock) return incoming.clock > existing.clock;
    return incoming.clientId > existing.clientId;
  }

  function snapshotBlocks(core, state) {
    ensureBlocks(core, state);
    return [...core.editor.querySelectorAll(BLOCK_SELECTOR)].map(
      (block, index) => ({
        id: block.dataset.editraBlockId,
        index,
        html: block.outerHTML,
      }),
    );
  }

  function sendMessage(state, message) {
    if (!state.connection) return false;
    const payload = {
      ...message,
      documentId: state.documentId,
      clientId: state.clientId,
      user: state.user,
    };
    state.connection.send(payload);
    return true;
  }

  function syncLocalBlocks(core, state) {
    if (!state.connection || state.applyingRemote) return;
    const blocks = snapshotBlocks(core, state);
    const current = new Map(blocks.map((block) => [block.id, block]));
    const operations = [];
    blocks.forEach((block) => {
      if (state.blockHTML.get(block.id) === block.html) return;
      state.clock += 1;
      const version = { clock: state.clock, clientId: state.clientId };
      state.blockVersions.set(block.id, version);
      state.blockPositions.set(block.id, block.index);
      state.blockHTML.set(block.id, block.html);
      operations.push({ ...block, version, deleted: false });
    });
    state.blockHTML.forEach((html, id) => {
      if (current.has(id)) return;
      state.clock += 1;
      const version = { clock: state.clock, clientId: state.clientId };
      state.blockVersions.set(id, version);
      state.blockPositions.delete(id);
      state.blockHTML.delete(id);
      operations.push({ id, version, deleted: true });
    });
    if (operations.length) {
      sendMessage(state, { type: "operations", operations });
    }
  }

  function parseBlock(core, html) {
    const template = document.createElement("template");
    template.innerHTML = core.security.trustedHTML(
      html,
      "collaboration operation",
    );
    return template.content.firstElementChild;
  }

  function applyRemoteOperations(core, state, operations) {
    const accepted = operations.filter((operation) =>
      newerVersion(operation.version, state.blockVersions.get(operation.id)),
    );
    if (!accepted.length) return false;
    state.applyingRemote = true;
    core.scheduleUpdate("collaboration-remote", () => {
      accepted
        .sort((a, b) => (a.index ?? 0) - (b.index ?? 0))
        .forEach((operation) => {
          state.clock = Math.max(state.clock, operation.version.clock);
          state.blockVersions.set(operation.id, operation.version);
          const current = core.editor.querySelector(
            `[data-editra-block-id="${CSS.escape(operation.id)}"]`,
          );
          if (operation.deleted) {
            current?.remove();
            state.blockHTML.delete(operation.id);
            state.blockPositions.delete(operation.id);
            return;
          }
          const incoming = parseBlock(core, operation.html);
          if (!incoming) return;
          incoming.dataset.editraBlockId = operation.id;
          if (current) current.replaceWith(incoming);
          else {
            const reference = core.editor.children[operation.index] ?? null;
            core.editor.insertBefore(incoming, reference);
          }
          state.blockHTML.set(operation.id, incoming.outerHTML);
          state.blockPositions.set(operation.id, operation.index ?? 0);
        });
      [...core.editor.children]
        .sort((left, right) => {
          const leftId = left.dataset.editraBlockId;
          const rightId = right.dataset.editraBlockId;
          const positionDifference =
            (state.blockPositions.get(leftId) ?? 0) -
            (state.blockPositions.get(rightId) ?? 0);
          if (positionDifference) return positionDifference;
          const leftClient = state.blockVersions.get(leftId)?.clientId ?? "";
          const rightClient = state.blockVersions.get(rightId)?.clientId ?? "";
          return leftClient.localeCompare(rightClient) || leftId.localeCompare(rightId);
        })
        .forEach((block) => core.editor.append(block));
      state.applyingRemote = false;
      core.rehydrate();
      core.recordHistory();
      captureRevision(core, state, {
        force: true,
        label: "Collaborative edit",
      });
      core.emitChange();
    });
    return true;
  }

  function nodePath(root, node) {
    const path = [];
    let current = node;
    while (current && current !== root) {
      const parent = current.parentNode;
      if (!parent) return null;
      path.unshift([...parent.childNodes].indexOf(current));
      current = parent;
    }
    return current === root ? path : null;
  }

  function nodeFromPath(root, path) {
    let node = root;
    for (const index of path ?? []) {
      node = node?.childNodes[index];
      if (!node) return null;
    }
    return node;
  }

  function localCursor(core, state) {
    const selection = global.getSelection();
    if (!selection?.rangeCount) return null;
    const range = selection.getRangeAt(0);
    if (!core.isRangeInside(range)) return null;
    return {
      anchorPath: nodePath(core.editor, range.startContainer),
      anchorOffset: range.startOffset,
      focusPath: nodePath(core.editor, range.endContainer),
      focusOffset: range.endOffset,
    };
  }

  function cursorRange(core, cursor) {
    const start = nodeFromPath(core.editor, cursor.anchorPath);
    const end = nodeFromPath(core.editor, cursor.focusPath);
    if (!start || !end) return null;
    try {
      const range = document.createRange();
      range.setStart(start, Math.min(cursor.anchorOffset, start.length ?? start.childNodes.length));
      range.setEnd(end, Math.min(cursor.focusOffset, end.length ?? end.childNodes.length));
      return range;
    } catch {
      return null;
    }
  }

  function renderRemoteCursor(core, state, message) {
    const range = cursorRange(core, message.cursor);
    if (!range) return;
    let marker = state.cursorLayer.querySelector(
      `[data-collaborator="${CSS.escape(message.clientId)}"]`,
    );
    if (!marker) {
      marker = document.createElement("span");
      marker.className = "editra-live-cursor";
      marker.dataset.collaborator = message.clientId;
      const label = document.createElement("span");
      label.className = "editra-live-cursor-label";
      marker.append(label);
      state.cursorLayer.append(marker);
    }
    const requestedColor = safeText(message.user?.color) || "#e15361";
    const color = global.CSS?.supports?.("color", requestedColor)
      ? requestedColor
      : "#e15361";
    marker.style.setProperty("--collaborator-color", color);
    marker.firstElementChild.textContent = safeText(message.user?.name) || "Guest";
    const rect = range.getBoundingClientRect();
    const cardRect = core.toolbar.card.getBoundingClientRect();
    marker.style.transform = `translate(${Math.round(
      rect.left - cardRect.left,
    )}px, ${Math.round(rect.top - cardRect.top)}px)`;
    marker.style.height = `${Math.max(18, Math.round(rect.height))}px`;
    marker.hidden = false;

    const highlightName = `editra-selection-${message.clientId.replace(
      /[^a-z0-9_-]/gi,
      "",
    )}`;
    if (
      global.CSS?.highlights &&
      typeof global.Highlight === "function" &&
      !range.collapsed
    ) {
      global.CSS.highlights.set(highlightName, new global.Highlight(range));
      state.highlightColors.set(highlightName, color);
      state.highlightStyle.textContent = [...state.highlightColors]
        .map(
          ([name, value]) =>
            `::highlight(${name}){background:color-mix(in srgb, ${value} 22%, transparent)}`,
        )
        .join("");
      state.highlightNames.add(highlightName);
    }
    state.remoteCursors.set(message.clientId, {
      marker,
      lastSeen: Date.now(),
      highlightName,
    });
  }

  function handleMessage(core, state, message) {
    if (
      !message ||
      message.documentId !== state.documentId ||
      message.clientId === state.clientId
    ) {
      return;
    }
    if (message.type === "hello") {
      sendMessage(state, {
        type: "operations",
        operations: snapshotBlocks(core, state).map((block) => ({
          ...block,
          version: state.blockVersions.get(block.id),
          deleted: false,
        })),
      });
      sendMessage(state, {
        type: "comments",
        threads: [...state.comments.values()],
      });
    } else if (message.type === "operations") {
      applyRemoteOperations(core, state, message.operations ?? []);
    } else if (message.type === "comment" && message.thread?.id) {
      state.comments.set(message.thread.id, message.thread);
      renderComments(core, state);
    } else if (message.type === "comments") {
      (message.threads ?? []).forEach((thread) => {
        if (thread?.id && !state.comments.has(thread.id)) {
          state.comments.set(thread.id, thread);
        }
      });
      renderComments(core, state);
    } else if (message.type === "cursor") {
      core.scheduleUpdate(`cursor-${message.clientId}`, () =>
        renderRemoteCursor(core, state, message),
      );
    } else if (message.type === "leave") {
      removeRemoteCursor(state, message.clientId);
    }
  }

  function removeRemoteCursor(state, clientId) {
    const cursor = state.remoteCursors.get(clientId);
    cursor?.marker.remove();
    if (cursor?.highlightName && global.CSS?.highlights) {
      global.CSS.highlights.delete(cursor.highlightName);
      state.highlightColors.delete(cursor.highlightName);
      state.highlightStyle.textContent = [...state.highlightColors]
        .map(
          ([name, value]) =>
            `::highlight(${name}){background:color-mix(in srgb, ${value} 22%, transparent)}`,
        )
        .join("");
    }
    state.remoteCursors.delete(clientId);
  }

  function createConnection(state, options, onMessage) {
    if (options.transport) {
      const unsubscribe = options.transport.subscribe(onMessage);
      return {
        send: (message) => options.transport.send(message),
        close: () => unsubscribe?.(),
      };
    }
    if (options.url) {
      const socket = new WebSocket(options.url);
      const receive = (event) => {
        try {
          onMessage(JSON.parse(event.data));
        } catch {
          // Ignore malformed collaboration packets.
        }
      };
      socket.addEventListener("message", receive);
      return {
        send(message) {
          const payload = JSON.stringify(message);
          if (socket.readyState === WebSocket.OPEN) socket.send(payload);
          else socket.addEventListener("open", () => socket.send(payload), {
            once: true,
          });
        },
        close() {
          socket.removeEventListener("message", receive);
          socket.close();
        },
      };
    }
    if (!("BroadcastChannel" in global)) {
      throw new Error("No collaboration transport is available.");
    }
    const channel = new BroadcastChannel(
      `editra:${options.documentId || state.documentId}`,
    );
    channel.addEventListener("message", (event) => onMessage(event.data));
    return {
      send: (message) => channel.postMessage(message),
      close: () => channel.close(),
    };
  }

  function connectCollaboration(core, state, options = {}) {
    disconnectCollaboration(core, state);
    state.documentId = safeText(options.documentId) || "default";
    state.user = {
      id: safeText(options.user?.id) || state.clientId,
      name: safeText(options.user?.name) || "Guest",
      color: safeText(options.user?.color) || "#7357d6",
    };
    ensureBlocks(core, state);
    snapshotBlocks(core, state).forEach((block) =>
      state.blockHTML.set(block.id, block.html),
    );
    state.connection = createConnection(state, options, (message) =>
      handleMessage(core, state, message),
    );
    core.toolbar.card.classList.add("editra-collaboration-connected");
    sendMessage(state, { type: "hello" });
    return {
      clientId: state.clientId,
      documentId: state.documentId,
      disconnect: () => disconnectCollaboration(core, state),
    };
  }

  function disconnectCollaboration(core, state) {
    if (!state.connection) return false;
    sendMessage(state, { type: "leave" });
    state.connection.close();
    state.connection = null;
    state.remoteCursors.forEach((_, id) => removeRemoteCursor(state, id));
    state.cursorLayer.replaceChildren();
    core.toolbar.card.classList.remove("editra-collaboration-connected");
    return true;
  }

  async function collaborationStressTest(core, options = {}) {
    const collaborators = Math.max(2, Number(options.collaborators) || 8);
    const blocks = Math.max(100, Number(options.blocks) || 1000);
    const operations = Math.max(1000, Number(options.operations) || 10000);
    const replicas = Array.from({ length: collaborators }, () => new Map());
    const generated = [];
    const startedAt = performance.now();
    for (let index = 0; index < operations; index += 1) {
      const clientId = `client-${index % collaborators}`;
      generated.push({
        id: `block-${index % blocks}`,
        value: `Edit ${index}`,
        version: { clock: Math.floor(index / collaborators) + 1, clientId },
      });
      if (index && index % 1000 === 0) await nextFrame();
    }
    for (let replicaIndex = 0; replicaIndex < replicas.length; replicaIndex += 1) {
      const replica = replicas[replicaIndex];
      const stream =
        replicaIndex % 2 ? [...generated].reverse() : generated;
      for (let index = 0; index < stream.length; index += 1) {
        const operation = stream[index];
        const current = replica.get(operation.id);
        if (!current || newerVersion(operation.version, current.version)) {
          replica.set(operation.id, operation);
        }
        if (index && index % 2000 === 0) await nextFrame();
      }
    }
    const signatures = replicas.map((replica) =>
      [...replica.values()]
        .sort((a, b) => a.id.localeCompare(b.id))
        .map((entry) => `${entry.id}:${entry.version.clock}:${entry.version.clientId}`)
        .join("|"),
    );
    return {
      collaborators,
      blocks,
      operations,
      converged: signatures.every((value) => value === signatures[0]),
      durationMs: Math.round(performance.now() - startedAt),
    };
  }

  function install(core) {
    if (installations.has(core)) return installations.get(core);
    const state = {
      clientId: createId("client"),
      user: { id: "", name: "Guest", color: "#7357d6" },
      tracking: false,
      showComments: false,
      comments: new Map(),
      revisions: [],
      revisionLimit: Math.max(
        10,
        Number(core.options.collaboration?.revisionLimit) || 50,
      ),
      lastRevisionHTML: "",
      revisionTimer: null,
      composer: null,
      sidebar: null,
      revisionOverlay: null,
      notice: null,
      connection: null,
      documentId: "default",
      clock: 0,
      blockVersions: new Map(),
      blockPositions: new Map(),
      blockHTML: new Map(),
      blocksInitialized: false,
      applyingRemote: false,
      remoteCursors: new Map(),
      highlightNames: new Set(),
      highlightColors: new Map(),
      unregisterCommands: [],
      restoreFormatCommands: [],
    };
    const cursorLayer = document.createElement("div");
    cursorLayer.className = "editra-live-cursors";
    cursorLayer.dataset.editraUi = "true";
    core.toolbar.card.append(cursorLayer);
    state.cursorLayer = cursorLayer;
    const highlightStyle = document.createElement("style");
    highlightStyle.dataset.editraUi = "true";
    document.head.append(highlightStyle);
    state.highlightStyle = highlightStyle;

    state.handleSidebarClick = (event) => {
      if (event.target.closest("[data-comments-close]")) {
        toggleComments(core, state, { visible: false });
        return;
      }
      const threadNode = event.target.closest("[data-comment-thread]");
      if (!threadNode) return;
      const id = threadNode.dataset.commentThread;
      if (event.target.closest("[data-resolve-comment]")) {
        resolveComment(core, state, { id });
        return;
      }
      const anchor = core.editor.querySelector(
        `[data-comment-id="${CSS.escape(id)}"]`,
      );
      anchor?.scrollIntoView({ block: "center", behavior: "smooth" });
      anchor?.classList.add("is-focused");
      global.setTimeout(() => anchor?.classList.remove("is-focused"), 1200);
    };
    state.handleSidebarSubmit = (event) => {
      event.preventDefault();
      const threadNode = event.target.closest("[data-comment-thread]");
      const input = event.target.elements?.reply;
      if (!threadNode || !input) return;
      if (replyComment(core, state, {
        id: threadNode.dataset.commentThread,
        text: input.value,
      })) {
        input.value = "";
      }
    };

    const commands = {
      trackChanges: (options) => toggleTrackChanges(core, state, options),
      addComment: (options) => addComment(core, state, options),
      showComments: (options) => toggleComments(core, state, options),
      replyComment: (options) => replyComment(core, state, options),
      resolveComment: (options) => resolveComment(core, state, options),
      viewRevisionHistory: () => openRevisionHistory(core, state),
      restoreRevision: (options) => restoreRevision(core, state, options),
      connectCollaboration: (options) =>
        connectCollaboration(core, state, options),
      disconnectCollaboration: () => disconnectCollaboration(core, state),
      collaborationStressTest: (options) =>
        collaborationStressTest(core, options),
      acceptAllChanges: () => finalizeChanges(core, state, true),
      rejectAllChanges: () => finalizeChanges(core, state, false),
    };
    Object.entries(commands).forEach(([name, handler]) => {
      state.unregisterCommands.push(
        core.registerCommand(name, handler, {
          plugin: "collaboration",
          source: "plugin",
        }),
      );
    });
    const formatInputTypes = {
      bold: "formatBold",
      italic: "formatItalic",
      underline: "formatUnderline",
    };
    Object.entries(formatInputTypes).forEach(([name, inputType]) => {
      const original = core.commands.get(name);
      if (!original) return;
      core.registerCommand(
        name,
        (...args) =>
          state.tracking
            ? trackFormat(core, state, inputType)
            : original.handler(...args),
        { plugin: "collaboration", source: "plugin" },
      );
      state.restoreFormatCommands.push(() => {
        if (core.commands.get(name)?.plugin === "collaboration") {
          core.commands.set(name, original);
        }
      });
    });

    function beforeInput(event) {
      if (!state.tracking || event.isComposing) return;
      if (event.inputType === "insertText" && event.data) {
        event.preventDefault();
        insertTrackedText(core, state, event.data);
      } else if (
        event.inputType === "deleteContentBackward" ||
        event.inputType === "deleteWordBackward"
      ) {
        event.preventDefault();
        trackDeletion(core, state, null, "backward");
      } else if (
        event.inputType === "deleteContentForward" ||
        event.inputType === "deleteWordForward"
      ) {
        event.preventDefault();
        trackDeletion(core, state, null, "forward");
      } else if (event.inputType.startsWith("format")) {
        event.preventDefault();
        trackFormat(core, state, event.inputType);
      }
    }
    function paste(event) {
      if (!state.tracking) return;
      const text = event.clipboardData?.getData("text/plain");
      if (!text) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      insertTrackedText(core, state, text);
    }
    function input() {
      if (state.connection && !state.applyingRemote) {
        core.scheduleUpdate("collaboration-local", () =>
          syncLocalBlocks(core, state),
        );
      }
      clearTimeout(state.revisionTimer);
      state.revisionTimer = global.setTimeout(
        () => captureRevision(core, state),
        700,
      );
    }
    function selectionChange() {
      if (!state.connection) return;
      core.scheduleUpdate("collaboration-cursor", () => {
        const cursor = localCursor(core, state);
        if (cursor) sendMessage(state, { type: "cursor", cursor });
      });
    }
    function anchorClick(event) {
      const anchor = event.target.closest("[data-comment-id]");
      if (!anchor || !core.editor.contains(anchor)) return;
      if (!state.showComments) toggleComments(core, state, { visible: true });
      const thread = state.sidebar?.querySelector(
        `[data-comment-thread="${CSS.escape(anchor.dataset.commentId)}"]`,
      );
      thread?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }

    core.editor.addEventListener("beforeinput", beforeInput);
    core.editor.addEventListener("paste", paste, true);
    core.editor.addEventListener("input", input);
    core.editor.addEventListener("click", anchorClick);
    document.addEventListener("selectionchange", selectionChange);
    core.history.slice(-state.revisionLimit).forEach((html, index) => {
      if (state.revisions.at(-1)?.html === html) return;
      state.revisions.push({
        id: createId("revision"),
        html,
        text: textFromHTML(core, html),
        author: authorOf(state),
        label: index === 0 ? "Initial version" : `Version ${index + 1}`,
        createdAt: new Date(Date.now() - (core.history.length - index) * 1000)
          .toISOString(),
      });
    });
    state.lastRevisionHTML =
      state.revisions.at(-1)?.html ?? core.editor.innerHTML;
    updateTrackingUI(core, state);
    renderComments(core, state);

    core.registerCleanup(() => {
      disconnectCollaboration(core, state);
      clearTimeout(state.revisionTimer);
      core.editor.removeEventListener("beforeinput", beforeInput);
      core.editor.removeEventListener("paste", paste, true);
      core.editor.removeEventListener("input", input);
      core.editor.removeEventListener("click", anchorClick);
      document.removeEventListener("selectionchange", selectionChange);
      state.composer?.dispatchEvent(new CustomEvent("editra:close"));
      state.revisionOverlay?.dispatchEvent(new CustomEvent("editra:close"));
      state.sidebar?.removeEventListener("click", state.handleSidebarClick);
      state.sidebar?.removeEventListener("submit", state.handleSidebarSubmit);
      state.sidebar?.remove();
      state.notice?.remove();
      state.cursorLayer.remove();
      state.highlightNames.forEach((name) => global.CSS?.highlights?.delete(name));
      state.highlightStyle.remove();
      state.unregisterCommands.forEach((unregister) => unregister());
      state.restoreFormatCommands.forEach((restore) => restore());
      state.comments.clear();
      state.revisions.length = 0;
      state.blockVersions.clear();
      state.blockPositions.clear();
      state.blockHTML.clear();
      installations.delete(core);
    });

    installations.set(core, state);
    return state;
  }

  function CollaborationPlugin(core, options) {
    const state = install(core);
    return toggleTrackChanges(core, state, options);
  }

  CollaborationPlugin.install = install;
  CollaborationPlugin.hydrate = function hydrate(core) {
    const state = install(core);
    core.editor.querySelectorAll("[data-comment-id]").forEach((anchor) => {
      const id = anchor.dataset.commentId;
      if (!state.comments.has(id)) {
        state.comments.set(id, {
          id,
          text: "Imported comment",
          quote: safeText(anchor.textContent),
          author: authorOf(state),
          createdAt: new Date().toISOString(),
          resolved: anchor.classList.contains("is-resolved"),
          replies: [],
        });
      }
    });
    renderComments(core, state);
  };
  CollaborationPlugin.plugin = Object.freeze({
    name: "collaboration",
    label: "Track changes",
    icon: "trackChanges",
    command: "trackChanges",
    toolbarItems: [
      {
        name: "trackChanges",
        command: "trackChanges",
        label: "Track changes",
        icon: "trackChanges",
      },
      {
        name: "addComment",
        command: "addComment",
        label: "Add comment",
        icon: "comment",
      },
    ],
  });

  global.CollaborationPlugin = CollaborationPlugin;
  (global.EditraPlugins ??= Object.create(null)).collaboration =
    CollaborationPlugin;
})(window);
