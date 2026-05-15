(function () {
  const viewport = document.getElementById("viewport");
  const paper = document.getElementById("paper");
  const findBar = document.getElementById("find-bar");
  const findInput = document.getElementById("find-input");
  const findCount = document.getElementById("find-count");
  const findPrev = document.getElementById("find-prev");
  const findNext = document.getElementById("find-next");
  const findClose = document.getElementById("find-close");
  const storageKey = "infinite-paper:v4";
  const panThreshold = 5;

  let notes = [];
  let activeDrag = null;
  let spaceDown = false;
  let saveTimer = 0;
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
      const saved = JSON.parse(localStorage.getItem(storageKey) || "{}");
      if (Array.isArray(saved.notes)) {
        notes = saved.notes.filter((note) => typeof note.id === "string");
      }
      if (saved.view && Number.isFinite(saved.view.x) && Number.isFinite(saved.view.y)) {
        view = {
          x: saved.view.x,
          y: saved.view.y,
          scale: clamp(Number(saved.view.scale) || 1, 0.45, 2.4),
        };
      }
    } catch {
      notes = [];
    }
  }

  function saveSoon() {
    window.clearTimeout(saveTimer);
    saveTimer = window.setTimeout(saveNow, 120);
  }

  function saveNow() {
    localStorage.setItem(storageKey, JSON.stringify({ notes, view }));
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
    const element = document.createElement("div");
    element.className = "note";
    element.contentEditable = "plaintext-only";
    element.spellcheck = true;
    element.dataset.id = note.id;
    element.style.left = `${note.x}px`;
    element.style.top = `${note.y}px`;
    element.textContent = note.text || "";

    element.addEventListener("pointerdown", (event) => {
      event.stopPropagation();
    });

    element.addEventListener("input", () => {
      note.text = getNoteText(element);
      if (!findBar.hidden) {
        refreshFindMatches();
      }
      saveSoon();
    });

    element.addEventListener("blur", () => {
      note.text = getNoteText(element);
      if (!note.text.trim()) {
        removeNote(note.id);
      } else {
        saveSoon();
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
    saveSoon();
  }

  function removeNote(id) {
    const index = notes.findIndex((note) => note.id === id);
    if (index === -1) {
      return;
    }
    notes.splice(index, 1);
    paper.querySelector(`[data-id="${CSS.escape(id)}"]`)?.remove();
    saveSoon();
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
    saveSoon();
  }

  function beginDrag(event) {
    if (event.button !== 0 && event.button !== 1) {
      return;
    }

    activeDrag = {
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
    saveSoon();
  }

  function endDrag(event) {
    if (!activeDrag || event.pointerId !== activeDrag.pointerId) {
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
    viewport.classList.remove("is-panning");
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
      saveSoon();
    },
    { passive: false }
  );

  window.addEventListener("keydown", (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLocaleLowerCase() === "f") {
      event.preventDefault();
      openFind();
      return;
    }

    if (!findBar.hidden && event.key === "Escape") {
      event.preventDefault();
      closeFind();
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

  window.addEventListener("beforeunload", saveNow);

  loadState();
  applyView();
  renderNotes();
})();
