# Infinite Paper Lab

Infinite Paper is an infinite white-paper canvas for spatial note-taking —
a calm, fast surface for capturing and arranging text notes and screenshots.

## Repository layout

- `app/` — the mainline application (formerly `v10/`).
- `web/` — an earlier hosted experiment with Supabase auth and cloud sync.
  Parked; superseded by the file-backed direction (see roadmap).
- `v8.1/`, `v8.1.1/` — frozen legacy version folders kept for reference.

Older R&D version folders (`v1`–`v8.5`) live on the `archive/rnd-v1-v10`
branch. The version-folder workflow is retired — versions are now tracked
by git branch and tag.

## Branches

- `main` — stable release line.
- `production` — deployment checkpoint.
- `rnd/v11-md` — **active work**: refactoring storage to file-backed
  markdown boards served by a small local Node server.
- `rnd/v10` — previous R&D line (multi-board UI, overlays, redlines).
- `archive/*` — frozen snapshots (`archive/rnd-v1-v10`,
  `archive/main-pre-v11`).

## Current direction — v11-md

The keystone refactor: each board becomes one `.md` file on disk, served by
a local Node server, so the boards are portable, git-trackable, editable in
VS Code, and reachable by AI tools — while the canvas UI stays unchanged.
