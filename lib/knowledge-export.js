/**
 * Produce a clean, single-file reading export of an InfiniteBoards board.
 * Canvas geometry and app metadata deliberately stay in the canonical board
 * source; this document is for people, repositories, and AI tools.
 */

function imageExtension(mimeType) {
  switch (String(mimeType || "").toLowerCase()) {
    case "image/jpeg":
    case "image/jpg":
      return "jpg";
    case "image/webp":
      return "webp";
    case "image/gif":
      return "gif";
    case "image/svg+xml":
      return "svg";
    default:
      return "png";
  }
}

function notesInReadingOrder(notes) {
  return (Array.isArray(notes) ? notes : [])
    .map((note, index) => ({ note, index }))
    .sort(
      (a, b) =>
        (Number(a.note.y) || 0) - (Number(b.note.y) || 0) ||
        (Number(a.note.x) || 0) - (Number(b.note.x) || 0) ||
        a.index - b.index
    )
    .map(({ note }) => note);
}

export function serializeKnowledgeMarkdown(board, exportedAt = new Date()) {
  const title = String(board?.title || "Untitled board").trim() || "Untitled board";
  const lines = [
    `# ${title}`,
    "",
    `> Clean knowledge export from InfiniteBoards · ${exportedAt
      .toISOString()
      .slice(0, 16)
      .replace("T", " ")} UTC`,
    "",
  ];

  let section = 0;
  for (const note of notesInReadingOrder(board?.notes)) {
    section += 1;
    if (note?.type === "image") {
      const filename = `${note.imageId || note.id || `image-${section}`}.${imageExtension(
        note.mimeType
      )}`;
      lines.push(
        `## Image ${section}`,
        "",
        `Image attachment: \`${filename}\` (the file remains in the InfiniteBoards attachments folder).`,
        ""
      );
      continue;
    }

    const text = String(note?.text || "").trim();
    lines.push(`## Note ${section}`, "", text || "_Empty note._", "");
  }

  if (!section) {
    lines.push("_This board has no notes._", "");
  }
  return `${lines.join("\n").trimEnd()}\n`;
}
