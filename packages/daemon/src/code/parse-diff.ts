import type { DiffLine, FileDiff, Hunk } from "@kibo/schema";

const HUNK = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@ ?(.*)$/s;
const NO_HUNK_STAGING = [
  "new file mode",
  "deleted file mode",
  "rename from",
  "similarity index",
  "copy from",
];

function readHunkHeader(line: string): Hunk | null {
  const m = HUNK.exec(line);
  if (!m) return null;
  return {
    header: line,
    oldStart: Number(m[1]),
    oldLines: m[2] === undefined ? 1 : Number(m[2]),
    newStart: Number(m[3]),
    newLines: m[4] === undefined ? 1 : Number(m[4]),
    section: m[5] ?? "",
    lines: [],
  };
}

function readFileHeader(diff: FileDiff, line: string): void {
  if (line.startsWith("Binary files ") || line === "GIT binary patch") diff.binary = true;
  if (NO_HUNK_STAGING.some((prefix) => line.startsWith(prefix))) diff.hunkStaging = false;
}

export function parseDiff(raw: string, path: string, origPath: string | null): FileDiff {
  const diff: FileDiff = {
    path,
    origPath,
    binary: false,
    hunkStaging: true,
    additions: 0,
    deletions: 0,
    hunks: [],
  };
  let hunk: Hunk | null = null;
  let oldNo = 0;
  let newNo = 0;
  for (const line of raw.split("\n")) {
    const next = line.startsWith("@@ ") ? readHunkHeader(line) : null;
    if (next) {
      hunk = next;
      diff.hunks.push(hunk);
      oldNo = hunk.oldStart;
      newNo = hunk.newStart;
    } else if (!hunk) readFileHeader(diff, line);
    else {
      const sign = line[0];
      const text = line.slice(1);
      let added: DiffLine | null = null;
      if (sign === "+") {
        added = { kind: "add", text, oldNo: null, newNo: newNo++, noEol: false };
        diff.additions += 1;
      } else if (sign === "-") {
        added = { kind: "del", text, oldNo: oldNo++, newNo: null, noEol: false };
        diff.deletions += 1;
      } else if (sign === " ")
        added = { kind: "context", text, oldNo: oldNo++, newNo: newNo++, noEol: false };
      else if (sign === "\\") {
        const last = hunk.lines.at(-1);
        if (last) last.noEol = true;
      }
      if (added) hunk.lines.push(added);
    }
  }
  if (diff.binary) diff.hunkStaging = false;
  return diff;
}
