import path from "node:path";

import { slugify } from "./board-format.js";

function isCanonicalFilename(candidate) {
  return (
    path.basename(candidate.file) === `${slugify(candidate.board?.title || "")}.md`
  );
}

/**
 * Pick the safest file when multiple Markdown files claim the same board id.
 * Newer board revisions win so a later typing snapshot is never hidden by an
 * older canonical filename. Equal revisions prefer the canonical slug, then a
 * stable lexical filename so indexing never depends on readdir order.
 */
export function preferBoardIndexCandidate(current, candidate) {
  if (!current) return candidate;

  const currentRevision = Number(current.board?.revision) || 0;
  const candidateRevision = Number(candidate.board?.revision) || 0;
  if (candidateRevision !== currentRevision) {
    return candidateRevision > currentRevision ? candidate : current;
  }

  const currentCanonical = isCanonicalFilename(current);
  const candidateCanonical = isCanonicalFilename(candidate);
  if (candidateCanonical !== currentCanonical) {
    return candidateCanonical ? candidate : current;
  }

  return path.basename(candidate.file).localeCompare(path.basename(current.file)) < 0
    ? candidate
    : current;
}
