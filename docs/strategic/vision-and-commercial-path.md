# Vision & commercial path

## What this app actually is (one-liner)

> **An infinite-canvas note app where every board is a plain Markdown file you
> own**, that AI tools and your own scripts can read and write directly — not
> a database, not a walled garden, not a vendor's cloud.

That single decision — `.md` files on disk as the source of truth — is the
asymmetric one. It's also the hardest to copy after the fact, because every
serious competitor (Notion, Heptabase, Mem) is built around a proprietary
database for a reason: lock-in.

## Why this is interesting now

Three forces converged in 2025–2026 that make this approach valuable:

1. **AI agents need a workspace.** Claude Code, Codex, Cursor, agentic IDEs —
   they all need somewhere to put thinking that survives between turns and
   that *they* can read. A canvas of `.md` files is exactly that. A Notion
   database isn't.
2. **People are tired of lock-in.** The Obsidian vs. Notion split is the
   visible tip — every knowledge worker who has lost a Notion DB or hit an
   export wall knows the feeling. "Your files on your disk" is becoming the
   default expectation, not a niche preference.
3. **Infinite canvases are eating linear documents** for certain workflows
   (research, planning, world-building, code architecture). tldraw, Excalidraw,
   Heptabase, Scrintal, Apple Freeform — the category is real and growing.

The intersection of those three — *AI-readable* + *user-owned files* + *infinite
canvas* — has approximately no good answer in the market today.

## Positioning vs. competitors

| Tool | Storage | AI-readable | Infinite canvas | Open source |
|---|---|---|---|---|
| Notion | Proprietary DB | API only, slow | No | No |
| Obsidian | `.md` on disk | Plugin-only | No (plugin) | Engine no |
| Heptabase | Proprietary DB | Limited API | Yes | No |
| tldraw | JSON blob | Via export | Yes | Yes (engine) |
| Excalidraw | JSON blob | Via export | Yes | Yes |
| Apple Freeform | iCloud only | No | Yes | No |
| **Infinite Paper** | **`.md` on disk** | **Native** | **Yes** | **Yes (planned)** |

The "AI-readable" column is the killer. None of the established players let an
agent open a file, edit it, save it, and have the user see the result on the
same canvas the next time they look. We get that for free because the files
*are* the canvas.

## The three differentiators that are hard to copy

1. **Plain Markdown is the storage format.** Notion can't switch — it'd
   destroy their DB-relations product. Heptabase can't switch — their whiteboard
   features are coupled to their DB schema. Anyone who switches loses years of
   migration work.
2. **No login, no cloud, no account.** First-run experience is "double-click
   the executable." A user can decide the tool is worth using in 30 seconds,
   not after a sign-up form and a tutorial.
3. **Local server + browser UI.** The app is a website that talks to a Node
   server on `127.0.0.1`. That means: no installer for the UI, browser
   keyboard shortcuts work, devtools are free, and the same engine can later
   serve a multi-user cloud version with one config change.

## Commercial paths (in order of complexity)

### Path A — Open core + cloud sync (the "Obsidian model")

- Open-source the engine and the local server. Free forever.
- Sell **end-to-end-encrypted cloud sync** so your boards follow you across
  machines. Subscription, ~$5/month.
- Sell **realtime multi-user collaboration** on top of the same sync layer
  for teams. ~$15/user/month.
- Margins are excellent because the local app is free to operate — the cloud
  bill scales only with paying users.

This is the proven path. Obsidian has executed it well; Logseq is trying it;
the gap is *infinite canvas + AI-native*.

### Path B — Vertical: AI workflow workspace ("Cursor for thinking")

- Bundle the engine with first-party AI agents that *work on your boards* —
  research agents, planning agents, code-architecture agents.
- Position it as "the IDE for thinking the way Cursor is the IDE for coding."
- Sell agent capacity (queries/month), agent capability (better models), and
  cloud sync.
- Pricing target: $20–50/month, individual; $50/user/month, team.

This is higher upside than A but requires building the agents well, and the
competitive landscape is moving fast (Notion AI, Mem, Heptabase AI).

### Path C — Marketplace + education

- Run a marketplace of board *templates* — sales pipelines, course plans,
  research workspaces, OKR boards. 30% take rate.
- Run *courses* taught on the app (a teacher's boards stream live to students).
- Smaller revenue ceiling, but a moat — and a community engine for paths A/B.

### Path D — Enterprise on-prem

- Sell a self-hosted multi-user edition to organisations that can't put their
  thinking in a US cloud (EU regulated industries, defense, R&D labs).
- $5K–50K/year per deployment, mostly support revenue.

## Phased monetisation

| Stage | Users | What you sell | Annual revenue target |
|---|---|---|---|
| 0 | 0–1k | Nothing. Polish + ship + talk to users. | $0 |
| 1 | 1k–10k | Path A: cloud sync ($5/mo). Founder-mode support. | $50–500k |
| 2 | 10k–100k | Path A + Path B early agents. Hire 1–2 engineers. | $500k–5M |
| 3 | 100k+ | Full Path A + Path B + Path C marketplace. Team. | $5M+ |

Path D opens up at stage 2 once the on-prem story is solid.

## What success looks like at each scale

- **Stage 0** (now): the tool replaces *your* Notion/Obsidian for *your* daily
  thinking. The dogfood test. If you don't reach for it, no one else will.
- **Stage 1**: a few thousand researchers, founders, writers, and product
  managers use it every day. Word-of-mouth in AI/maker Twitter.
- **Stage 2**: a category-defining brand. "Infinite Paper for X" is how people
  describe their own workflows. AI tools start integrating natively.
- **Stage 3**: the default thinking surface for AI-native knowledge work.
