# Rebuild Infinite Paper from scratch — a sequence of prompts

Paste these prompts into a fresh Claude Code / Codex session, in order. Each one
is self-contained and produces a working slice you can run before moving on.
The point of breaking it up: every prompt has a *single concern*, with a clear
acceptance test at the end. That's how you avoid the kind of compound bugs we
hit on 2026-05-28 (a churning save loop tangled with a focus-routing issue).

## Lessons baked in (must-have invariants for the rebuild)

These are the rules every prompt assumes — write them into the system prompt
of your next session so they aren't forgotten:

1. **One board id ↔ one file on disk.** The server's filename for a board is
   derived from its title slug. If the title changes, the file is *renamed*,
   not written-new-then-deleted. There is **no scenario** where two `.md` files
   on disk carry the same board id.
2. **Saves are atomic.** Write to `<file>.tmp`, `fsync`, then rename to
   `<file>`. Never `rm` an existing file before its replacement is proven on
   disk. A failed write must leave the previous version intact.
3. **The browser tab has one editor focus at a time.** Clicking empty canvas
   must always blur the previously focused note. Keystrokes never go to a note
   the user can't see being typed into.
4. **Click-vs-drag has a forgiving threshold and a fallback.** Sub-threshold
   pointer drift counts as a click, not a pan. If gesture classification is
   ambiguous, the safer outcome is "do nothing" — never "silently route the
   user's typing somewhere else."
5. **All exit paths flush.** `beforeunload`, `visibilitychange → hidden`,
   `pagehide`, and Ctrl+S all funnel through the same flush function. None of
   them silently drop edits.
6. **Notes folder is human-friendly.** A `.md` file in `boards/` is readable
   without the app — frontmatter for metadata, `<!-- ip-note … -->` markers
   for placement, the note text as plain Markdown between them.

## Phase 1 — Server foundation

> Build a tiny Node 18+ HTTP server in `server.js` (no dependencies) that
> serves a static `app/` folder and exposes a JSON API to read and write
> Infinite Paper boards as `.md` files in `NOTES_DIR/boards/` (env-driven,
> default `C:\DevelopmentNotes\InfinitePaper-Notes`). It must implement:
>
> - `GET /api/boards` → index (id, title, pinned, order, timestamps, view,
>   noteCount) for every `.md` in the boards folder.
> - `GET /api/boards/:id` → one board.
> - `GET /api/boards/:id?format=md` → raw markdown for download.
> - `PUT /api/boards/:id` → upsert with **atomic write** (`<file>.tmp` → rename).
> - `DELETE /api/boards/:id` → remove every file carrying this id.
> - `POST /api/attachments?id=…&ext=…` → store an image.
> - `GET /events` (SSE) → notify clients on `fs.watch` changes.
>
> **Hard invariants** (write a test for each):
> 1. One id ↔ one file.
> 2. A `PUT` that fails partway leaves the previous file intact (write to
>    `.tmp`, rename only after `fsync`).
> 3. Renaming a board → its file is renamed, not duplicated.
> 4. Re-running the server against an existing notes folder picks the same
>    primary file deterministically (by frontmatter `updatedAt`, ties broken
>    by `revision` then `lastOpenedAt`).
>
> Ship a board format that's lossless. Acceptance: `parseBoard(serializeBoard(b))`
> is deep-equal to `b` for every board in `boards/`.

## Phase 2 — Client foundation

> In `app/`, build a vanilla-JS infinite canvas. No frameworks. Files:
> `index.html`, `styles.css`, `script.js`.
>
> - A `#viewport` div with `pointerdown/move/up` handlers implementing
>   space-bar+drag pan, wheel-to-zoom (centred on cursor), drag-to-select.
> - A `#paper` div inside it, positioned with `transform: translate(x, y)
>   scale(s)`. Pan/zoom updates `view` only — never touches per-note positions.
> - A documented `viewportToWorld(clientX, clientY)` helper that accounts for
>   the viewport's screen offset (`getBoundingClientRect`), `view.x/y`, and
>   `view.scale`. Write a unit test for it.
> - `view` (x, y, scale) is persisted per-board via `sessionStorage` and
>   restored on load.
>
> Acceptance: panning with space+drag and zooming with wheel feel smooth at
> 60fps with 200 mock notes on screen.

