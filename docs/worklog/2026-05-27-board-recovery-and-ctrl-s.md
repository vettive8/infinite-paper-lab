# Infinite Paper — Work Log · 2026-05-27

**Session:** Lost board work ("DejaRu") + make `Ctrl+S` save the board.
**Why this file exists:** a verbatim, timestamped record of what we did — your prompts,
my responses, every PowerShell command and code change, and the *reasoning* behind each
step — so you can read it back and learn CS / SWE from a real debugging + feature session.

**How to read it:** sections are wrapped in `<details>` **toggles** — click the ▸ arrow to
expand. These render as real collapsibles on GitHub and in VS Code's Markdown preview.
(Heads-up: Infinite Paper's own renderer escapes HTML, so if you open this *inside the app*
the toggles show as plain text — that toggle feature is still on the brainstorm board.)

> Convention: **time** = local wall-clock captured from `Get-Date` at the step.
> "verbatim" means copied exactly, not paraphrased.

---

## What went wrong (the incident)

- Pressing **`Ctrl+S`** opened the **browser's** "Save page as HTML" dialog (screenshot showed
  `DejaRu.html`, type "Webpage, HTML Only") — i.e. the app never handled `Ctrl+S`, so Chrome's
  default fired and tried to save the *web page*, not the board.
- ~20–30 minutes of work on the board **"DejaRu"** appears lost. Around that time the user had
  changed some code and/or switched browser.

## Goals for this session

