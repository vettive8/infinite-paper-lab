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

```
node server.js        (or: npm start, or start.bat)
```

Then open http://127.0.0.1:4321. Boards are stored as `.md` files in the
notes directory — set by `NOTES_DIR`, default
`C:\DevelopmentNotes\InfinitePaper-Notes`.

## What it does

Each board is one `.md` file on disk — portable, git-trackable, editable in
VS Code, and reachable by AI tools, while the canvas UI is unchanged.
Boards reorder by drag and live in pinned / unpinned groups; pasted images
crop, rotate and mirror; a dropped `.md` file imports as a new board; and
markdown notes render as formatted documents.

## Branches

- `main` — the current stable app.
- `rnd/*` — research-and-development lines.
- `archive/*` — frozen snapshots.
