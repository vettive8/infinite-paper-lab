import test from "node:test";
import assert from "node:assert/strict";

import { preferBoardIndexCandidate } from "../lib/board-index.js";

function candidate(file, revision, title = "Memory") {
  return { file, board: { id: "same-id", title, revision } };
}

test("duplicate board indexing prefers the newest revision", () => {
  const canonical = candidate("memory.md", 10);
  const newerSnapshot = candidate("memory-8.md", 12);
  assert.equal(
    preferBoardIndexCandidate(canonical, newerSnapshot),
    newerSnapshot
  );
});

test("equal revisions prefer the canonical board filename", () => {
  const snapshot = candidate("memory-8.md", 12);
  const canonical = candidate("memory.md", 12);
  assert.equal(preferBoardIndexCandidate(snapshot, canonical), canonical);
});

test("equal noncanonical candidates resolve independently of directory order", () => {
  const laterName = candidate("memory-9.md", 12);
  const earlierName = candidate("memory-2.md", 12);
  assert.equal(preferBoardIndexCandidate(laterName, earlierName), earlierName);
  assert.equal(preferBoardIndexCandidate(earlierName, laterName), earlierName);
});
