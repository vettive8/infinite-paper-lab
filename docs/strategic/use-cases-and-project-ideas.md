# Use cases & project ideas

Concrete things you can build *on top of* Infinite Paper today, leveraging
its three superpowers:

- **Files are the truth.** Anything that can read/write a `.md` file can read
  and write your boards.
- **The canvas is spatial.** Position carries meaning — proximity = relation,
  columns = stages, rows = time.
- **The engine is scriptable.** A Node server on `127.0.0.1` means any local
  script, agent, or webhook can manipulate boards programmatically.

Twelve project ideas, ranked roughly by leverage:

---

### 1. Personal "second brain" with AI-readable thoughts

The default use, done well. One board per project, one board per long-term
theme. Daily journal as a single board with date-stamped notes. The killer
twist: every Claude / GPT / Gemini session you run on your machine can be
pointed at the notes folder, so AI tools answer questions over *your real
notes* without copy-paste.

**How:** point Claude Code at the notes folder. Ask "what was I thinking
about last Tuesday on the Infinite Paper board?" It reads the `.md`,
answers.

my notes:
- time automatically when it's the date-stamped and daily journal, every note can be sorted by a time - could be a setting for any board

---

### 2. Research workspace for a long-running investigation

Pick a research thread (a company you're considering joining, a market, a
science topic). One board per thread. Notes for sources, key quotes, open
questions. Images for screenshots. AI agents (perplexity-sonar style) can
write *new* notes to the board overnight with fresh findings.

**Why this app:** the canvas lets you put rival hypotheses side-by-side,
spatially. A linear doc can't.

---

### 3. Game design / world-building board

One board per game project. Image notes for mood boards, text notes for
character bios, markdown notes for rules. Multi-board for parallel game
projects.

**Why:** infinite zoom means a world map sits on the same canvas as a
character sheet. No need for separate tools.

---

### 4. Code architecture canvas

A board per service or per major refactor. Each box is a module; arrows
between them via simple text labels. Drop screenshots of diagrams from
older sources. The `.md` lives in your repo's `docs/` folder under git, so
the diagram travels with the code.

**Why:** the canvas is editable in seconds; Mermaid/PlantUML diagrams are
not.

---

### 5. AI prompt library + outputs

One board per "prompt family." Each prompt is a markdown note containing
the prompt text and notes about when to use it. Add another note next to
it with a sample output. Pin the board so it's always one Shift+Tab away
while you're working in another tool.

**Why:** prompts are spatial — variants of the same prompt naturally cluster.

---

### 6. Recruitment pipeline (one board per candidate, one super-board for stages)

Each candidate gets a board. The super-board has a column per stage (sourced,
screened, interviewed, offered). Each candidate's board can be opened in a
new tab via middle-click while keeping the pipeline visible.

**Why:** this is the [[pharmatalent-case-study]] workflow visualised. The
pipeline you built for PharmaTalent can write its results into Infinite Paper
boards directly — one `.md` per validated contact, organised into a hiring
canvas.

---

### 7. Sales / CRM canvas

A board per account, organised by relationship age and pipeline stage.
Email screenshots paste in as images. Meeting notes paste in as markdown
notes. Run an LLM over the board to summarise "where is this account at?"

**Why:** the canvas is the diagram salespeople already draw on whiteboards.

---

### 8. Daily journaling with Notion-style toggles

Once we ship toggles (see the `maxx-infp-with-content` board), each day's
journal becomes a board with one toggle per topic. The full content lives
in the toggle, the canvas stays scannable.

**Why:** journaling fails because the wall-of-text is intimidating to
reopen. Toggles flip that.

---

### 9. Course / curriculum builder

A board per course module. Each module is a column of lesson notes. Drop
screenshots of slides, notes on the lesson plan, links to videos. Export
the `.md` to feed an LMS, or share the canvas link to a student via the
multi-user cloud version (Path B in commercial doc).

**Why:** preparing a course is fundamentally a "what comes before what"
spatial problem.

---

### 10. Mind map → write-up pipeline

Mind-map a topic on the canvas (notes scattered + grouped). When ready,
collapse it into a linear article using an LLM that reads the board's `.md`
and outputs a coherent piece. Iterate by editing the board, regenerating
the write-up.

**Why:** the friction between thinking spatially and writing linearly is
real; this tool bridges it.

---

### 11. Team retro / async standup board

A board per sprint. Columns: kept-doing, will-stop, learned. Each team
member drops sticky-note-style text notes. Async retros work without a
meeting. The `.md` is exportable for the records.

**Why:** retros over chat are flat; on a canvas they cluster naturally.

---

### 12. Live presentation tool

Build a "presenter mode" where the canvas full-screens, the viewport
sequentially focuses on each note (zoom-and-pan), and the speaker controls
with arrow keys. Same boards, no PowerPoint.

**Why:** you already have pan/zoom; this is mostly a navigation layer.
Once it exists, you can sell the engine to educators (commercial Path C).

---

## Pattern — what unites these

Every idea above leverages **one or more of**:

- Spatial layout (mind map, pipeline, mood board, world map)
- AI working on your real `.md` files (journal, prompt library, write-up)
- Multi-board structure (super-board → per-item boards, like recruiting)
- Live multi-tab (presentation, dashboard, super-board)

Each idea also has a low-effort first version (1 board, no new code) and a
high-effort full version (custom agents, exports, sync). Start small,
ship the first version of one in an afternoon, iterate.
