import { createElement, type ReactNode } from "react";

type Block = { kind: "p"; text: string; strong: boolean } | { kind: "ul" | "ol"; items: string[] };

const BULLET = /^\s*[-*+]\s+(.*)$/;
const NUMBERED = /^\s*\d+[.)]\s+(.*)$/;
const HEADING = /^\s*#{1,6}\s+(.*)$/;

function listItem(line: string): { kind: "ul" | "ol"; text: string } | null {
  const bullet = BULLET.exec(line);
  if (bullet) return { kind: "ul", text: bullet[1] ?? "" };
  const numbered = NUMBERED.exec(line);
  return numbered ? { kind: "ol", text: numbered[1] ?? "" } : null;
}

function parse(markdown: string): Block[] {
  const blocks: Block[] = [];
  let paragraph: string[] = [];
  const flush = () => {
    if (paragraph.length > 0) blocks.push({ kind: "p", text: paragraph.join(" "), strong: false });
    paragraph = [];
  };
  for (const line of markdown.split(/\r?\n/)) {
    const item = listItem(line);
    const heading = HEADING.exec(line);
    const last = blocks.at(-1);
    if (line.trim() === "") flush();
    else if (item) {
      flush();
      if (last && last.kind === item.kind) last.items.push(item.text);
      else blocks.push({ kind: item.kind, items: [item.text] });
    } else if (heading) {
      flush();
      blocks.push({ kind: "p", text: heading[1] ?? "", strong: true });
    } else paragraph.push(line.trim());
  }
  flush();
  return blocks;
}

const CODE_CLASS = "rounded bg-muted px-1 font-mono text-[0.9em]";

function emphasis(text: string, key: string): ReactNode[] {
  const parts = text.split("**");
  if (parts.length % 2 === 0) return [text];
  return parts.map((part, i) =>
    i % 2 === 1 && part !== "" ? createElement("strong", { key: `${key}-${i}` }, part) : part,
  );
}

function inline(text: string): ReactNode[] {
  const parts = text.split("`");
  if (parts.length % 2 === 0) return emphasis(text, "t");
  return parts.flatMap((part, i) =>
    i % 2 === 1
      ? [createElement("code", { key: i, className: CODE_CLASS }, part)]
      : emphasis(part, String(i)),
  );
}

function block(b: Block, key: number): ReactNode {
  if (b.kind === "p") {
    return createElement("p", { key, className: b.strong ? "font-medium" : undefined }, ...inline(b.text));
  }
  const className = b.kind === "ul" ? "list-disc pl-5" : "list-decimal pl-5";
  return createElement(
    b.kind,
    { key, className },
    b.items.map((item, i) => createElement("li", { key: i }, ...inline(item))),
  );
}

export function renderContext(markdown: string): ReactNode {
  const blocks = parse(markdown);
  return blocks.length === 0 ? null : blocks.map(block);
}
