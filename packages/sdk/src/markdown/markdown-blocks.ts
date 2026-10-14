import MarkdownIt from "markdown-it";

type Token = ReturnType<MarkdownIt["parse"]>[number];
type Node = { token: Token; children: Node[] };

export type Align = "left" | "center" | "right" | null;
export type MdInline =
  | { kind: "text"; text: string }
  | { kind: "code"; text: string }
  | { kind: "break" }
  | { kind: "strong" | "em" | "s"; children: MdInline[] }
  | { kind: "link"; href: string | null; children: MdInline[] };
export type MdTable = {
  kind: "table";
  source: string;
  align: Align[];
  head: MdInline[][];
  rows: MdInline[][][];
};
export type MdBlock =
  | { kind: "p"; children: MdInline[] }
  | { kind: "heading"; level: number; children: MdInline[] }
  | { kind: "list"; ordered: boolean; start: number; items: MdBlock[][] }
  | { kind: "quote"; children: MdBlock[] }
  | { kind: "code"; text: string; lang: string }
  | { kind: "hr" }
  | MdTable;

const md = new MarkdownIt("default", { html: false, linkify: true, breaks: true, typographer: false });

const SAFE_HREF = /^(https?:|mailto:)/i;
const SPAN: Record<string, "strong" | "em" | "s"> = { strong_open: "strong", em_open: "em", s_open: "s" };
const ALIGN = /text-align:(left|center|right)/;

const safeHref = (href: string | null): string | null =>
  href !== null && SAFE_HREF.test(href) ? href : null;

function leafOf(t: Token): MdInline | null {
  switch (t.type) {
    case "text":
    case "text_special":
    case "html_inline":
    case "image":
      return { kind: "text", text: t.content };
    case "code_inline":
      return { kind: "code", text: t.content };
    case "softbreak":
    case "hardbreak":
      return { kind: "break" };
    default:
      return null;
  }
}

function inlineOf(tokens: readonly Token[]): MdInline[] {
  const root: MdInline[] = [];
  const stack: MdInline[][] = [root];
  for (const t of tokens) {
    const top = stack.at(-1) ?? root;
    const span = SPAN[t.type];
    if (span) {
      const node: MdInline = { kind: span, children: [] };
      top.push(node);
      stack.push(node.children);
    } else if (t.type === "link_open") {
      const node: MdInline = { kind: "link", href: safeHref(t.attrGet("href")), children: [] };
      top.push(node);
      stack.push(node.children);
    } else if (t.nesting === -1) {
      if (stack.length > 1) stack.pop();
    } else {
      const leaf = leafOf(t);
      if (leaf) top.push(leaf);
    }
  }
  return root;
}

function treeOf(tokens: readonly Token[]): Node[] {
  const root: Node[] = [];
  const stack: Node[][] = [root];
  for (const token of tokens) {
    const top = stack.at(-1) ?? root;
    if (token.nesting === -1) {
      if (stack.length > 1) stack.pop();
      continue;
    }
    const node: Node = { token, children: [] };
    top.push(node);
    if (token.nesting === 1) stack.push(node.children);
  }
  return root;
}

const inlineIn = (node: Node | undefined): MdInline[] =>
  inlineOf(node?.children.find((c) => c.token.type === "inline")?.token.children ?? []);

const childOf = (node: Node, type: string): Node | undefined =>
  node.children.find((c) => c.token.type === type);

function alignOf(cell: Node): Align {
  const match = ALIGN.exec(cell.token.attrGet("style") ?? "");
  return match?.[1] === "left" || match?.[1] === "center" || match?.[1] === "right" ? match[1] : null;
}

function tableOf(node: Node, lines: readonly string[]): MdTable {
  const headRow = childOf(node, "thead_open")?.children[0];
  const bodyRows = childOf(node, "tbody_open")?.children ?? [];
  const [from = 0, to = 0] = node.token.map ?? [];
  return {
    kind: "table",
    source: lines
      .slice(from, to)
      .map((l) => l.trim())
      .join("\n"),
    align: headRow?.children.map(alignOf) ?? [],
    head: headRow?.children.map(inlineIn) ?? [],
    rows: bodyRows.map((row) => row.children.map(inlineIn)),
  };
}

function blockOf(node: Node, lines: readonly string[]): MdBlock[] {
  const t = node.token;
  const inner = () => node.children.flatMap((c) => blockOf(c, lines));
  switch (t.type) {
    case "paragraph_open":
      return [{ kind: "p", children: inlineIn(node) }];
    case "heading_open":
      return [{ kind: "heading", level: Number(t.tag.slice(1)), children: inlineIn(node) }];
    case "bullet_list_open":
    case "ordered_list_open":
      return [
        {
          kind: "list",
          ordered: t.type === "ordered_list_open",
          start: Number(t.attrGet("start") ?? 1),
          items: node.children.map((item) => item.children.flatMap((c) => blockOf(c, lines))),
        },
      ];
    case "blockquote_open":
      return [{ kind: "quote", children: inner() }];
    case "fence":
    case "code_block":
      return [{ kind: "code", text: t.content, lang: t.info.trim() }];
    case "hr":
      return [{ kind: "hr" }];
    case "table_open":
      return [tableOf(node, lines)];
    default:
      return [];
  }
}

export function parseAgentMarkdown(text: string): MdBlock[] {
  const lines = text.split(/\r\n|\r|\n/);
  return treeOf(md.parse(text, {})).flatMap((node) => blockOf(node, lines));
}
