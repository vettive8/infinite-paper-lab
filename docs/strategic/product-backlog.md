# Product backlog — parked, not scheduled

Ideas that fit the vision ([vision-and-commercial-path.md](vision-and-commercial-path.md))
but are **deliberately not being built yet**. The rule for this repo: features
get implemented when they answer a real, felt need in daily use — not because
the roadmap says so. This file is where good ideas wait for that moment.

## Next in line (highest conviction, still waiting for the felt need)

### Global search across boards
`Ctrl`+`Shift`+`F` → search every board's text from the canvas. Server-side
endpoint (`GET /api/search?q=`) that greps the `.md` files — the format makes
this nearly free. Results jump to the note on its board (the `?board=<id>`
URLs already exist). This is the feature that turns a pile of canvases into a
knowledge base.

### Board-to-board links
`[[board-title]]` in a text or markdown note renders as a clickable link that
opens that board. Combined with search, this is the Obsidian-crossover
feature — and AI agents writing boards get cross-references for free, since
the syntax is already the de-facto standard in `.md` tooling.

## Later / speculative

- **Connectors & arrows** between notes — the canvas category expects them;
  the format would need a new `type=edge` marker.
- **Backlinks panel** — "which boards link here" (cheap once links exist).
- **Board templates** — `POST /api/boards` from a template file; feeds the
  marketplace idea in the vision doc.
- **Mobile / touch support** — pan/zoom/edit on a tablet.
- **Export** — board → single flattened `.md` / PDF / PNG.
- **Cloud sync (Path A)** — end-to-end-encrypted sync of the notes folder;
  the commercial layer, only meaningful after daily-driver status.
- **First-party agents (Path B)** — agents that work on your boards
  (research, planning). The format is already agent-readable; this is a
  product layer, not an engine change.

## Engine work that stays on the main track (not this list)

Hardening, format fidelity, and refactors (module split of `app/script.js`,
legacy-migration removal) are maintenance, not product bets — they proceed
as needed without waiting here.
