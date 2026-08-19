import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

import { serializeBoard } from "../lib/board-format.js";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

function board(revision, text) {
  return {
    id: "duplicate-memory-id",
    title: "Memory",
    pinned: false,
    order: 0,
    createdAt: 1,
    updatedAt: revision,
    lastOpenedAt: 1,
    revision,
    view: { x: 0, y: 0, scale: 1 },
    notes: [{ id: "note", type: "text", x: 0, y: 0, text }],
  };
}

async function waitForServer(url) {
  const deadline = Date.now() + 8000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // Process is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 80));
  }
  throw new Error("test server did not become ready");
}

test("server loads the newest duplicate and saves without creating another suffix", async () => {
  const notesDir = await fs.mkdtemp(path.join(os.tmpdir(), "infiniteboards-index-"));
  const boardsDir = path.join(notesDir, "boards");
  await fs.mkdir(boardsDir, { recursive: true });
  await fs.writeFile(path.join(boardsDir, "memory.md"), serializeBoard(board(10, "old")));
  await fs.writeFile(
    path.join(boardsDir, "memory-8.md"),
    serializeBoard(board(12, "latest recovered memory"))
  );

  const port = 4417;
  const origin = `http://127.0.0.1:${port}`;
  const child = spawn(process.execPath, ["server.js"], {
    cwd: root,
    env: { ...process.env, HOST: "127.0.0.1", PORT: String(port), NOTES_DIR: notesDir },
    stdio: "ignore",
  });

  try {
    await waitForServer(`${origin}/api/boards`);
    const loaded = await fetch(`${origin}/api/boards/duplicate-memory-id`).then((response) =>
      response.json()
    );
    assert.equal(loaded.board.notes[0].text, "latest recovered memory");

    const saved = board(13, "latest memory safely saved");
    saved.baseRevision = 12;
    const response = await fetch(`${origin}/api/boards/duplicate-memory-id`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ board: saved }),
    });
    assert.equal(response.status, 200);

    const filenames = (await fs.readdir(boardsDir)).sort();
    assert.deepEqual(filenames, ["memory.md"]);
    assert.match(
      await fs.readFile(path.join(boardsDir, "memory.md"), "utf8"),
      /latest memory safely saved/
    );
  } finally {
    child.kill();
    await new Promise((resolve) => child.once("exit", resolve));
    await fs.rm(notesDir, { recursive: true, force: true });
  }
});
