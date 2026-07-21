# Infinite Paper — architecture overview

A short walking tour of the codebase so a new contributor (or a future you)
can find their bearings in 10 minutes.

## 30-second tour

```
your machine
├── browser (Chrome / Edge / Firefox)
│       └─ http://127.0.0.1:4321
│              │ HTTP + SSE
│              ▼
├── Node server.js   (one file, ~750 lines, zero dependencies)
│              │ fs read / write
│              ▼
└── C:\DevelopmentNotes\InfinitePaper-Notes\
       ├── boards\           ← one .md per board (the source of truth)
       └── attachments\      ← pasted images, served as /attachments/<name>
```

That's the whole system. There is no database. There is no build step. There
is no framework. The app is a static HTML page that talks to a tiny local
JSON API.

## Files and their roles

| File | What it is |
|---|---|
| `server.js` | The local HTTP server. Serves the `app/` folder as static assets, plus a JSON API at `/api/*` and a Server-Sent-Events stream at `/events`. Watches the boards folder via `fs.watch`. Zero deps. |
| `app/index.html` | Loads the three scripts and styles. Empty `<div id="viewport">`. |
| `app/styles.css` | Every visual style. Light theme. No CSS framework. |
| `app/script.js` | The whole client app — pan/zoom, notes, boards, overlay, save logic, keyboard shortcuts, multi-tab sync. ~5500 lines, single IIFE. |
| `app/markdown.js` | A 170-line, dependency-free Markdown → HTML renderer used by the "markdown" note type. HTML-escapes first, so a note can never inject raw HTML. |
| `app/spelling.js` | Spell-check highlighting in editable notes. |
| `start.bat`, `npm start` | Two equivalent ways to run `node server.js`. |
| `tests/smoke.mjs` | Playwright-driven end-to-end browser test. Consumed by the `app-test` skill runner. |
| `docs/` | ADRs and (now) strategic docs. |

## Data — where it lives

Every board is one `.md` file in `<NOTES_DIR>/boards/`. The format:

```
---
id: <uuid>
title: "Some Title"
pinned: false
order: 0
createdAt: <ms>
updatedAt: <ms>
lastOpenedAt: <ms>
revision: <ms>
view:
  x: 100
  y: 200
  scale: 1.0
---

# Some Title

<!-- ip-note id=<uuid> type=text x=-100 y=50 -->
The note's plain text.
<!-- /ip-note -->

<!-- ip-note id=<uuid> type=image x=300 y=120 width=400 height=300 ... -->
<!-- /ip-note -->

<!-- ip-note id=<uuid> type=markdown x=0 y=0 width=380 height=420 -->
# A markdown-rendered note
- bullet
- another bullet
<!-- /ip-note -->
```

This format is **human readable** — you can open the file in VS Code and see
exactly what's on the board. It's **AI readable** — Claude Code can edit it
directly. It's **lossless** — `parseBoard(serializeBoard(b))` equals `b`.

Images are stored as raw bytes in `<NOTES_DIR>/attachments/<uuid>.<ext>` and
referenced by `imageId` in the note marker.

## The save lifecycle (write path)

```
user types in a note
  → input event fires
  → saveNotesSoon()              [script.js: debounce 80ms]
  → after 80ms idle:
    saveNotesNow()
      builds payload from in-memory notes + view
      → queueBoardWrite(payload)   [per-board write queue]
      → flushBoardWrites(boardId)  [drains the queue serially]
        → putBoard(payload)        [fetch PUT keepalive=true]
          → server: saveBoard(req, res, id)
            → mergeBoard(base, incoming)
            → fileForBoard(board)  [pick the filename]
            → writeFile(file, content)
            → boardFiles.set(id, file)
```

Key properties **today** that need hardening (see lessons in
`build-from-scratch-prompts.md`):

- Debounce is 80ms — typing pauses save, not finishes-typing.
- The write queue serialises per-board PUTs so a fast user can't race
  themselves.
- `keepalive: true` lets the browser deliver the request even after the
  page unloads.

## The load lifecycle (read path)

```
page loads (?board=<id> or last opened)
  → script.js startInfinitePaper()
  → loadState()
    → GET /api/boards          [index of all boards]
    → pick currentBoardId from URL / sessionStorage / first pinned
    → GET /api/boards/<id>     [the chosen board]
    → render notes onto #paper
    → setupLiveReload()        [open SSE stream to /events]
```

## Live reload

`server.js` runs `fs.watch(BOARDS_DIR)`. When any `.md` changes, it
broadcasts a `{type: "boards-changed", file}` SSE event to all connected
clients. Each client decides: is this *my* current board? If yes and I'm
not actively editing a note, refetch and reconcile.

This is what makes "edit the `.md` in VS Code, see the canvas update in 0.5s"
work. It's also what makes two browser tabs on the same board stay in sync.

`BroadcastChannel("infinite-paper")` is used for cross-tab sync on the same
origin (faster path than the SSE roundtrip).

## Key invariants (as of today, after the 2026-05-28 reset)

1. **One board id ↔ one file on disk.** *(Aspirational — current code can mint
   `slug-N.md` duplicates under the old save logic. Today's intended fix
   targeted this; it was reverted because it surfaced primary-selection
   ambiguity. See the build-from-scratch prompts for the right version.)*
2. **The file is human-readable and lossless.** Confirmed by code review.
3. **`view` (pan/zoom) never affects per-note positions.** Confirmed.
4. **Markdown is HTML-escaped before render.** Confirmed in `markdown.js`.
5. **`fs.watch` reload never overwrites a note being typed.** Implemented as
   `isEditingANote()` guard. Confirmed.

## Known issues (real ones, as of 2026-05-28)

- **File-churn on save**: the old `fileForBoard` mints a new numbered file
  on every save when its in-memory map gets out of sync with disk. The
  notes folder accumulates `dejaru-2.md … dejaru-33.md` clusters. The data
  is in the latest file; older numbered duplicates are stale snapshots.
- **Save-then-delete order**: `saveBoard` `rm`s the previous file before the
  write is verified. A failed write could in principle leave no file.
- **Stale-focus typing**: clicking empty canvas at point B sometimes doesn't
  create a note there (gesture classified as drag); the previously focused
  note keeps the caret, so the user's typing silently flows into A.
- **No Ctrl+S**: the browser's "Save as HTML" dialog fires instead.

All four are addressed in the build-from-scratch prompts.

## What's worth keeping vs. replacing

**Keep** — these are the load-bearing good ideas:

- `.md` files as truth.
- Zero-dependency Node server.
- Single-file client (one `script.js`, no bundler).
- Per-board write queue.
- SSE live reload + BroadcastChannel cross-tab.
- The lossless serialise/parse round-trip.

**Replace** — these are the rough edges:

- `fileForBoard` / `boardFiles` (use atomic rename, never `rm-then-write`).
- The single `script.js` (eventually split into modules — `view`, `notes`,
  `boards`, `save`, `keyboard`).
- The "click empty canvas creates a note" gesture (consider double-click
  + an explicit "new note" hotkey).
- The hand-rolled Markdown renderer (fine for v1; consider `marked` or
  `markdown-it` later for full CommonMark + extensions).
