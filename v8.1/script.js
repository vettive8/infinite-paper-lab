(function () {
  const viewport = document.getElementById("viewport");
  const paper = document.getElementById("paper");
  const findBar = document.getElementById("find-bar");
  const findInput = document.getElementById("find-input");
  const findCount = document.getElementById("find-count");
  const findPrev = document.getElementById("find-prev");
  const findNext = document.getElementById("find-next");
  const findClose = document.getElementById("find-close");
  const selectionBox = document.getElementById("selection-box");
  const boardStorageKey = "infinite-paper:v8.1:board";
  const viewStorageKey = "infinite-paper:v8.1:view";
  const syncChannelName = "infinite-paper:v8.1:sync";
  const panThreshold = 5;
  const snapDistance = 8;
  const clientId = makeId();
  const syncChannel = "BroadcastChannel" in window ? new BroadcastChannel(syncChannelName) : null;

  let notes = [];
  let activeDrag = null;
  let spaceDown = false;
  let noteSaveTimer = 0;
  let viewSaveTimer = 0;
  let boardRevision = 0;
  let dirtyNoteIds = new Set();
  let selectedNoteIds = new Set();
  let view = {
    x: Math.round(window.innerWidth / 2),
    y: Math.round(window.innerHeight / 2),
    scale: 1,
  };
  let findState = {
    query: "",
    matches: [],
    activeIndex: -1,
    hasJumped: false,
  };

  function loadState() {
    try {
      const savedBoard = JSON.parse(localStorage.getItem(boardStorageKey) || "{}");
      notes = normalizeNotes(savedBoard.notes);
      boardRevision = Number(savedBoard.revision) || 0;
    } catch {
      notes = [];
      boardRevision = 0;
    }

    try {
      const savedView = JSON.parse(sessionStorage.getItem(viewStorageKey) || "{}");
      if (savedView && Number.isFinite(savedView.x) && Number.isFinite(savedView.y)) {
        view = {
          x: savedView.x,
          y: savedView.y,
          scale: clamp(Number(savedView.scale) || 1, 0.45, 2.4),
        };
      }
    } catch {
      saveViewNow();
    }
  }

  function saveNotesSoon() {
    window.clearTimeout(noteSaveTimer);
    noteSaveTimer = window.setTimeout(saveNotesNow, 80);
  }

  function saveViewSoon() {
    window.clearTimeout(viewSaveTimer);
    viewSaveTimer = window.setTimeout(saveViewNow, 120);
  }

  function saveNotesNow() {
    syncNotesFromDom();
    const state = {
      version: 1,
      revision: nextRevision(),
      origin: clientId,
      notes: cleanNotes(notes),
    };
    localStorage.setItem(boardStorageKey, JSON.stringify(state));
    syncChannel?.postMessage({ type: "board-updated", state });
    dirtyNoteIds.clear();
  }

  function saveViewNow() {
    sessionStorage.setItem(viewStorageKey, JSON.stringify(view));
  }

  function nextRevision() {
    boardRevision = Math.max(Date.now(), boardRevision + 1);
    return boardRevision;
  }

  function cleanNotes(sourceNotes) {
    return sourceNotes.map((note) => ({
      id: note.id,
      x: note.x,
      y: note.y,
      text: note.text || "",
    }));
  }

  function normalizeNotes(sourceNotes) {
    if (!Array.isArray(sourceNotes)) {
      return [];
    }

    return sourceNotes
      .filter(
        (note) =>
          note &&
          typeof note.id === "string" &&
          Number.isFinite(Number(note.x)) &&
          Number.isFinite(Number(note.y))
      )
      .map((note) => ({
        id: note.id,
        x: Math.round(Number(note.x)),
        y: Math.round(Number(note.y)),
        text: typeof note.text === "string" ? note.text : "",
      }));
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function makeId() {
    if (window.crypto && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function applyView() {
    paper.style.transform = `translate(${view.x}px, ${view.y}px) scale(${view.scale})`;
  }

  function viewportToWorld(clientX, clientY) {
    const rect = viewport.getBoundingClientRect();
    return {
      x: (clientX - rect.left - view.x) / view.scale,
      y: (clientY - rect.top - view.y) / view.scale,
    };
  }

  function createNoteElement(note) {
    const noteId = note.id;
    const element = document.createElement("div");
    element.className = "note";
    element.contentEditable = "plaintext-only";
    element.spellcheck = true;
    element.dataset.id = noteId;
    element.style.left = `${note.x}px`;
    element.style.top = `${note.y}px`;
    element.textContent = note.text || "";

    element.addEventListener("pointerdown", (event) => {
      if (event.button === 2) {
        event.preventDefault();
        event.stopPropagation();
        startSelectionDrag(event, noteId);
        return;
      }

      if (event.button === 0 && selectedNoteIds.has(noteId)) {
        event.preventDefault();
        event.stopPropagation();
        startMoveSelection(event);
        return;
      }

      if (event.button === 0) {
        clearSelectedNotes();
      }

      event.stopPropagation();
    });

    element.addEventListener("input", () => {
      const currentNote = findNote(noteId);
      if (!currentNote) {
        return;
      }
      dirtyNoteIds.add(noteId);
      currentNote.text = getNoteText(element);
      if (!findBar.hidden) {
        refreshFindMatches();
      }
      saveNotesSoon();
    });

    element.addEventListener("blur", () => {
      const currentNote = findNote(noteId);
      if (!currentNote) {
        return;
      }
      currentNote.text = getNoteText(element);
      if (!currentNote.text.trim()) {
        removeNote(noteId);
      } else {
        saveNotesSoon();
      }
    });

    element.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        element.blur();
        window.getSelection()?.removeAllRanges();
      }
    });

    return element;
  }

  function setSelectedNotes(ids) {
    selectedNoteIds = new Set(ids);
    updateSelectedNoteStyles();
  }

  function clearSelectedNotes() {
    if (!selectedNoteIds.size) {
      return;
    }
    selectedNoteIds.clear();
    updateSelectedNoteStyles();
  }

  function pruneSelectedNotes() {
    const noteIds = new Set(notes.map((note) => note.id));
    selectedNoteIds = new Set([...selectedNoteIds].filter((id) => noteIds.has(id)));
  }

  function updateSelectedNoteStyles() {
    for (const element of paper.querySelectorAll(".note")) {
      element.classList.toggle("is-selected", selectedNoteIds.has(element.dataset.id));
    }
  }

  function findNote(id) {
    return notes.find((note) => note.id === id);
  }

  function getNoteText(element) {
    return element.innerText.replace(/\n$/, "");
  }

  function syncNotesFromDom() {
    for (const note of notes) {
      const element = paper.querySelector(`[data-id="${CSS.escape(note.id)}"]`);
      if (element) {
        note.text = getNoteText(element);
      }
    }
  }

  function renderNotes() {
    paper.replaceChildren();
    for (const note of notes) {
      paper.appendChild(createNoteElement(note));
    }
    updateSelectedNoteStyles();
  }

  function renderSyncedNotes() {
    const activeElement = document.activeElement?.classList.contains("note")
      ? document.activeElement
      : null;
    const protectedElement =
      activeElement && dirtyNoteIds.has(activeElement.dataset.id) ? activeElement : null;
    const noteIds = new Set(notes.map((note) => note.id));

    for (const element of Array.from(paper.querySelectorAll(".note"))) {
      if (!noteIds.has(element.dataset.id) && element !== protectedElement) {
        element.remove();
      }
    }

    for (const note of notes) {
      let element = paper.querySelector(`[data-id="${CSS.escape(note.id)}"]`);
      if (!element) {
        element = createNoteElement(note);
        paper.appendChild(element);
      }

      element.style.left = `${note.x}px`;
      element.style.top = `${note.y}px`;

      if (element !== protectedElement && getNoteText(element) !== (note.text || "")) {
        element.textContent = note.text || "";
      }
    }

    pruneSelectedNotes();
    updateSelectedNoteStyles();
  }

  function applyIncomingBoard(state) {
    if (!state || state.origin === clientId || !Array.isArray(state.notes)) {
      return;
    }

    const incomingRevision = Number(state.revision) || 0;
    if (incomingRevision <= boardRevision) {
      return;
    }

    boardRevision = incomingRevision;
    notes = normalizeNotes(state.notes);
    pruneSelectedNotes();
    renderSyncedNotes();

    if (!findBar.hidden) {
      refreshFindMatches();
    }
  }

  function focusAtEnd(element) {
    element.focus({ preventScroll: true });
    const range = document.createRange();
    range.selectNodeContents(element);
    range.collapse(false);
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
  }

  function addNoteAt(clientX, clientY) {
    const point = viewportToWorld(clientX, clientY);
    const note = {
      id: makeId(),
      x: Math.round(point.x),
      y: Math.round(point.y),
      text: "",
    };
    notes.push(note);
    const element = createNoteElement(note);
    paper.appendChild(element);
    focusAtEnd(element);
    saveNotesSoon();
  }

  function removeNote(id) {
    const index = notes.findIndex((note) => note.id === id);
    if (index === -1) {
      return;
    }
    notes.splice(index, 1);
    selectedNoteIds.delete(id);
    paper.querySelector(`[data-id="${CSS.escape(id)}"]`)?.remove();
    updateSelectedNoteStyles();
    saveNotesSoon();
  }

  function openFind() {
    syncNotesFromDom();
    const selectedText = window.getSelection()?.toString().trim();
    findBar.hidden = false;
    if (selectedText) {
      findInput.value = selectedText;
    }
    refreshFindMatches();
    findInput.focus({ preventScroll: true });
    findInput.select();
  }

  function closeFind() {
    findBar.hidden = true;
    clearFindHighlight();
    findState = {
      query: "",
      matches: [],
      activeIndex: -1,
      hasJumped: false,
    };
    viewport.focus?.();
  }

  function refreshFindMatches() {
    syncNotesFromDom();
    findState.query = findInput.value;
    findState.matches = collectFindMatches(findState.query);
    findState.activeIndex = findState.matches.length ? 0 : -1;
    findState.hasJumped = false;
    updateFindCount();
    clearFindHighlight();
  }

  function collectFindMatches(query) {
    const needle = query.toLocaleLowerCase();
    if (!needle) {
      return [];
    }

    const matches = [];
    for (const note of notes) {
      const haystack = (note.text || "").toLocaleLowerCase();
      let start = haystack.indexOf(needle);
      while (start !== -1) {
        matches.push({
          note,
          start,
          end: start + query.length,
        });
        start = haystack.indexOf(needle, start + Math.max(query.length, 1));
      }
    }

    return matches.sort((a, b) => {
      if (a.note.y !== b.note.y) {
        return a.note.y - b.note.y;
      }
      if (a.note.x !== b.note.x) {
        return a.note.x - b.note.x;
      }
      return a.start - b.start;
    });
  }

  function updateFindCount() {
    const total = findState.matches.length;
    findCount.textContent = total ? `${findState.activeIndex + 1}/${total}` : "0/0";
    findBar.classList.toggle("is-empty", !total);
  }

  function jumpFind(direction) {
    if (findBar.hidden) {
      openFind();
      return;
    }

    if (findInput.value !== findState.query) {
      refreshFindMatches();
    }

    if (!findState.matches.length) {
      updateFindCount();
      return;
    }

    if (findState.hasJumped) {
      findState.activeIndex =
        (findState.activeIndex + direction + findState.matches.length) % findState.matches.length;
    }
    findState.hasJumped = true;
    updateFindCount();
    focusFindMatch(findState.matches[findState.activeIndex]);
  }

  function focusFindMatch(match) {
    const element = paper.querySelector(`[data-id="${CSS.escape(match.note.id)}"]`);
    if (!element) {
      return;
    }

    const range = makeTextRange(element, match.start, match.end);
    if (!range) {
      return;
    }

    showFindHighlight(range);
    centerRange(range);
    findInput.focus({ preventScroll: true });
  }

  function makeTextRange(element, start, end) {
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    const range = document.createRange();
    let current = 0;
    let hasStart = false;

    while (walker.nextNode()) {
      const node = walker.currentNode;
      const next = current + node.nodeValue.length;

      if (!hasStart && start <= next) {
        range.setStart(node, Math.max(0, start - current));
        hasStart = true;
      }

      if (hasStart && end <= next) {
        range.setEnd(node, Math.max(0, end - current));
        return range;
      }

      current = next;
    }

    return null;
  }

  function showFindHighlight(range) {
    clearFindHighlight();
    if (CSS.highlights && window.Highlight) {
      CSS.highlights.set("find-active", new Highlight(range));
      return;
    }

    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
  }

  function clearFindHighlight() {
    if (CSS.highlights) {
      CSS.highlights.delete("find-active");
    }
    if (document.activeElement !== findInput) {
      window.getSelection()?.removeAllRanges();
    }
  }

  function centerRange(range) {
    const matchRect = range.getBoundingClientRect();
    const viewportRect = viewport.getBoundingClientRect();
    const matchX = matchRect.left + matchRect.width / 2;
    const matchY = matchRect.top + matchRect.height / 2;
    const centerX = viewportRect.left + viewportRect.width / 2;
    const centerY = viewportRect.top + viewportRect.height / 2;

    view.x += centerX - matchX;
    view.y += centerY - matchY;
    applyView();
    saveViewSoon();
  }

  function getDragDistance(event) {
    return Math.hypot(event.clientX - activeDrag.startX, event.clientY - activeDrag.startY);
  }

  function getSelectionRect(clientX, clientY) {
    const left = Math.min(activeDrag.startX, clientX);
    const top = Math.min(activeDrag.startY, clientY);
    const right = Math.max(activeDrag.startX, clientX);
    const bottom = Math.max(activeDrag.startY, clientY);
    return {
      left,
      top,
      right,
      bottom,
      width: right - left,
      height: bottom - top,
    };
  }

  function showSelectionBox(rect) {
    selectionBox.hidden = false;
    selectionBox.style.transform = `translate(${rect.left}px, ${rect.top}px)`;
    selectionBox.style.width = `${rect.width}px`;
    selectionBox.style.height = `${rect.height}px`;
  }

  function hideSelectionBox() {
    selectionBox.hidden = true;
    selectionBox.style.width = "0";
    selectionBox.style.height = "0";
  }

  function noteIntersectsRect(element, rect) {
    const noteRect = element.getBoundingClientRect();
    return !(
      noteRect.right < rect.left ||
      noteRect.left > rect.right ||
      noteRect.bottom < rect.top ||
      noteRect.top > rect.bottom
    );
  }

  function getNoteIdsInRect(rect) {
    const ids = [];
    for (const element of paper.querySelectorAll(".note")) {
      if (noteIntersectsRect(element, rect)) {
        ids.push(element.dataset.id);
      }
    }
    return ids;
  }

  function startSelectionDrag(event, anchorNoteId = null) {
    window.getSelection()?.removeAllRanges();
    activeDrag = {
      type: "select",
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      moved: false,
      anchorNoteId,
    };
    viewport.setPointerCapture(event.pointerId);
    viewport.classList.add("is-selecting");
  }

  function moveSelectionDrag(event) {
    if (getDragDistance(event) > panThreshold) {
      activeDrag.moved = true;
    }

    const rect = getSelectionRect(event.clientX, event.clientY);
    showSelectionBox(rect);
    setSelectedNotes(getNoteIdsInRect(rect));
  }

  function endSelectionDrag(event) {
    if (activeDrag.moved) {
      setSelectedNotes(getNoteIdsInRect(getSelectionRect(event.clientX, event.clientY)));
    } else if (activeDrag.anchorNoteId) {
      setSelectedNotes([activeDrag.anchorNoteId]);
    } else {
      clearSelectedNotes();
    }

    hideSelectionBox();
    viewport.classList.remove("is-selecting");
  }

  function startMoveSelection(event) {
    syncNotesFromDom();
    activeDrag = {
      type: "move-selection",
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      moved: false,
      startNotes: notes
        .filter((note) => selectedNoteIds.has(note.id))
        .map((note) => {
          const element = paper.querySelector(`[data-id="${CSS.escape(note.id)}"]`);
          return {
            id: note.id,
            x: note.x,
            y: note.y,
            width: element?.offsetWidth || 0,
            height: element?.offsetHeight || 0,
          };
        }),
    };
    viewport.setPointerCapture(event.pointerId);
    viewport.classList.add("is-moving-selection");
  }

  function moveSelectedNotes(event) {
    let dx = (event.clientX - activeDrag.startX) / view.scale;
    let dy = (event.clientY - activeDrag.startY) / view.scale;
    const snapped = getEdgeSnapOffset(dx, dy);
    dx = snapped.dx;
    dy = snapped.dy;

    if (Math.hypot(dx, dy) > 0.5) {
      activeDrag.moved = true;
    }

    for (const startNote of activeDrag.startNotes) {
      const note = findNote(startNote.id);
      const element = paper.querySelector(`[data-id="${CSS.escape(startNote.id)}"]`);
      if (!note || !element) {
        continue;
      }

      note.x = Math.round(startNote.x + dx);
      note.y = Math.round(startNote.y + dy);
      element.style.left = `${note.x}px`;
      element.style.top = `${note.y}px`;
    }

    saveNotesSoon();
  }

  function getMovingGroupRect(dx, dy) {
    const left = Math.min(...activeDrag.startNotes.map((note) => note.x + dx));
    const top = Math.min(...activeDrag.startNotes.map((note) => note.y + dy));
    const right = Math.max(...activeDrag.startNotes.map((note) => note.x + note.width + dx));
    const bottom = Math.max(...activeDrag.startNotes.map((note) => note.y + note.height + dy));
    return {
      left,
      top,
      right,
      bottom,
      centerX: left + (right - left) / 2,
      centerY: top + (bottom - top) / 2,
    };
  }

  function getStationaryNoteRects() {
    return notes
      .filter((note) => !selectedNoteIds.has(note.id))
      .map((note) => {
        const element = paper.querySelector(`[data-id="${CSS.escape(note.id)}"]`);
        return {
          left: note.x,
          top: note.y,
          right: note.x + (element?.offsetWidth || 0),
          bottom: note.y + (element?.offsetHeight || 0),
        };
      })
      .map((rect) => ({
        ...rect,
        centerX: rect.left + (rect.right - rect.left) / 2,
        centerY: rect.top + (rect.bottom - rect.top) / 2,
      }));
  }

  function getEdgeSnapOffset(dx, dy) {
    const movingRect = getMovingGroupRect(dx, dy);
    const movingX = [movingRect.left, movingRect.centerX, movingRect.right];
    const movingY = [movingRect.top, movingRect.centerY, movingRect.bottom];
    let snapX = 0;
    let snapY = 0;
    let bestX = snapDistance + 1;
    let bestY = snapDistance + 1;

    for (const rect of getStationaryNoteRects()) {
      for (const targetX of [rect.left, rect.centerX, rect.right]) {
        for (const sourceX of movingX) {
          const offset = targetX - sourceX;
          const distance = Math.abs(offset);
          if (distance < bestX && distance <= snapDistance) {
            bestX = distance;
            snapX = offset;
          }
        }
      }

      for (const targetY of [rect.top, rect.centerY, rect.bottom]) {
        for (const sourceY of movingY) {
          const offset = targetY - sourceY;
          const distance = Math.abs(offset);
          if (distance < bestY && distance <= snapDistance) {
            bestY = distance;
            snapY = offset;
          }
        }
      }
    }

    return {
      dx: dx + snapX,
      dy: dy + snapY,
    };
  }

  function endMoveSelection() {
    viewport.classList.remove("is-moving-selection");
    if (activeDrag.moved) {
      saveNotesNow();
    }
  }

  function beginDrag(event) {
    if (event.button === 2) {
      event.preventDefault();
      startSelectionDrag(event);
      return;
    }

    if (event.button !== 0 && event.button !== 1) {
      return;
    }

    clearSelectedNotes();

    activeDrag = {
      type: "pan",
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      viewX: view.x,
      viewY: view.y,
      moved: false,
      panOnly: event.button === 1 || spaceDown,
    };

    viewport.setPointerCapture(event.pointerId);
    if (activeDrag.panOnly) {
      event.preventDefault();
      viewport.classList.add("is-panning");
    }
  }

  function moveDrag(event) {
    if (!activeDrag || event.pointerId !== activeDrag.pointerId) {
      return;
    }

    if (activeDrag.type === "select") {
      moveSelectionDrag(event);
      return;
    }

    if (activeDrag.type === "move-selection") {
      moveSelectedNotes(event);
      return;
    }

    const dx = event.clientX - activeDrag.startX;
    const dy = event.clientY - activeDrag.startY;
    const shouldPan = activeDrag.panOnly || Math.hypot(dx, dy) > panThreshold;

    if (!shouldPan) {
      return;
    }

    activeDrag.moved = true;
    viewport.classList.add("is-panning");
    view.x = activeDrag.viewX + dx;
    view.y = activeDrag.viewY + dy;
    applyView();
    saveViewSoon();
  }

  function endDrag(event) {
    if (!activeDrag || event.pointerId !== activeDrag.pointerId) {
      return;
    }

    if (activeDrag.type === "select") {
      viewport.releasePointerCapture(event.pointerId);
      endSelectionDrag(event);
      activeDrag = null;
      return;
    }

    if (activeDrag.type === "move-selection") {
      viewport.releasePointerCapture(event.pointerId);
      endMoveSelection();
      activeDrag = null;
      return;
    }

    const wasClick = !activeDrag.moved && !activeDrag.panOnly && event.button === 0;
    viewport.releasePointerCapture(event.pointerId);
    viewport.classList.remove("is-panning");
    activeDrag = null;

    if (wasClick) {
      addNoteAt(event.clientX, event.clientY);
    }
  }

  viewport.addEventListener("pointerdown", beginDrag);
  viewport.addEventListener("pointermove", moveDrag);
  viewport.addEventListener("pointerup", endDrag);
  viewport.addEventListener("pointercancel", () => {
    activeDrag = null;
    hideSelectionBox();
    viewport.classList.remove("is-panning");
    viewport.classList.remove("is-selecting");
    viewport.classList.remove("is-moving-selection");
  });

  viewport.addEventListener("contextmenu", (event) => {
    event.preventDefault();
  });

  findBar.addEventListener("pointerdown", (event) => {
    event.stopPropagation();
  });

  findBar.addEventListener("submit", (event) => {
    event.preventDefault();
    jumpFind(1);
  });

  findInput.addEventListener("input", refreshFindMatches);

  findInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      jumpFind(event.shiftKey ? -1 : 1);
    }
    if (event.key === "Escape") {
      event.preventDefault();
      closeFind();
    }
  });

  findPrev.addEventListener("click", () => jumpFind(-1));
  findNext.addEventListener("click", () => jumpFind(1));
  findClose.addEventListener("click", closeFind);

  syncChannel?.addEventListener("message", (event) => {
    if (event.data?.type === "board-updated") {
      applyIncomingBoard(event.data.state);
    }
  });

  window.addEventListener("storage", (event) => {
    if (event.key !== boardStorageKey || !event.newValue) {
      return;
    }

    try {
      applyIncomingBoard(JSON.parse(event.newValue));
    } catch {
      // Ignore malformed external storage writes.
    }
  });

  viewport.addEventListener(
    "wheel",
    (event) => {
      event.preventDefault();
      if (event.ctrlKey || event.metaKey) {
        const point = viewportToWorld(event.clientX, event.clientY);
        const nextScale = clamp(view.scale * Math.exp(-event.deltaY * 0.001), 0.45, 2.4);
        view.scale = nextScale;
        view.x = event.clientX - point.x * view.scale;
        view.y = event.clientY - point.y * view.scale;
      } else {
        view.x -= event.deltaX;
        view.y -= event.deltaY;
      }
      applyView();
      saveViewSoon();
    },
    { passive: false }
  );

  window.addEventListener("keydown", (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLocaleLowerCase() === "f") {
      event.preventDefault();
      if (findBar.hidden) {
        openFind();
      } else {
        closeFind();
      }
      return;
    }

    if (!findBar.hidden && event.key === "Escape") {
      event.preventDefault();
      closeFind();
      return;
    }

    if (event.key === "Escape" && selectedNoteIds.size) {
      event.preventDefault();
      clearSelectedNotes();
      return;
    }

    if (findBar.contains(document.activeElement)) {
      return;
    }

    if (document.activeElement?.classList.contains("note")) {
      return;
    }
    if (event.code === "Space") {
      spaceDown = true;
      event.preventDefault();
      viewport.classList.add("is-panning");
    }
  });

  window.addEventListener("keyup", (event) => {
    if (event.code === "Space") {
      spaceDown = false;
      if (!activeDrag) {
        viewport.classList.remove("is-panning");
      }
    }
  });

  window.addEventListener("beforeunload", () => {
    window.clearTimeout(noteSaveTimer);
    window.clearTimeout(viewSaveTimer);
    saveNotesNow();
    saveViewNow();
    syncChannel?.close();
  });

  loadState();
  applyView();
  renderNotes();
})();
