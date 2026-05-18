# Infinite Paper — app

The Infinite Paper application: an infinite white-paper canvas for spatial
note-taking. This `app/` folder is the mainline app (formerly `v10/`); the
version is now tracked by git branch/tag, not by folder name.

## Run it

Open `index.html` in a browser, or serve the folder over HTTP. The branch
`rnd/v11-md` is refactoring storage to a local Node server backed by `.md`
files — see the repo root `README.md` for the roadmap.

## Features

- Infinite white paper with click-to-place text notes.
- Multiple boards: `+ New board`, switch, pin/unpin, rename (double-click a
  board name or `F2` while the board overlay is open).
- `Tab` toggles the draggable quick overlay; `Shift` + `Tab` toggles the
  board-history overlay. Both can stay open at once; close with the same
  shortcut that opened them.
- Undo / Redo arrow buttons in the board overlay; the session undo/redo
  stack is unbounded.
- Screenshot/image paste, move, resize, rotate, and mirror.
- Right-drag selection and selected-note movement.
- Find (`Ctrl` + `F`), tab renaming, board copy/paste.
- Redline spell suggestions, including fuzzy correction (e.g. `betyetew`
  -> `better`); turning Redlines back on immediately rescans.

## Storage (current)

Boards are stored per-board in browser `localStorage`; pasted images live
in `IndexedDB`. The `rnd/v11-md` branch replaces this with file-backed
markdown boards via a local server.
