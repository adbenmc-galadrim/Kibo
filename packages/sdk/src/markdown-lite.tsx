import { createElement, type ReactNode } from "react";

export type MarkdownLiteOptions = { onTicket?: (key: string) => void };

type Block = { kind: "p"; text: string; strong: boolean } | { kind: "ul" | "ol"; items: string[] };

const BULLET = /^\s*[-*+]\s+(.*)$/;
const NUMBERED = /^\s*\d+[.)]\s+(.*)$/;
const HEADING = /^\s*#{1,6}\s+(.*)$/;
const TICKET_KEY = /\b[A-Z]{2,6}-\d+\b/g;
const CODE_CLASS = "rounded bg-muted px-1 font-mono text-[0.9em]";
const KEY_CLASS =
  "font-mono text-[0.95em] underline decoration-dotted underline-offset-2 hover:text-foreground";

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

function linkify(text: string, key: string, opts: MarkdownLiteOptions): ReactNode[] {
  const onTicket = opts.onTicket;
  if (!onTicket) return [text];
  const nodes: ReactNode[] = [];
  let last = 0;
  for (const match of text.matchAll(TICKET_KEY)) {
    const at = match.index;
    if (at > last) nodes.push(text.slice(last, at));
    const ticket = match[0];
    nodes.push(
      createElement(
        "button",
        { key: `${key}-${at}`, type: "button", className: KEY_CLASS, onClick: () => onTicket(ticket) },
        ticket,
      ),
    );
    last = at + ticket.length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

function emphasis(text: string, key: string, opts: MarkdownLiteOptions): ReactNode[] {
  const parts = text.split("**");
  if (parts.length % 2 === 0) return linkify(text, key, opts);
  return parts.flatMap((part, i) =>
    i % 2 === 1 && part !== ""
      ? [createElement("strong", { key: `${key}-${i}` }, ...linkify(part, `${key}-${i}`, opts))]
      : linkify(part, `${key}-${i}`, opts),
  );
}

function inline(text: string, opts: MarkdownLiteOptions): ReactNode[] {
  const parts = text.split("`");
  if (parts.length % 2 === 0) return emphasis(text, "t", opts);
  return parts.flatMap((part, i) =>
    i % 2 === 1
      ? [createElement("code", { key: i, className: CODE_CLASS }, part)]
      : emphasis(part, String(i), opts),
  );
}

function block(b: Block, key: number, opts: MarkdownLiteOptions): ReactNode {
  if (b.kind === "p") {
    return createElement(
      "p",
      { key, className: b.strong ? "font-medium" : undefined },
      ...inline(b.text, opts),
    );
  }
  const className = b.kind === "ul" ? "list-disc pl-5" : "list-decimal pl-5";
  return createElement(
    b.kind,
    { key, className },
    b.items.map((item, i) => createElement("li", { key: i }, ...inline(item, opts))),
  );
}

export function renderMarkdownLite(markdown: string, opts: MarkdownLiteOptions = {}): ReactNode {
  const blocks = parse(markdown);
  return blocks.length === 0 ? null : blocks.map((b, i) => block(b, i, opts));
}
