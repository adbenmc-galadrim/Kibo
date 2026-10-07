export const EXCERPT_LINES = 4;
const SKIPPED = /^(#|---|\*\*\*|!\[)/;

export function excerpt(markdown: string, lines = EXCERPT_LINES): string {
  const kept: string[] = [];
  let inFence = false;
  for (const raw of markdown.split("\n")) {
    const line = raw.trim();
    if (line.startsWith("```")) {
      inFence = !inFence;
      continue;
    }
    if (inFence || line === "" || SKIPPED.test(line)) continue;
    kept.push(line);
    if (kept.length === lines) break;
  }
  return kept.join("\n\n");
}
