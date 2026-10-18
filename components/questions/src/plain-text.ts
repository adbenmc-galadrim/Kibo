const BULLET = /^\s*[-*+]\s+(.*)$/;
const NUMBERED = /^\s*(\d+)[.)]\s+(.*)$/;
const HEADING = /^\s*#{1,6}\s+(.*)$/;
const LINK = /\[([^\]]+)\]\(([^)\s]+)\)/g;
const MARKS = /\*\*|__|`/g;

const inline = (text: string): string => text.replace(LINK, "$1 ($2)").replace(MARKS, "").trim();

function standalone(line: string): string | null {
  const bullet = BULLET.exec(line);
  if (bullet) return `• ${inline(bullet[1] ?? "")}`;
  const numbered = NUMBERED.exec(line);
  if (numbered) return `${numbered[1]}. ${inline(numbered[2] ?? "")}`;
  const heading = HEADING.exec(line);
  return heading ? inline(heading[1] ?? "") : null;
}

export function plainText(markdown: string): string[] {
  const lines: string[] = [];
  let paragraph: string[] = [];
  const flush = () => {
    if (paragraph.length > 0) lines.push(inline(paragraph.join(" ")));
    paragraph = [];
  };
  for (const line of markdown.split(/\r?\n/)) {
    const own = standalone(line);
    if (line.trim() === "") flush();
    else if (own !== null) {
      flush();
      lines.push(own);
    } else paragraph.push(line.trim());
  }
  flush();
  return lines;
}