## Phase 3 — Notes + autosave

> Add three note types: plain `text`, `image`, and rendered `markdown`. Each
> persists to the current board's `.md` file via the API.
>
> **Autosave**: debounce edits at 80ms → `saveNotesNow()` → queue a PUT.
> Per-board write queue serialises PUTs so two concurrent edits never race.
>
> **Explicit save (Ctrl+S / Cmd+S)**: a global `keydown` listener that calls
> `preventDefault()` synchronously, flushes the debounced timer, awaits the
> queue, then shows a bottom-right "Board saved" toast that downloads the
> `.md` on click.
>
> **Exit flush**: `beforeunload`, `visibilitychange → hidden`, and `pagehide`
> all call the same `flushOnExit()`, which uses `fetch(…, { keepalive: true })`
> so the request can outlive the page.
>
> **Focus invariant**: pointerdown on the empty canvas always blurs the
> currently focused note *before* deciding whether to create a new one.
> Click-vs-drag uses a 4px threshold; sub-threshold drift = click.
>
> Acceptance test (Playwright): type into note A, click empty canvas at point
> B, type "hello" — *"hello" must land in a brand-new note at B, never in A*.

## Phase 4 — Boards + overlay

> Multi-board support. A board has id, title, pinned, order, timestamps,
> view, notes. The boards overlay (Shift+Tab):
>
> - Lists boards from `GET /api/boards`, pinned-first, then by `order`.
> - Click a row → open the board (URL routes to `?board=<id>`).
> - Middle-click → open in a new browser tab (window.open + URL).
> - Drag rows to reorder.
> - `+ New` → opens a *new browser tab* with a fresh empty board in rename
>   mode.
> - Pin/unpin from the row's pin button. Delete via right-click menu or
>   Shift+Arrow-multi-select + Delete (with confirmation).
> - Arrow-key navigation; Enter to open.
>
> Acceptance: with 50 boards, the overlay opens in <100ms and reorders without
> visible jank.

## Phase 5 — Live reload + multi-tab sync

> Server uses `fs.watch(BOARDS_DIR)` → broadcasts `{ type: "boards-changed",
> file: "<name>.md" }` via SSE. Client subscribes; on a change touching the
> current board, refetch and reconcile (but **never** clobber a note the user
> is currently typing into — guard with `isEditingANote()`).
>
> A `BroadcastChannel("infinite-paper")` syncs state across tabs of the same
> origin (so two windows on the same board stay in step).
>
> Acceptance: edit the `.md` in VS Code → the canvas updates within 500ms.
> Edit a note in tab A → tab B's view of the same board updates without
> blowing away tab B's in-progress edits.

## Phase 6 — Polish + tests + observability

> - Smoke test (`tests/smoke.mjs`) launching the app via Playwright headed,
>   covering: load, click→note, edit-on-disk live-reloads canvas, multi-board
>   creation, drag-reorder, middle-click-new-tab, Ctrl+S→toast→download, image
>   paste, .md import. Each step is wrapped in `step("name", async () => …)`.
> - A short ADR (`docs/adr-XXX-*.md`) for every non-obvious choice (the
>   one-id-one-file invariant, atomic writes, focus discipline).
> - Structured console logs at startup (boards indexed, listening URL).
>
> Acceptance: smoke test passes on a fresh checkout with one command.

## How to use these prompts

Run them in order. Don't move to Phase N+1 until Phase N's acceptance test
passes. When you hit a bug, debug it in isolation before adding any new
feature — that's what we failed to do on 2026-05-28, and it's why a 1-line
shape change broke 3 other call sites at once.
