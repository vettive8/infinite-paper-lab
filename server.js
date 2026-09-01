/**
 * Infinite Paper local server (v11-md).
 *
 * Serves the app/ folder and exposes a small API that reads and writes
 * boards as .md files on disk, so the boards are portable, git-trackable,
 * editable in VS Code, and reachable by AI tools.
 *
 * No dependencies — Node 18+ built-ins only.
 *   node server.js              (or: npm start, or start.bat)
 *
 * Config via env: PORT, HOST, NOTES_DIR.
 */

import http from "node:http";
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import url from "node:url";
import os from "node:os";
import crypto from "node:crypto";

import { slugify, serializeBoard, parseBoard } from "./lib/board-format.js";
import { preferBoardIndexCandidate } from "./lib/board-index.js";
import { serializeKnowledgeMarkdown } from "./lib/knowledge-export.js";

const ROOT = path.dirname(url.fileURLToPath(import.meta.url));
const APP_DIR = path.join(ROOT, "app");

const PORT = Number(process.env.PORT) || 4321;
const HOST = process.env.HOST || "127.0.0.1";
// Default notes location: the legacy Windows path if it already holds
// notes, otherwise a folder in the user's home directory (cross-platform).
const LEGACY_NOTES_DIR = "C:\\DevelopmentNotes\\InfinitePaper-Notes";
const NOTES_DIR =
  process.env.NOTES_DIR ||
  (fs.existsSync(LEGACY_NOTES_DIR)
    ? LEGACY_NOTES_DIR
    : path.join(os.homedir(), "InfinitePaper-Notes"));
const BOARDS_DIR = path.join(NOTES_DIR, "boards");
const ATTACHMENTS_DIR = path.join(NOTES_DIR, "attachments");
const TRASH_DIR = path.join(NOTES_DIR, "trash");

const CONTENT_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".ps1": "text/plain; charset=utf-8",
};

// --- board file index (id -> file) --------------------------------------

/** Map of board id -> absolute .md file path. */
const boardFiles = new Map();

async function indexBoards() {
  let entries = [];
  try {
    entries = await fsp.readdir(BOARDS_DIR);
  } catch {
    return;
  }
  const candidatesById = new Map();
  const duplicateCounts = new Map();
  for (const name of entries) {
    if (!name.endsWith(".md")) continue;
    const file = path.join(BOARDS_DIR, name);
    try {
      const board = parseBoard(await fsp.readFile(file, "utf8"));
      if (!board.id) continue;
      const current = candidatesById.get(board.id);
      if (current) {
        duplicateCounts.set(board.id, (duplicateCounts.get(board.id) || 1) + 1);
      }
      candidatesById.set(
        board.id,
        preferBoardIndexCandidate(current, { file, board })
      );
    } catch {
      /* skip unreadable board files */
    }
  }

  // Build the complete replacement before touching the live map. The old
  // implementation cleared boardFiles before asynchronous reads; API requests
  // arriving during that gap believed existing boards were new and created
  // suffixed duplicate files on every keystroke.
  boardFiles.clear();
  for (const [id, candidate] of candidatesById) {
    boardFiles.set(id, candidate.file);
  }

  if (duplicateCounts.size) {
    const extraFiles = [...duplicateCounts.values()].reduce(
      (total, count) => total + count - 1,
      0
    );
    console.warn(
      `duplicate board ids detected -> ${duplicateCounts.size} id(s), ${extraFiles} extra file(s); newest revisions selected`
    );
  }
}

/** Pick a free .md filename for a board, reusing its current file if any. */
function fileForBoard(board) {
  const existing = boardFiles.get(board.id);
  const desired = path.join(BOARDS_DIR, `${slugify(board.title)}.md`);
  if (existing && path.basename(existing) === path.basename(desired)) {
    return existing;
  }
  let candidate = desired;
  let n = 2;
  while (
    fs.existsSync(candidate) &&
    boardFiles.get(board.id) !== candidate &&
    !isSameBoardFile(candidate, board.id)
  ) {
    candidate = path.join(BOARDS_DIR, `${slugify(board.title)}-${n++}.md`);
  }
  return candidate;
}

/**
 * Write via a temp file + rename so a crash mid-write can never leave a
 * half-written board on disk. The temp name has no .md extension, so the
 * board index and the folder watch skip it.
 */
