import { AssetPath, type StatusId } from "@kibo/schema";
import { statusDotClass } from "@kibo/sdk";
import MarkdownIt from "markdown-it";

export type TicketRef = { id: string; title: string; statusId: StatusId };

type Token = ReturnType<MarkdownIt["parse"]>[number];
type Piece = { at: number; end: number; html: string };

const KEY = /\b[A-Z][A-Z0-9]{1,5}-\d+\b/g;
const WIKI = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g;
const SCHEME = /^[a-z][a-z0-9+.-]*:/i;
const TASK = /^\[([ xX])\] /;

export type RenderOptions = { tasks?: "interactive" | "readonly" };
type RenderEnv = { readonlyTasks: boolean };

const isRenderEnv = (v: unknown): v is RenderEnv =>
  typeof v === "object" && v !== null && "readonlyTasks" in v && typeof v.readonlyTasks === "boolean";

const md = new MarkdownIt({ html: false, linkify: false, typographer: false });

const escapeHtml = (s: string) => md.utils.escapeHtml(s);

function chip(key: string, t: TicketRef): string {
  return (
    `<button type="button" data-ticket-key="${escapeHtml(key)}" class="mx-0.5 inline-flex max-w-[12rem] items-center gap-1.5 whitespace-nowrap rounded border bg-card px-1.5 py-0.5 align-baseline font-mono text-xs text-foreground hover:bg-accent">` +
    `<span aria-hidden="true" class="inline-block size-2 shrink-0 rounded-full ${statusDotClass(t.statusId)}"></span>${escapeHtml(key)}` +
    `<span class="min-w-0 truncate font-sans text-muted-foreground">${escapeHtml(t.title)}</span></button>`
  );
}

function wikiPieces(text: string): Piece[] {
  return [...text.matchAll(WIKI)].map((m) => {
    const target = m[1]?.trim() ?? "";
    const label = m[2]?.trim() || target;
    return {
      at: m.index,
      end: m.index + m[0].length,
      html: `<a href="#" data-note-href="${escapeHtml(target)}">${escapeHtml(label)}</a>`,
    };
  });
}

function expandText(text: string, tickets: ReadonlyMap<string, TicketRef>): string {
  const pieces = wikiPieces(text);
  for (const m of text.matchAll(KEY)) {
    const t = tickets.get(m[0]);
    if (!t || pieces.some((p) => m.index >= p.at && m.index < p.end)) continue;
    pieces.push({ at: m.index, end: m.index + m[0].length, html: chip(m[0], t) });
  }
  let out = "";
  let last = 0;
  for (const p of pieces.sort((a, b) => a.at - b.at)) {
    out += escapeHtml(text.slice(last, p.at)) + p.html;
    last = p.end;
  }
  return out + escapeHtml(text.slice(last));
}

function markNoteLink(link: Token) {
  const href = link.attrGet("href") ?? "";
  if (SCHEME.test(href) || !href.endsWith(".md")) return;
  link.attrSet("data-note-href", href);
  link.attrSet("href", "#");
}

function expandInline(children: Token[], tickets: ReadonlyMap<string, TicketRef>) {
  let inLink = false;
  for (const child of children) {
    if (child.type === "link_open") {
      inLink = true;
      markNoteLink(child);
    }
    if (child.type === "link_close") inLink = false;
    if (child.type === "text" && !inLink) {
      child.type = "html_inline";
      child.content = expandText(child.content, tickets);
    }
  }
}

const renderImage = md.renderer.rules.image;
md.renderer.rules.image = (tokens, idx, options, env, self) => {
  const token = tokens[idx];
  const src = token?.attrGet("src") ?? "";
  if (!token || !AssetPath.safeParse(src).success) {
    return renderImage
      ? renderImage(tokens, idx, options, env, self)
      : self.renderToken(tokens, idx, options);
  }
  const alt = self.renderInlineAsText(token.children ?? [], options, env);
  return `<img data-asset="${escapeHtml(src)}" alt="${escapeHtml(alt)}">`;
};

function enclosingList(tokens: Token[], itemIndex: number): Token | null {
  const level = tokens[itemIndex]?.level ?? 0;
  for (let i = itemIndex - 1; i >= 0; i -= 1) {
    const t = tokens[i];
    if (t && (t.type === "bullet_list_open" || t.type === "ordered_list_open") && t.level === level - 1) {
      return t;
    }
  }
  return null;
}

function markTasks(tokens: Token[]) {
  for (const [i, item] of tokens.entries()) {
    const paragraph = tokens[i + 1];
    const inline = tokens[i + 2];
    const close = tokens[i + 3];
    const first = inline?.children?.[0];
    if (item.type !== "list_item_open" || paragraph?.type !== "paragraph_open" || inline?.type !== "inline") {
      continue;
    }
    if (!first || first.type !== "text" || close?.type !== "paragraph_close") continue;
    const match = TASK.exec(first.content);
    if (!match) continue;
    first.content = first.content.slice(match[0].length);
    item.attrJoin("class", "task");
    item.attrSet("data-checked", match[1] === " " ? "false" : "true");
    item.attrSet("data-task-line", String(item.map?.[0] ?? 0));
    paragraph.hidden = true;
    close.hidden = true;
    const list = enclosingList(tokens, i);
    if (list && !list.attrGet("class")?.split(" ").includes("contains-task")) {
      list.attrJoin("class", "contains-task");
    }
  }
}

md.renderer.rules.list_item_open = (tokens, idx, options, env, self) => {
  const token = tokens[idx];
  const checked = token?.attrGet("data-checked") ?? null;
  if (!token || checked === null) return self.renderToken(tokens, idx, options);
  const line = token.attrGet("data-task-line") ?? "0";
  token.attrs = token.attrs?.filter(([name]) => name === "class") ?? null;
  const disabled = isRenderEnv(env) && env.readonlyTasks ? " disabled" : "";
  const mark = checked === "true" ? " checked" : "";
  return `${self.renderToken(tokens, idx, options)}<input type="checkbox" data-task-line="${line}"${mark}${disabled}>`;
};

export function renderNote(
  markdown: string,
  tickets: ReadonlyMap<string, TicketRef>,
  options: RenderOptions = {},
): string {
  const env: RenderEnv = { readonlyTasks: options.tasks === "readonly" };
  const tokens = md.parse(markdown, env);
  markTasks(tokens);
  for (const token of tokens) {
    if (token.type === "inline" && token.children) expandInline(token.children, tickets);
  }
  return md.renderer.render(tokens, md.options, env);
}