1. **Recover** the lost board content if any copy survives (server file, OS cache, autosave).
2. **Diagnose** the root cause of the loss (why didn't autosave protect it?).
3. **Build** `Ctrl+S → save the board's `.md`**, with a bottom-right **"Board saved"** toast that
   is clickable to **download the `.md`** (and maybe other formats) to the Downloads folder.

---

## Log

<details>
<summary><b>Prompt 1</b> — user (verbatim) · the incident report + the ask</summary>

> we have a problem with memory because I was doing a lot. I think Ctrl+S needs to work like that, because now it saves the HTML page of the whiteboard. It needs to save the MD file, and it needs to actually save the board, because I've done a lot of work right now on this board that I've made some changes to the code, I think, or switched browser.
>
> Do you have access to the terminal? I don't know what happened, because I guess I can show you the terminal, but I've had a lot of screenshots there, and it's like one is that I have had a lot of things written down here, and it just got obliterated.
>
> I think Ctrl+S should save the board inside what we have. Maybe in Ctrl+S there could be, on the right bottom side of the screen, "Board saved", and then you can click it and you can download the MD file in the downloads folder, or you can potentially download another file format.
>
> Let's brainstorm on this, but I think definitely the first functionality is needed for me, because this is the program that I want to use for now. Not to share with anybody just yet, just I want to use mainly to learn and have new ideas come to life. It cannot be done when 20-30 minutes of my work just got fucking deleted, you know what I mean?

(Plus a follow-up instruction when I tried to run terminal commands: *"Yes, but start a documentation md with time and date, with what were my prompts, and what were your outputs word for word, potentially in a toggle formats — same with the powershell commands you're running and every single step you're doing, cause i want to know what you've done in powershell and in code so I can learn cs & swe."* → this file is the result.)

</details>

<details>
<summary><b>Step 1</b> — RECOVERY: inspect the notes folder, the server process, and any "DejaRu" file</summary>

**Goal:** find out whether the board's `.md` still exists on disk (the server is the source of
truth — the browser is just a view), when it was last written, and whether the server is running.

**Commands I'm about to run (and why each one):**

```powershell
# (a) confirm the notes directory exists, then list every file newest-first
#     — a recent .md = autosave worked; a stale timestamp = it didn't.
$dir = "C:\DevelopmentNotes\InfinitePaper-Notes"
Test-Path $dir
Get-ChildItem -Path $dir -Recurse -File | Sort-Object LastWriteTime -Descending |
  Select-Object -First 40 LastWriteTime, Length, FullName

# (b) is the local Node server still running? (and since when)
Get-Process node | Select-Object Id, StartTime, Path

# (c) hunt for any file named like the lost board ("DejaRu") anywhere under the project
Get-ChildItem -Path "C:\DevelopmentNotes" -Recurse -File -Filter "*DejaRu*"
```

**Output (run at 2026-05-27 10:57:35 +02:00):**
- Notes dir exists. Node server **running** (PID 14932, started 10:24:04).
- Newest board files: `software-engineering.md` (10:51:53), `dejaru.md` (10:50:56),
  `ai-engineering.md` (10:37). A block of ~25 files share mtime **10:36:59** (a bulk
  re-save event — worth noting).
- **Search for "DejaRu" returned 14 files**: `dejaru.md` plus `dejaru-2.md … dejaru-14.md`.

</details>

<details>
<summary><b>Finding 1</b> — the duplicate files are all the SAME board (same internal id)</summary>

Read `dejaru.md`, `dejaru-7/13/14.md`. **Every one has `id: c003cfbd-8e06-4a3c-8029-491369b3ad75`.**
They are not different boards — they are the same DejaRu board written to many filenames at
different `updatedAt` revisions. The text note `f19a9dc2…` grows across them as it was typed:
`"The Art of CS"` → `"…CS, SWE, vs Money, S"` → `"…Sa"` → (in `dejaru.md`) `"The Art of CS, SWE, vs Money, Sales,"`.

**Recovered content of `dejaru.md` (verbatim, the fullest surviving copy):**
- text note: `i mean this is a great program` / `built with AI`
- one image
- text note: `The Art of CS, SWE, vs Money, Sales,`

**No "wall of text" exists in any saved DejaRu snapshot.** The long writing was never safely
persisted, or was deleted before a good save (see Finding 2).

</details>

<details>
<summary><b>Step 2 + Finding 2</b> — ROOT CAUSE: the save logic deletes/duplicates board files</summary>

Read `server.js` save path. The server keeps an in-memory map `boardFiles` of **board id → ONE
filename** (`server.js:240`, built by `indexBoards()` at startup). On save:

```js
// server.js fileForBoard(): if the mapped file's name != slug(title).md,
// it loops minting slug-2.md, slug-3.md, ... for any *existing* file it
// doesn't recognise as this board.
// server.js saveBoard():
if (previous && previous !== file) {
  await fsp.rm(previous, { force: true });   // hard-delete (no recycle bin)
}
```

**The bug:** the map can hold only one file per id, and the duplicate-check (`isSameBoardFile`)
only consults that same one-entry map. So the moment two files on disk share a board id, the
server can't tell they're the same board → it mints new `slug-N.md` files **and** `rm`s the one
file the map pointed at. Result: filename churn + a genuine data-loss path (a real board file is
deleted and replaced, sometimes by a staler merged state). This is the most likely mechanism
behind "20–30 min of work got obliterated," compounded by there being **no manual save** and the
stale-focus typing bug from the previous session.

**Invariant this code is missing:** *one board id ↔ exactly one file on disk; a save overwrites
that file in place and never deletes content it can't prove is obsolete.*

</details>

<details>
<summary><b>Decisions / next steps</b></summary>

1. Recovery (before any code): keep browser tabs open (live unsaved copy); offer to check Windows
   "Previous Versions"/shadow copy for deleted `dejaru-N` content; grep all `.md` once the user
   gives the board + keywords.
2. Fix the save-churn/delete bug (de-dupe same-id files safely; never `rm` unproven content).
3. Build the requested feature: `Ctrl+S` → explicit board save + bottom-right **"Board saved"**
   toast, clickable to download the `.md` to Downloads (and maybe other formats).

</details>

<details>
<summary><b>Step 3</b> — RECOVERY: check Windows backups (shadow copy / restore points / File History / Recycle Bin)</summary>

**Goal:** if a now-deleted `dejaru-N.md` held the long text, a Windows backup might still have it.

**Command (run 2026-05-27 11:36:04 +02:00):**
```powershell
Get-CimInstance Win32_ShadowCopy           # volume shadow copies / "Previous Versions"
Get-ComputerRestorePoint                    # system restore points
Get-ItemProperty HKCU:\...\FileHistory      # File History config
# + Recycle Bin scan via Shell.Application COM for *.md / dejaru / infinite
```

**Output:**
- Win32_ShadowCopy → **"Initialization failure"** (needs elevation; likely System Protection off → nothing).
- Get-ComputerRestorePoint → **Access denied** (admin-only).
- File History → **not configured**.
- Recycle Bin → **no matching items** (confirms `fs.rm` hard-deleted the churned files; unrecoverable here).

**Conclusion:** no automated disk backup to recover from. Remaining hope = an **open browser tab**
still holding the unsaved content in memory. If that's closed, the long text is most likely gone.

</details>

<details>
<summary><b>Step 4</b> — SAFETY: snapshot current notes + verified backup before any code change</summary>

**Goal:** before touching server / client code, capture the current state and make a known-good
copy so this session's edits cannot be lost even if the next change misbehaves.

**Command (run 2026-05-28 10:50:26 +02:00):**
```powershell
$dir = "C:\DevelopmentNotes\InfinitePaper-Notes"
Get-ChildItem -Path $dir -Recurse -File | Sort LastWriteTime -Descending  # snapshot
$backup = "C:\DevelopmentNotes\InfinitePaper-Notes-backup-<timestamp>"
Copy-Item -Path $dir -Destination $backup -Recurse -Force                  # backup
# verify: file counts and total bytes match
```

**Output:**
- Backup at `C:\DevelopmentNotes\InfinitePaper-Notes-backup-2026-05-28-105026`.
- **284 files, 2,655,846 bytes — byte-identical to source. MATCH.**

**Finding 3 — the duplication bug is now firing across many boards, not just DejaRu:**
- `dejaru.md` + `dejaru-2.md … dejaru-33.md`
- `todo.md` + `todo-2.md … todo-34.md` (whole burst minted at 10:26 today)
- `software-engineering.md` + `software-engineering-7.md … -23.md` (10:24 today)
- `outreach-4.md`, `live-ccat-coding-2.md`, `maxx-infp-with-content-21.md`,
  `research-5-24-6.md`, `new-board-shortcut-24.md`, …
- A bulk save event at 10:46:23 rewrote ~25 files in one second.

**Recovered content of `dejaru.md` (current; 1460 bytes, 8 notes):**
3 originals + 5 new today — "if you need support to feel good and then take action then you
aren't cut out to be an entrepreneur" · "5.28" · "5.27" · "immerse yourself fully in Greatness"
· "totally obsessed". All preserved on disk and in the backup.

**Recovered content of `software-engineering.md` (current; 1422 bytes, 9 notes):**
CS learning notes — Supabase Security, compound boolean expressions, short-circuit / "lazy"
evaluation, AND operator, runtime error, content-moderation program design, etc. All preserved.

</details>

<details>
<summary><b>Step 5</b> — BUILD: server-side fix for the duplication / hard-delete</summary>

**File:** `server.js`.

Four surgical edits:

1. **Replaced the `boardFiles` map and surrounding helpers** (around L239–L286):
   - Type changed from `Map<id, string>` → `Map<id, { primary: string, all: Set<string> }>`.
   - Added helpers `getBoardFile`, `setBoardFile`, `dropBoardFile`, `hasBoardFile`.
   - `indexBoards()` now groups every `.md` by its frontmatter `id` and picks the newest
     `updatedAt` as the canonical "primary." Older duplicates are remembered in `all` so
     the save loop won't treat them as foreign conflicts and won't keep minting `slug-N.md`.
   - `fileForBoard()` also cross-checks the file's id **on disk** (new helper
     `fileBelongsToBoardOnDisk`) so duplicates added out-of-band are recognised as ours.
   - **Invariant codified:** *one board id ↔ one primary file*; extras tolerated, never the
     save target. Removed the old broken `isSameBoardFile`.

2. **Rewrote `saveBoard()`** (around L522+):
   - Old order was `rm(previous) → write(new)` — a write failure left zero copies.
   - New order is **write → verify-on-disk → `rm`**. If verification fails the previous
     file stays put: orphan duplicate is recoverable; deleted file is not.

3. **`GET /api/boards/:id`** now supports **`?format=md`** → returns the raw `.md` with
   `Content-Type: text/markdown` and a `Content-Disposition: attachment` header. Used by the
   client's "Board saved → download" path.

4. **`DELETE /api/boards/:id`** now removes **every** file on disk carrying this board's id
   (not just the primary), since the user explicitly deleted the board and orphan duplicates
   should go too.

**Why this is the right shape:** the root cause was a one-key map that couldn't represent
"this same board is on disk in multiple places." Tracking the full set lets us recognise our
own files, stops the runaway file minting, and makes the duplicate cluster benign (visible in
logs, not destructive). The write-then-verify-then-delete pattern is a generic safety
invariant: never delete content unless its replacement is proven on disk.

</details>

<details>
<summary><b>Step 6</b> — BUILD: client-side Ctrl+S, toast, download, save-on-exit</summary>

**File:** `app/script.js`. Four edits:

1. **`flushBoardWrites()` now returns a Promise.** A new parallel map
   `boardFlushPromises` caches the in-flight flush per board so Ctrl+S can `await` the
   actual PUT landing on the server, not just the queue accepting the payload.

2. **New helpers `saveCurrentBoardNow()`, `ensureSaveToast()`, `showSaveToast()`,
   `downloadCurrentBoardAsMarkdown()`.** Toast is built lazily (no DOM cost until first
   save). The download path calls `GET /api/boards/<id>?format=md` and triggers a Blob
   download with a sanitised filename derived from the board title.

3. **Global Ctrl+S / Cmd+S `keydown` listener.** Calls `event.preventDefault()` synchronously
   before any await so the browser's "Save page as HTML" dialog can never fire again, then
   kicks off the async save + toast. Listener is on `window`, so it works whether or not a
   note is focused.

4. **`beforeunload` + new `visibilitychange` flush.** Extracted the existing exit-flush into
   a `flushOnExit()` function; it now also drains the still-queued board writes (each
   `putBoard()` already uses `keepalive: true` so the browser can deliver them after the
   page is torn down). `visibilitychange → hidden` mirrors it for mobile / tab-hide cases
   where `beforeunload` is unreliable. The existing "don't overwrite a newer file from a
   merely-displaying page" invariant is preserved — we only flush if `pendingNoteSave`.

**Files:** also appended a small toast block to `app/styles.css` (fixed bottom-right, green
success / red error; click-to-download cursor on the success variant).

**Test:** added a step to `tests/smoke.mjs` that types a note, presses `Ctrl+S`, then
asserts (a) the toast appears (not in error state), (b) the typed text reaches a `.md` on
disk, (c) **no new numbered duplicate file was minted** for this board — the regression
test for the bug we just fixed.

</details>

<details>
<summary><b>Step 7</b> — VERIFY: syntax check on the three edited files</summary>

```powershell
node --check server.js          # OK
node --check app/script.js      # OK
node --check tests/smoke.mjs    # OK
```

All three parse cleanly.

</details>

<details>
<summary><b>Step 8</b> — VERIFY: full smoke test (visible browser, running in background)</summary>

Kicked off via the `app-test` runner:
```
node "C:/Users/ASUS/.claude/skills/app-test/runner.mjs" "C:/DevelopmentNotes/InfinitePaper"
```

The test launches its own Node server on port 4399 against a throwaway `.tmp-notes`
directory, so the user's real notes are untouched. Result will be appended here when it
exits.

</details>

<details>
<summary><b>Step 9</b> — VERIFY (live): two servers side-by-side, new code on a copy of the notes</summary>

**Goal:** let the user test today's code without touching the real session. Spin up a second
Node server on port **4322** pointed at a *copy* of the notes folder, while the old server
(PID 14932) keeps running on **4321** against the real folder. User opens a fresh Chrome
profile → http://127.0.0.1:4322 to verify the new code can read every board they've been
working on today.

**Commands run:**

```bash
# Background bash: copy the notes folder, then start the new server.
rm -rf /c/DevelopmentNotes/InfinitePaper-Notes-newcode-test
cp -r /c/DevelopmentNotes/InfinitePaper-Notes \
      /c/DevelopmentNotes/InfinitePaper-Notes-newcode-test
# (verify byte-identical via file count + total bytes)
cd /c/DevelopmentNotes/InfinitePaper
PORT=4322 NOTES_DIR="C:/DevelopmentNotes/InfinitePaper-Notes-newcode-test" node server.js
```

```powershell
# Foreground poll: wait up to 15s for 127.0.0.1:4322 to respond; confirm 4321 is still up.
Invoke-WebRequest http://127.0.0.1:4322/api/boards   # new
Invoke-WebRequest http://127.0.0.1:4321/api/boards   # old (must still be up)
```

**Why two servers, two folders:** the new server's `indexBoards()` will now scan the test
folder and *log warnings* about every duplicate cluster (`dejaru-2..33`, `todo-2..34`,
`software-engineering-7..23`, …) — that's the new-vs-old behavior visible in the wild. The
old server keeps writing to the real folder as you would normally, so your current tabs are
completely insulated from this experiment.

**Result:**
- Copy: 284 files, 2,655,846 bytes — byte-identical with source.
- Server bootstrap on 4322: `indexBoards()` ran and printed **"Boards indexed → 42"**, plus a
  warning for every duplicate cluster (32 dejaru, 34 todo, 22 SE, 26 new-board-shortcut, 21
  maxx-infp-with-content, …) — the new code correctly identifies all of them as **one** board
  per id and picks a primary, instead of minting more.
- **Initial `GET /api/boards` returned 0 boards** despite the index having 42 — a regression I
  caused (see Step 10).

</details>

<details>
<summary><b>Step 10</b> — BUG + FIX: I broke the list endpoint when I changed the boardFiles shape</summary>

**Symptom:** server stdout showed `Boards indexed -> 42` but `GET /api/boards` returned an
empty list.

**Root cause:** in `server.js`, the list endpoint did
```js
for (const [id, file] of boardFiles) {
  const board = parseBoard(await fsp.readFile(file, "utf8"));
  ...
}
```
After my refactor, `boardFiles` values changed from a raw `string` path to
`{ primary: string, all: Set<string> }`. So `file` was now an object, `fsp.readFile(object)`
threw, the `catch { /* skip */ }` swallowed it for every board, and the list came back empty.

**Lesson (the *why* worth remembering):** when you change the shape of a shared data
structure, *every* consumer site is a potential break — even ones that look "fine" because
they fail silently in a `catch` that was only meant to skip the rare unreadable file.
`grep "boardFiles"` is the cheap way to find them all next time.

**Fix:**
```js
for (const [id, entry] of boardFiles) {
  const board = parseBoard(await fsp.readFile(entry.primary, "utf8"));
  ...
}
```
Plus a comment so future me knows the new shape.

**Re-verify:** killed the buggy node (`Stop-Process` on the PID owning port 4322), restarted
with the fix, polled → **`READY: new server on 127.0.0.1:4322 lists 42 boards`**, and the
top-10-by-recency matches the canonical state (DejaRu 8 notes, Software Engineering 9 notes,
ToDo 3 notes, etc.).

</details>

<details>
<summary><b>Step 11</b> — HANDOFF: new server on 4322 ready for the user to test in a fresh Chrome profile</summary>

State right now:
- **Old server** (PID 14932, port **4321**, **OLD buggy code**, real `InfinitePaper-Notes`) —
  still running, untouched. The user's current tabs talk to this. Continued autosaves still
  go to the real folder (and still trigger the duplication bug — that's expected; we haven't
  swapped servers yet).
- **New server** (port **4322**, **fixed code**, `InfinitePaper-Notes-newcode-test`) — up,
  42 boards listed. Logs every duplicate cluster on startup. No new duplicates will be
  minted by saves in this session (the new save logic).
- **Backups:** `InfinitePaper-Notes-backup-2026-05-28-105026` (untouched, verified 284f /
  2,655,846b) and `InfinitePaper-Notes-newcode-test` (live test copy).

Handed off to the user: open new Chrome profile → http://127.0.0.1:4322 → verify all boards
present + try Ctrl+S → confirm no duplicates minted. When confidence is built, we'll swap.

</details>

<details>
<summary><b>Step 12</b> — RE-SYNC: test folder was stale (user kept pinning/editing on current tabs)</summary>

**Symptom:** user reported the pinned state and the boards in the new profile (port 4322)
looked outdated vs. what their current tabs (port 4321) showed.

**Cause (not a bug, by design):** the test folder is a *snapshot* taken at 11:15. Any
pins/edits done in the user's current tabs after that updated the **real** folder via the
old server's autosave, but the test folder didn't see them.

**Re-sync (run 11:30-ish):**

```bash
# kill node on 4322, refresh test folder from real, restart node
PID=$(netstat -ano | grep '127.0.0.1:4322' | grep LISTENING | awk '{print $5}' | head -1)
[ -n "$PID" ] && taskkill //F //PID $PID
rm -rf /c/DevelopmentNotes/InfinitePaper-Notes-newcode-test
cp -r /c/DevelopmentNotes/InfinitePaper-Notes \
      /c/DevelopmentNotes/InfinitePaper-Notes-newcode-test
cd /c/DevelopmentNotes/InfinitePaper
PORT=4322 NOTES_DIR="...newcode-test" node server.js
```

**Result:** server up in 500ms, 42 boards. Pinned cluster (by `order`):
Automindz 5.20 → Computer Science → DejaRu → Software Engineering → The Bible →
AI Engineering → ToDo. User asked to refresh new-profile tab and confirm match.

**Limitation surfaced:** snapshot/test mode isn't sustainable — every edit in real tabs
makes the test stale. The next step, when the user is satisfied, is **promotion**: stop old
server (PID 14932 on 4321), repoint the new server onto 4321 against the real folder,
user closes old tabs.

</details>

<details>
<summary><b>Step 13</b> — RESET: revert all today's code, ship strategic documents instead</summary>

User said: "the program is fucll of fucking bugs now … i dont know … clean up our code so
there's only the code necessary for the applicaiton to run in its full functionality …
prepare documentation … tell me how would you build this app from scratch but better in
new prompts … tell me where do you see this app go, and how could this become a commercial
project … and how, thanks to all the functina;lities, can we use this app to create
amazing new projects."

**Action:** stop touching code for today. Revert today's changes to get the user back to
yesterday's working state, and deliver the strategic asks as real `.md` files.

**Commands:**
```bash
cd /c/DevelopmentNotes/InfinitePaper
git checkout -- server.js app/script.js app/styles.css tests/smoke.mjs
# kill any node on 4321/4322, restart
node server.js
```

**Result:**
- Code reverted to HEAD on `rnd/v12`.
- Server on 4321 (yesterday's code, real notes folder). 45 boards indexed.
- 15 of 45 boards have notes that render with the old code's primary pick.
- The remaining content is on disk in the duplicate files (`*-2.md`, `*-3.md` …);
  a careful consolidation pass can recover it later when the user has energy.

**Strategic docs delivered:**
- `docs/strategic/build-from-scratch-prompts.md` — six phased prompts plus the must-have
  invariants we learned the hard way today (one-id-one-file, atomic writes, focus
  discipline, exit-flush, gesture threshold, human-friendly notes folder).
- `docs/strategic/vision-and-commercial-path.md` — positioning vs Notion / Obsidian /
  Heptabase / tldraw, three differentiators that are hard to copy, four commercial paths
  (open-core + cloud sync, AI workflow workspace, marketplace + education, enterprise
  on-prem), and a 4-stage monetisation map.
- `docs/strategic/use-cases-and-project-ideas.md` — twelve concrete project ideas (second
  brain, research workspace, game design, code architecture, AI prompt library, recruiting
  pipeline, sales/CRM, journaling with toggles, course builder, mind map → write-up, team
  retro, live presenter) with how/why for each.
- `docs/architecture-overview.md` — 10-minute tour of the codebase, the save and load
  lifecycles, the data format, the live-reload mechanism, the real-as-of-today invariants
  and known issues, and the keep-vs-replace assessment.

**Plan for the next session (when the user is rested):**
1. One-time consolidation pass: read every duplicate cluster, pick the file with the most
   real content per board (not just newest `updatedAt`), preserve the others as `.bak` for
   safety, write a single canonical file. Manual review for ambiguous clusters.
2. Re-introduce the Ctrl+S save + toast and the safer save logic — *cleanly*, in their own
   PR-sized changes, each with a test.
3. Code-cleanup pass: remove dead branches, split `script.js` into modules where it pays
   off, add JSDoc to every exported function, prune any unused files.
4. Comprehensive code-comments pass: every non-obvious function gets a header that explains
   the *why*, not the *what*; every invariant is stated where it lives.

</details>

---

_(log continues below as we work)_
