const FENCE = /^---\s*$/;

export function blankFrontmatter(markdown: string): string {
  const lines = markdown.split("\n");
  if (!FENCE.test(lines[0] ?? "")) return markdown;
  const close = lines.findIndex((line, i) => i > 0 && FENCE.test(line));
  if (close < 0) return markdown;
  return lines.map((line, i) => (i <= close ? "" : line)).join("\n");
}
