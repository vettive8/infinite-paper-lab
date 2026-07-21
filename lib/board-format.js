/**
 * Infinite Paper board file codec.
 *
 * A board is one .md file: YAML frontmatter (board metadata + view), a
 * cosmetic `# title` heading, then one `<!-- ip-note ... -->` block per
 * note. See FORMAT.md for the format spec. This module is pure — no fs,
 * no globals — so the server and the tests share one implementation.
 */

export function slugify(title) {
  const slug = String(title || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return slug || "board";
}

function yamlString(value) {
  return `"${String(value).replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

function parseYamlString(value) {
  const text = String(value).trim();
  if (text.startsWith('"') && text.endsWith('"')) {
    return text.slice(1, -1).replace(/\\"/g, '"').replace(/\\\\/g, "\\");
  }
  return text;
}

export function serializeBoard(board) {
  const view = board.view || {};
  const lines = [
    "---",
    `id: ${board.id}`,
    `title: ${yamlString(board.title || "Untitled board")}`,
    `pinned: ${board.pinned ? "true" : "false"}`,
    `order: ${Number(board.order) || 0}`,
    `createdAt: ${Number(board.createdAt) || Date.now()}`,
    `updatedAt: ${Number(board.updatedAt) || Date.now()}`,
    `lastOpenedAt: ${Number(board.lastOpenedAt) || Date.now()}`,
    `revision: ${Number(board.revision) || 0}`,
    "view:",
    `  x: ${Number(view.x) || 0}`,
    `  y: ${Number(view.y) || 0}`,
    `  scale: ${Number(view.scale) || 1}`,
    "---",
    "",
    `# ${board.title || "Untitled board"}`,
    "",
  ];

  for (const note of board.notes || []) {
    if (note.type === "image") {
      const crop = note.crop || {};
      const cropStr = [crop.x, crop.y, crop.w, crop.h]
        .map((value, index) => {
          const n = Number(value);
          const fallback = index < 2 ? 0 : 1;
          return Math.round((Number.isFinite(n) ? n : fallback) * 1e4) / 1e4;
        })
        .join(",");
      const attrs = [
        `id=${note.id}`,
        "type=image",
        `x=${Math.round(note.x)}`,
        `y=${Math.round(note.y)}`,
        `width=${Math.round(note.width) || 320}`,
        `height=${Math.round(note.height) || 180}`,
        `rotation=${Number(note.rotation) || 0}`,
        `flipX=${note.flipX ? "true" : "false"}`,
        `flipY=${note.flipY ? "true" : "false"}`,
        `crop=${cropStr}`,
        `imageId=${note.imageId || ""}`,
        `mimeType=${note.mimeType || "image/png"}`,
      ].join(" ");
      lines.push(`<!-- ip-note ${attrs} -->`);
      lines.push("");
      lines.push("<!-- /ip-note -->", "");
    } else {
      const attrParts = [
        `id=${note.id}`,
        `type=${note.type === "markdown" ? "markdown" : "text"}`,
        `x=${Math.round(note.x)}`,
        `y=${Math.round(note.y)}`,
      ];
      if (note.type === "markdown") {
        attrParts.push(`width=${Math.round(note.width) || 380}`);
        attrParts.push(`height=${Math.round(note.height) || 420}`);
      }
      lines.push(`<!-- ip-note ${attrParts.join(" ")} -->`);
      lines.push(String(note.text || ""));
      lines.push("<!-- /ip-note -->", "");
    }
  }

  return lines.join("\n");
}

export function parseBoard(text) {
  const fmMatch = text.match(/^---\n([\s\S]*?)\n---\n/);
  const board = {
    id: "",
    title: "Untitled board",
    pinned: false,
    order: 0,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    lastOpenedAt: Date.now(),
    revision: 0,
    view: { x: 0, y: 0, scale: 1 },
    notes: [],
  };

  if (fmMatch) {
    let inView = false;
    for (const raw of fmMatch[1].split("\n")) {
      if (/^\s/.test(raw) && inView) {
        const [k, v] = raw.trim().split(/:\s*/);
        if (k === "x") board.view.x = Number(v) || 0;
        if (k === "y") board.view.y = Number(v) || 0;
        if (k === "scale") board.view.scale = Number(v) || 1;
        continue;
      }
      inView = false;
      const idx = raw.indexOf(":");
      if (idx < 0) continue;
      const key = raw.slice(0, idx).trim();
      const value = raw.slice(idx + 1).trim();
      if (key === "view") {
        inView = true;
      } else if (key === "id") {
        board.id = value;
      } else if (key === "title") {
        board.title = parseYamlString(value);
      } else if (key === "pinned") {
        board.pinned = value === "true";
      } else if (
        ["order", "createdAt", "updatedAt", "lastOpenedAt", "revision"].includes(key)
      ) {
        board[key] = Number(value) || 0;
      }
    }
  }

  const noteRe = /<!-- ip-note (.*) -->\n([\s\S]*?)\n<!-- \/ip-note -->/g;
  let m;
  while ((m = noteRe.exec(text))) {
    const attrs = {};
    for (const pair of m[1].trim().split(/\s+/)) {
      const eq = pair.indexOf("=");
      if (eq > 0) attrs[pair.slice(0, eq)] = pair.slice(eq + 1);
    }
    const body = m[2];
    if (attrs.type === "image") {
      const cropParts = String(attrs.crop || "0,0,1,1")
        .split(",")
        .map(Number);
      board.notes.push({
        id: attrs.id,
        type: "image",
        x: Number(attrs.x) || 0,
        y: Number(attrs.y) || 0,
        width: Number(attrs.width) || 320,
        height: Number(attrs.height) || 180,
        rotation: Number(attrs.rotation) || 0,
        flipX: attrs.flipX === "true",
        flipY: attrs.flipY === "true",
        crop: {
          x: Number.isFinite(cropParts[0]) ? cropParts[0] : 0,
          y: Number.isFinite(cropParts[1]) ? cropParts[1] : 0,
          w: Number.isFinite(cropParts[2]) ? cropParts[2] : 1,
          h: Number.isFinite(cropParts[3]) ? cropParts[3] : 1,
        },
        imageId: attrs.imageId || "",
        mimeType: attrs.mimeType || "image/png",
      });
    } else {
      const isMarkdown = attrs.type === "markdown";
      const note = {
        id: attrs.id,
        type: isMarkdown ? "markdown" : "text",
        x: Number(attrs.x) || 0,
        y: Number(attrs.y) || 0,
        text: body,
      };
      if (isMarkdown) {
        note.width = Number(attrs.width) || 380;
        note.height = Number(attrs.height) || 420;
      }
      board.notes.push(note);
    }
  }

  return board;
}
