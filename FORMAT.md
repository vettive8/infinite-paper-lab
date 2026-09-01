# Infinite Paper board file format

Each board is **one `.md` file** in the notes directory. Boards are the
durable source of truth — portable, git-trackable, editable in VS Code, and
readable by AI tools.

## Notes directory layout

```
InfinitePaper-Notes/          (NOTES_DIR — outside the app repo)
  boards/
    inbox.md
    business-ideas.md
  attachments/
    3f9a2b1c.png              (pasted images, named <imageId>.<ext>)
  trash/
    2026-07-21T09-15-02-000Z-old-board.md   (deleted boards, recoverable)
```

The notes directory is data, separate from the app repo (the tool). Its
location is set by the `NOTES_DIR` env var.

A board's **filename** is a slug of its title (`Business Ideas` ->
`business-ideas.md`); on a slug collision a short suffix is added. The
canonical identity is the `id` in frontmatter, never the filename — the app
finds boards by `id` and renames files when titles change. Deleting a board
moves its file into `trash/` with a timestamp prefix; recovery is moving it
back into `boards/`.

## Board file structure

```md
---
id: 3f9a2b1c-...
title: "Inbox"
pinned: true
folder: "2026-09-01 / FCAR"
order: 2
createdAt: 1778836932000
updatedAt: 1778836999000
lastOpenedAt: 1778837000000
revision: 1778836999000
view:
  x: 770
  y: 1389
  scale: 1.49
---

# Inbox

<!-- ip-note id=n1 type=text x=420 y=300 -->
I need to organize my notes.
<!-- /ip-note -->

<!-- ip-note id=n2 type=markdown x=40 y=600 width=520 height=640 -->
# A dropped document

Rendered as a formatted markdown note on the canvas.
<!-- /ip-note -->

<!-- ip-note id=n3 type=image x=900 y=520 width=500 height=260 rotation=0 flipX=false flipY=false crop=0,0,1,1 imageId=3f9a2b1c mimeType=image/png -->
![](../attachments/3f9a2b1c.png)
<!-- /ip-note -->
```

### Frontmatter

YAML between the opening and closing `---`. Holds board-level metadata:

- `id` — the canonical board identity (UUID).
- `title` — always double-quoted; `"` and `\` are backslash-escaped.
- `pinned` — `true`/`false`; pinned boards sort first in the overlay.
- `folder` — optional project/date folder shown in the Boards overlay. An
  empty string keeps the board at the top level. Folder names travel with the
  board in Git; older files without this field remain top-level boards.
- `order` — the board's position in the overlay list (drag to reorder).
- `createdAt` / `updatedAt` / `lastOpenedAt` — millisecond timestamps.
- `revision` — bumped on every app save (a monotonic timestamp). Saves
  through the API carry the revision the client last synced; the server
  rejects a save whose base is older than the file (see server.js).
- `view` — nested `x` / `y` / `scale`: the canvas pan and zoom.

The `# <title>` heading after the frontmatter is cosmetic (it makes the
file render nicely on GitHub / in preview); the app ignores it.

### Notes

Each note is an HTML comment marker, its body, then a closing marker. The
marker is on one line, `key=value` space-separated.

- **Text note** — `id`, `type=text`, `x`, `y`. Body: the note text,
  written verbatim — markdown (`#`, `**`, fenced code blocks) round-trips
  untouched.
- **Markdown note** (a dropped `.md` document, rendered on the canvas) —
  `id`, `type=markdown`, `x`, `y`, `width`, `height`. Body: the document
  source, verbatim.
- **Image note** — `id`, `type=image`, `x`, `y`, `width`, `height`,
  `rotation` (degrees), `flipX`, `flipY`, `crop` (`x,y,w,h` as 0–1
  fractions of the source image), `imageId`, `mimeType`. Body: a derived
  `![](../attachments/<imageId>.<ext>)` link so the file previews in any
  markdown viewer; the app resolves the image from `imageId` and rewrites
  the body on every save.

Image bytes live as real files in `attachments/`, uploaded by the app when
an image is pasted. They travel with the notes folder and work in any
browser.

### Known limitation

Note bodies are read up to the first `<!-- /ip-note -->`. A note body
containing that exact literal token would parse early. The token uses an
`ip-` prefix specifically to make this effectively never happen with
human-written notes; a future format revision may length-prefix bodies.