async function writeFileAtomic(file, content) {
  const tmp = `${file}.${process.pid}.tmp`;
  await fsp.writeFile(tmp, content, "utf8");
  await fsp.rename(tmp, file);
}

/** Move a board file to NOTES_DIR/trash instead of destroying it. */
async function trashBoardFile(file) {
  await fsp.mkdir(TRASH_DIR, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const target = path.join(TRASH_DIR, `${stamp}-${path.basename(file)}`);
  try {
    await fsp.rename(file, target);
  } catch {
    // Cross-device or locked file: fall back to copy + delete.
    await fsp.copyFile(file, target);
    await fsp.rm(file, { force: true });
  }
}

function isSameBoardFile(file, id) {
  for (const [bid, f] of boardFiles) {
    if (f === file) return bid === id;
  }
  // The index may intentionally point at a newer suffixed recovery snapshot.
  // Check the desired canonical file itself before treating its filename as a
  // collision; otherwise saving the recovered board would create yet another
  // suffix instead of safely promoting the latest content.
  try {
    return parseBoard(fs.readFileSync(file, "utf8")).id === id;
  } catch {
    return false;
  }
}

// --- request helpers -----------------------------------------------------

function sendJson(res, status, data) {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
    "Cache-Control": "no-store",
  });
  res.end(body);
}

function sendMarkdownDownload(res, filename, content) {
  const safeName = String(filename || "board.md").replace(/[^a-z0-9._-]/gi, "-");
  res.writeHead(200, {
    "Content-Type": "text/markdown; charset=utf-8",
    "Content-Length": Buffer.byteLength(content),
    "Content-Disposition": `attachment; filename="${safeName}"`,
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  });
  res.end(content);
}

