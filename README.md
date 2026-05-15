# Infinite Paper Lab

This is a research and development workspace for testing simple infinite-paper note interfaces.

Each version folder is a separate experiment:

- `v1/` is the frozen first version: a full-screen white paper where clicking creates a writable note.
- `v2/` tests no automatic wrapping: lines only break when Enter is pressed.
- `v3/` keeps `v2` behavior and tests tighter Notepad-like line spacing.
- `v4/` keeps `v3` behavior and tests PDF-like `Ctrl` + `F` search navigation.
- `v5/` keeps `v4` behavior and tests `Ctrl` + `F` as a find-bar toggle.
- `v6/` keeps `v5` behavior and tests live note sync across tabs.
- `v7/` keeps `v6` behavior and tests right-drag selection plus left-drag movement.
- `v8.1/` keeps `v7` behavior and tests edge snapping while moving notes.
- `v8.2/` keeps `v7` behavior and tests text-line snapping while moving notes.
- `v8.3/` keeps `v7` behavior and tests `Shift`-constrained movement.
- `v8.4/` keeps `v7` behavior and tests keyboard alignment commands.
- `v8.5/` keeps `v7` behavior and tests visual alignment guides.

The rule for experiments:

1. Keep each major idea in its own version folder.
2. Do not rewrite older versions unless fixing a clear bug in that specific version.
3. Compare versions by feel: simplicity, speed, calmness, usefulness, and whether people naturally understand it.

Open a version directly in the browser, for example:

- `v1/index.html`
- `v2/index.html`
