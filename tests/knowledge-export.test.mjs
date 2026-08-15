import test from "node:test";
import assert from "node:assert/strict";

import { serializeKnowledgeMarkdown } from "../lib/knowledge-export.js";

test("knowledge export removes canvas metadata and follows spatial reading order", () => {
  const markdown = serializeKnowledgeMarkdown(
    {
      title: "Research board",
      notes: [
        { id: "right", type: "markdown", x: 500, y: 0, text: "Second idea" },
        { id: "lower", type: "text", x: 0, y: 300, text: "Third idea" },
        { id: "left", type: "text", x: 0, y: 0, text: "First idea" },
      ],
    },
    new Date("2026-08-15T09:30:00Z")
  );

  assert.match(markdown, /^# Research board/m);
  assert.match(markdown, /2026-08-15 09:30 UTC/);
  assert.ok(markdown.indexOf("First idea") < markdown.indexOf("Second idea"));
  assert.ok(markdown.indexOf("Second idea") < markdown.indexOf("Third idea"));
  assert.doesNotMatch(markdown, /<!-- ip-note|\bx=|\by=/);
});

test("knowledge export labels image attachments instead of pretending to embed them", () => {
  const markdown = serializeKnowledgeMarkdown({
    title: "Images",
    notes: [
      { id: "image-note", type: "image", imageId: "asset-123", mimeType: "image/jpeg" },
    ],
  });

  assert.match(markdown, /Image attachment: `asset-123\.jpg`/);
  assert.match(markdown, /remains in the InfiniteBoards attachments folder/);
});

test("knowledge export keeps empty boards readable", () => {
  assert.match(
    serializeKnowledgeMarkdown({ title: "Empty", notes: [] }),
    /This board has no notes/
  );
});