function readBody(req, limit = 64 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", (c) => {
      size += c.length;
      if (size > limit) {
        reject(new Error("payload too large"));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

// --- file-change events (SSE) -------------------------------------------

const sseClients = new Set();
let watchTimer = null;

function broadcastBoardsChanged() {
  const payload = `event: boards-changed\ndata: ${Date.now()}\n\n`;
  for (const res of sseClients) res.write(payload);
}

function watchBoards() {
  try {
    fs.watch(BOARDS_DIR, (event, filename) => {
      clearTimeout(watchTimer);
      watchTimer = setTimeout(async () => {
        await indexBoards();
        console.log(
          `boards changed (${filename}) -> ${sseClients.size} live client(s)`
        );
        broadcastBoardsChanged();
      }, 150);
    });
  } catch (err) {
    console.warn("board folder watch unavailable:", err.message);
  }
}

// --- routing -------------------------------------------------------------

async function handleApi(req, res, pathname) {
  // GET /api/boards  -> index (metadata + note counts, no bodies)
  if (pathname === "/api/boards" && req.method === "GET") {
    const list = [];
    for (const [id, file] of boardFiles) {
      try {
        const board = parseBoard(await fsp.readFile(file, "utf8"));
        list.push({
          id,
          title: board.title,
          pinned: board.pinned,
          folder: board.folder || "",
          order: board.order,
          createdAt: board.createdAt,
          updatedAt: board.updatedAt,
          lastOpenedAt: board.lastOpenedAt,
          revision: board.revision,
          view: board.view,
          noteCount: board.notes.length,
        });
      } catch {
        /* skip */
      }
    }
    return sendJson(res, 200, { boards: list });
  }

  // POST /api/boards  -> create/replace a board (id taken from body)
  if (pathname === "/api/boards" && req.method === "POST") {
    return saveBoard(req, res);
  }

  // POST /api/import?name=<filename>  -> create a new board from a dropped
  // markdown file. An Infinite Paper board file is parsed as-is; any other
  // markdown file becomes a board holding the whole document as one note.
  if (pathname === "/api/import" && req.method === "POST") {
    try {
      const raw = (await readBody(req)).toString("utf8");
      const name = new url.URL(req.url, "http://localhost").searchParams.get(
        "name"
      );
      const now = Date.now();
      let board;
      if (/<!--\s*ip-note\b/.test(raw)) {
        board = parseBoard(raw);
      } else {
        const title =
          String(name || "")
            .replace(/\.md$/i, "")
            .replace(/[_-]+/g, " ")
            .trim() || "Imported note";
        board = {
          id: "",
          title,
          pinned: false,
          folder: "",
          order: 0,
          createdAt: now,
          updatedAt: now,
          lastOpenedAt: now,
          revision: 1,
          view: { x: 0, y: 0, scale: 1 },
          notes: [
            { id: crypto.randomUUID(), type: "markdown", x: 0, y: 0, text: raw },
          ],
        };
      }
      board.id = crypto.randomUUID(); // a fresh id so it never collides
      board.createdAt = now;
      board.updatedAt = now;
      board.lastOpenedAt = now;
      const file = fileForBoard(board);
      await writeFileAtomic(file, serializeBoard(board));
      boardFiles.set(board.id, file);
      return sendJson(res, 200, { board });
    } catch (err) {
      return sendJson(res, 500, { error: err.message });
    }
  }

  const boardDownloadMatch = pathname.match(/^\/api\/boards\/([^/]+)\/download$/);
  if (boardDownloadMatch && req.method === "GET") {
    const id = decodeURIComponent(boardDownloadMatch[1]);
    const file = boardFiles.get(id);
    if (!file) return sendJson(res, 404, { error: "board not found" });
    const format = new url.URL(req.url, "http://localhost").searchParams.get("format");
    try {
      const source = await fsp.readFile(file, "utf8");
      const board = parseBoard(source);
      const baseName = slugify(board.title);
      if (format === "board") {
        return sendMarkdownDownload(res, `${baseName}.board.md`, source);
      }
      if (format === "knowledge") {
        return sendMarkdownDownload(
          res,
          `${baseName}.knowledge.md`,
          serializeKnowledgeMarkdown(board)
        );
      }
      return sendJson(res, 400, { error: "unknown download format" });
    } catch (err) {
      return sendJson(res, 500, { error: err.message });
    }
  }

  const boardMatch = pathname.match(/^\/api\/boards\/([^/]+)$/);
  if (boardMatch) {
    const id = decodeURIComponent(boardMatch[1]);

    if (req.method === "GET") {
      const file = boardFiles.get(id);
      if (!file) return sendJson(res, 404, { error: "board not found" });
      try {
        const board = parseBoard(await fsp.readFile(file, "utf8"));
        return sendJson(res, 200, { board });
      } catch (err) {
        return sendJson(res, 500, { error: err.message });
      }
    }

    if (req.method === "PUT") {
      return saveBoard(req, res, id);
    }

    if (req.method === "DELETE") {
      const file = boardFiles.get(id);
      if (file) {
        await trashBoardFile(file);
        boardFiles.delete(id);
        broadcastBoardsChanged();
      }
      return sendJson(res, 200, { ok: true });
    }
  }

  // POST /api/attachments?id=<imageId>&ext=png  -> store an image file
  if (pathname === "/api/attachments" && req.method === "POST") {
    const query = new url.URL(req.url, "http://localhost").searchParams;
    const ext = (query.get("ext") || "png").replace(/[^a-z0-9]/gi, "") || "png";
    const id = (query.get("id") || crypto.randomUUID()).replace(
      /[^a-z0-9-]/gi,
      ""
    );
    try {
      const bytes = await readBody(req);
      const name = `${id}.${ext}`;
      await fsp.writeFile(path.join(ATTACHMENTS_DIR, name), bytes);
      return sendJson(res, 200, {
        imageId: id,
        src: `attachments/${name}`,
        mimeType: CONTENT_TYPES[`.${ext}`] || "image/png",
      });
    } catch (err) {
      return sendJson(res, 500, { error: err.message });
    }
  }

  // GET /api/events  -> server-sent events for external file changes
  if (pathname === "/api/events" && req.method === "GET") {
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-store",
      Connection: "keep-alive",
    });
    res.write("retry: 2000\n\n");
    sseClients.add(res);
    req.on("close", () => sseClients.delete(res));
    return;
  }

  return sendJson(res, 404, { error: "unknown endpoint" });
}

/** Merge an incoming (possibly partial) board over what is on disk. */
function mergeBoard(base, incoming) {
  const fallback = base || {
    id: incoming.id,
    title: "Untitled board",
    pinned: false,
    folder: "",
    order: 0,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    lastOpenedAt: Date.now(),
    revision: 0,
    view: { x: 0, y: 0, scale: 1 },
    notes: [],
  };
  const pick = (key) => (incoming[key] != null ? incoming[key] : fallback[key]);
  return {
    id: incoming.id,
    title: pick("title"),
    pinned: pick("pinned"),
    folder: pick("folder") || "",
    order: pick("order"),
    createdAt: pick("createdAt"),
    updatedAt: pick("updatedAt"),
    lastOpenedAt: pick("lastOpenedAt"),
    revision: pick("revision"),
    view: pick("view"),
    notes: pick("notes"),
  };
}

