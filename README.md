# Infinite Paper Lab

Infinite Paper is an infinite white-paper canvas for spatial note-taking —
a calm, fast surface for capturing and arranging text notes, screenshots,
and markdown documents.

## Repository layout

- `app/` — the application (HTML / CSS / JS, no build step).
- `server.js` — the local Node server: serves `app/` and stores each board
  as a `.md` file on disk.
- `tests/smoke.mjs` — the browser smoke test (run via the `app-test` skill).
- `tools/` — one-off scripts (e.g. importing a backup export).
- `web/` — an earlier hosted experiment with Supabase auth and cloud sync.
  Parked; superseded by the file-backed direction.

Older R&D version folders (`v1`–`v10`, plus `v8.1` / `v8.1.1`) live on the
`archive/rnd-v1-v10` branch. The version-folder workflow is retired —
versions are tracked by git branch and tag.

## Run it

Requires Node.js 20 or newer.

```
node server.js        (or: npm start, or start.bat)
```

Then open http://127.0.0.1:4321. Boards are stored as `.md` files in the
notes directory — set by `NOTES_DIR`; by default the legacy
`C:\DevelopmentNotes\InfinitePaper-Notes` if it exists, otherwise
`InfinitePaper-Notes` in your home directory.

A new empty notes directory receives exactly one generated board:
**InfiniteBoards Test Drive**. It is an interactive introduction, not personal
data. This repository never tracks your boards, attachments, or trash.

## Watch the live browser tutorial

```bash
npm install
npx playwright install chromium
npm run test:live
```

This opens Chromium and visibly demonstrates the core workflow: text, images,
Markdown, board management, search, undo/redo, downloads, canvas zoom, and dark
mode. Traces, screenshots, and video go to `test-results/`.

For the same tour without a visible browser, run `npm run test:browser`.
`npm run test:all` runs unit and browser tests together. GitHub Actions runs it
on every pull request and push to `main`; its trace and video are downloadable
from the workflow run.

## What it does

Each board is one `.md` file on disk — portable, git-trackable, editable in
VS Code, and reachable by AI tools — while the canvas UI stays fast and local.
On the canvas you can:

- Place **text notes** (click), paste **screenshots** (resize / rotate /
  mirror / crop), and drop **`.md` files** that render as formatted markdown
  documents (resizable, scrollable, with a raw-source tab).
- Zoom the canvas from **5% to 400%** with touchpad pinch, `Ctrl`+wheel,
  `Ctrl`+`-` / `Ctrl`+`+`, or the controls in the `Tab` overlay. **Fit** frames
  every note without shrinking the application UI or its image sources.
- Manage **boards** from the `Shift`+`Tab` overlay: switch, pin, reorder
  (drag), rename, and delete (right-click, or keyboard `Delete` with
  `Shift`+arrow multi-select). Arrow keys navigate, `Enter` opens.
- Open any board in its **own browser tab** (`+ New board`, `Shift`+`Tab` then
  `N`, middle-click, or right-click → **Open in new tab**) — the URL carries
  `?board=<id>`, so refreshing or sharing a link reopens the same board.
- Press `Ctrl`+`S` to explicitly flush the current board to disk and receive a
  compact confirmation containing the local date and time. Choose **Download**
  there for the canonical board source (`.board.md`) or a clean single-file
  knowledge document (`.knowledge.md`). Image attachment bundling is reserved
  for a later portable ZIP export.

Boards are saved as Markdown in `NOTES_DIR`; pasted images are stored as files
under `attachments/`, portable across browsers. Edit a board's `.md`
externally and the canvas live-reloads.

See [`app/README.md`](app/README.md) for the full feature list and shortcuts.

## Branches

- `main` — the current stable app.
- `rnd/*` — research-and-development lines.
- `archive/*` — frozen snapshots.
