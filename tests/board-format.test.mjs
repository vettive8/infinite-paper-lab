/**
 * Round-trip tests for the board file codec (lib/board-format.js).
 *
 * The codec is the one piece of code that can corrupt a user's board
 * files, so every note shape and every gnarly body must survive
 * serialize -> parse unchanged.
 *
 *   npm test   (or: node --test tests/)
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { slugify, serializeBoard, parseBoard } from "../lib/board-format.js";

function makeBoard(overrides = {}) {
  return {
    id: "11111111-2222-3333-4444-555555555555",
    title: "Test board",
    pinned: false,
    order: 3,
    createdAt: 1778836932000,
    updatedAt: 1778836999000,
    lastOpenedAt: 1778837000000,
    revision: 7,
    view: { x: 770, y: 1389, scale: 1.49 },
    notes: [],
    ...overrides,
  };
}

function roundTrip(board) {
  return parseBoard(serializeBoard(board));
}

test("frontmatter metadata round-trips", () => {
  const board = makeBoard({ pinned: true });
  const back = roundTrip(board);
  assert.equal(back.id, board.id);
  assert.equal(back.title, board.title);
  assert.equal(back.pinned, true);
  assert.equal(back.order, 3);
  assert.equal(back.createdAt, board.createdAt);
  assert.equal(back.updatedAt, board.updatedAt);
  assert.equal(back.lastOpenedAt, board.lastOpenedAt);
  assert.equal(back.revision, 7);
  assert.deepEqual(back.view, board.view);
});

test("title with quotes, backslashes, and colons round-trips", () => {
  for (const title of [
    'He said "ship it"',
    "C:\\notes\\plan",
    "a: b: c",
    'mix \\" of "everything\\"',
  ]) {
    const back = roundTrip(makeBoard({ title }));
    assert.equal(back.title, title);
  }
});

test("text note body round-trips verbatim, markdown included", () => {
  const text = [
    "# Heading",
    "",
    "Some **bold** text and `code`.",
    "",
    "```js",
    "const x = '<!-- not a marker -->';",
    "```",
    "",
    "---",
    "",
    "A line after a horizontal rule.",
  ].join("\n");
  const board = makeBoard({
    notes: [{ id: "n1", type: "text", x: 420, y: -300, text }],
  });
  assert.deepEqual(roundTrip(board).notes, board.notes);
});

test("a body containing an ip-note opening marker still round-trips", () => {
  const text = "quoting a marker: <!-- ip-note id=zz type=text x=0 y=0 -->";
  const board = makeBoard({
    notes: [{ id: "n1", type: "text", x: 0, y: 0, text }],
  });
  assert.deepEqual(roundTrip(board).notes, board.notes);
});

test("empty and whitespace-only text notes round-trip", () => {
  const board = makeBoard({
    notes: [
      { id: "n1", type: "text", x: 1, y: 2, text: "" },
      { id: "n2", type: "text", x: 3, y: 4, text: "  " },
    ],
  });
  assert.deepEqual(roundTrip(board).notes, board.notes);
});

test("markdown note keeps width/height and its document body", () => {
  const board = makeBoard({
    notes: [
      {
        id: "m1",
        type: "markdown",
        x: 100,
        y: 200,
        width: 520,
        height: 640,
        text: "# Doc\n\n- item one\n- item two",
      },
    ],
  });
  assert.deepEqual(roundTrip(board).notes, board.notes);
});

test("image note round-trips geometry, flips, and crop", () => {
  const board = makeBoard({
    notes: [
      {
        id: "i1",
        type: "image",
        x: 900,
        y: 520,
        width: 500,
        height: 260,
        rotation: 90,
        flipX: true,
        flipY: false,
        crop: { x: 0.1234, y: 0, w: 0.75, h: 1 },
        imageId: "3f9a2b1c",
        mimeType: "image/jpeg",
      },
    ],
  });
  assert.deepEqual(roundTrip(board).notes, board.notes);
});

test("image note body is a preview-friendly markdown link", () => {
  const board = makeBoard({
    notes: [
      {
        id: "i1",
        type: "image",
        x: 0,
        y: 0,
        width: 320,
        height: 180,
        rotation: 0,
        flipX: false,
        flipY: false,
        crop: { x: 0, y: 0, w: 1, h: 1 },
        imageId: "3f9a2b1c",
        mimeType: "image/jpeg",
      },
    ],
  });
  const text = serializeBoard(board);
  assert.match(text, /!\[\]\(\.\.\/attachments\/3f9a2b1c\.jpg\)/);
  // The body is derived — parsing ignores it and keeps imageId canonical.
  assert.deepEqual(parseBoard(text).notes, board.notes);
});

test("multiple notes keep their order", () => {
  const board = makeBoard({
    notes: [
      { id: "a", type: "text", x: 0, y: 0, text: "first" },
      {
        id: "b",
        type: "image",
        x: 10,
        y: 10,
        width: 320,
        height: 180,
        rotation: 0,
        flipX: false,
        flipY: false,
        crop: { x: 0, y: 0, w: 1, h: 1 },
        imageId: "img1",
        mimeType: "image/png",
      },
      { id: "c", type: "text", x: 20, y: 20, text: "third" },
    ],
  });
  assert.deepEqual(
    roundTrip(board).notes.map((n) => n.id),
    ["a", "b", "c"]
  );
});

test("parses a hand-written minimal file with defaults", () => {
  const board = parseBoard(
    [
      "---",
      "id: abc",
      "title: Unquoted title",
      "---",
      "",
      "<!-- ip-note id=n1 type=text x=5 y=6 -->",
      "hello",
      "<!-- /ip-note -->",
      "",
    ].join("\n")
  );
  assert.equal(board.id, "abc");
  assert.equal(board.title, "Unquoted title");
  assert.equal(board.pinned, false);
  assert.deepEqual(board.view, { x: 0, y: 0, scale: 1 });
  assert.deepEqual(board.notes, [
    { id: "n1", type: "text", x: 5, y: 6, text: "hello" },
  ]);
});

test("a file with no frontmatter and no notes parses to an empty board", () => {
  const board = parseBoard("# Just some markdown\n\nNothing else.\n");
  assert.equal(board.id, "");
  assert.deepEqual(board.notes, []);
});

test("slugify", () => {
  assert.equal(slugify("Business Ideas"), "business-ideas");
  assert.equal(slugify("  --Weird  ***  title--  "), "weird-title");
  assert.equal(slugify(""), "board");
  assert.equal(slugify("摘要"), "board");
  assert.equal(slugify("x".repeat(100)).length, 60);
});