async function saveBoard(req, res, idFromPath) {
  let payload;
  try {
    payload = JSON.parse((await readBody(req)).toString("utf8"));
  } catch {
    return sendJson(res, 400, { error: "invalid JSON" });
  }
  const incoming = payload && payload.board ? payload.board : payload;
  if (!incoming || typeof incoming.id !== "string") {
    return sendJson(res, 400, { error: "board.id is required" });
  }
  if (idFromPath && incoming.id !== idFromPath) {
    return sendJson(res, 400, { error: "board id mismatch" });
  }

  try {
    const previous = boardFiles.get(incoming.id);
    let base = null;
    if (previous) {
      try {
        base = parseBoard(await fsp.readFile(previous, "utf8"));
      } catch {
        base = null;
      }
    }
    // Optimistic concurrency: the client sends baseRevision — the revision
    // it last loaded/synced. If the file has moved *past* that (another tab
    // or an API client wrote meanwhile), reject with the current board so
    // the caller can reload instead of silently overwriting the newer save.
    // A disk revision *behind* baseRevision (e.g. a lost earlier save) is
    // not a conflict — the incoming copy is the fresher one.
    const baseRevision = Number(incoming.baseRevision);
    if (
      base &&
      Number.isFinite(baseRevision) &&
      Number(base.revision) > baseRevision
    ) {
      return sendJson(res, 409, { error: "revision conflict", board: base });
    }

    const board = mergeBoard(base, incoming);
    const file = fileForBoard(board);
    const content = serializeBoard(board);

    // Idempotent: skip the write (and the mtime/watch churn) when the
    // file already holds exactly this content.
    let unchanged = false;
    if (previous === file) {
      try {
        unchanged = (await fsp.readFile(file, "utf8")) === content;
      } catch {
        unchanged = false;
      }
    }
    // On a rename, write the new file before removing the old one, so a
    // crash in between duplicates the board instead of losing it.
    if (!unchanged) {
      await writeFileAtomic(file, content);
    }
    if (previous && previous !== file) {
      await fsp.rm(previous, { force: true });
    }
    boardFiles.set(board.id, file);
    return sendJson(res, 200, {
      ok: true,
      file: path.basename(file),
      changed: !unchanged,
    });
  } catch (err) {
    return sendJson(res, 500, { error: err.message });
  }
}

async function serveStatic(req, res, pathname) {
  let baseDir = APP_DIR;
  let rel = pathname;

  if (pathname.startsWith("/attachments/")) {
    baseDir = ATTACHMENTS_DIR;
    rel = pathname.slice("/attachments".length);
  }
  if (rel === "/" || rel === "") rel = "/index.html";

  const target = path.join(baseDir, path.normalize(rel));
  if (!target.startsWith(baseDir + path.sep)) {
    res.writeHead(403).end("forbidden");
    return;
  }

  try {
    const data = await fsp.readFile(target);
    res.writeHead(200, {
      "Content-Type": CONTENT_TYPES[path.extname(target).toLowerCase()] ||
        "application/octet-stream",
      "Cache-Control": "no-store",
    });
    res.end(data);
  } catch {
    res.writeHead(404, { "Content-Type": "text/plain" }).end("not found");
  }
}

const server = http.createServer(async (req, res) => {
  const pathname = decodeURIComponent(
    new url.URL(req.url, "http://localhost").pathname
  );
  try {
    if (pathname.startsWith("/api/")) {
      await handleApi(req, res, pathname);
    } else {
      await serveStatic(req, res, pathname);
    }
  } catch (err) {
    if (!res.headersSent) sendJson(res, 500, { error: err.message });
    else res.end();
  }
});

// --- startup -------------------------------------------------------------

async function start() {
  await fsp.mkdir(BOARDS_DIR, { recursive: true });
  await fsp.mkdir(ATTACHMENTS_DIR, { recursive: true });
  await indexBoards();
  watchBoards();
  server.listen(PORT, HOST, () => {
    console.log(`Infinite Paper  ->  http://${HOST}:${PORT}`);
    console.log(`Notes directory ->  ${NOTES_DIR}`);
    console.log(`Boards indexed  ->  ${boardFiles.size}`);
  });
}

start();
