import { type DiffLine, type FileDiff, KiboError } from "@kibo/schema";

const SIGN: Record<DiffLine["kind"], string> = { add: "+", del: "-", context: " " };
const ESCAPES: Record<string, string> = { '"': '\\"', "\\": "\\\\", "\t": "\\t", "\n": "\\n", "\r": "\\r" };

function isSpecial(char: string): boolean {
  const code = char.charCodeAt(0);
  return code < 0x20 || code === 0x7f || char === '"' || char === "\\";
}

function escapeChar(char: string): string {
  if (!isSpecial(char)) return char;
  return ESCAPES[char] ?? `\\${char.charCodeAt(0).toString(8).padStart(3, "0")}`;
}

function gitPath(prefix: string, path: string): string {
  const full = `${prefix}${path}`;
  const needsQuotes = [...path].some(isSpecial) || path.trim() !== path;
  if (!needsQuotes) return full;
  return `"${[...full].map(escapeChar).join("")}"`;
}

export function hunkPatch(diff: FileDiff, index: number): string {
  const hunk = diff.hunks[index];
  if (!hunk) throw new KiboError("GIT_STALE", `hunk ${index} of ${diff.path} no longer exists`);
  const before = gitPath("a/", diff.origPath ?? diff.path);
  const after = gitPath("b/", diff.path);
  const body = hunk.lines.flatMap((l) => {
    const line = `${SIGN[l.kind]}${l.text}`;
    return l.noEol ? [line, "\\ No newline at end of file"] : [line];
  });
  return [`diff --git ${before} ${after}`, `--- ${before}`, `+++ ${after}`, hunk.header, ...body, ""].join(
    "\n",
  );
}
