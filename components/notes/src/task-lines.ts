const TASK_LINE = /^(\s*(?:[-*+]|\d+[.)]) \[)([ xX])(\] )/;

export function toggleTaskLine(markdown: string, line: number): string | null {
  const lines = markdown.split("\n");
  const current = lines[line];
  if (current === undefined) return null;
  const match = TASK_LINE.exec(current);
  if (!match) return null;
  const [, head = "", mark = " ", tail = ""] = match;
  lines[line] = `${head}${mark === " " ? "x" : " "}${tail}${current.slice(match[0].length)}`;
  return lines.join("\n");
}
