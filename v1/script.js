(function () {
  const viewport = document.getElementById("viewport");
  const paper = document.getElementById("paper");
  const storageKey = "infinite-paper:v1";
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
    element.contentEditable = "true";
    element.spellcheck = true;
    element.dataset.id = note.id;
    element.style.left = `${note.x}px`;
    element.style.top = `${note.y}px`;
    element.textContent = note.text || "";

    element.addEventListener("pointerdown", (event) => {
      event.stopPropagation();
    });

    element.addEventListener("input", () => {
      note.text = element.textContent;
      saveSoon();
    });

    element.addEventListener("blur", () => {
      note.text = element.textContent;
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
