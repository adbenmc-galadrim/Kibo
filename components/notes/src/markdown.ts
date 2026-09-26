import type { StatusId } from "@kibo/schema";
import { statusDotClass } from "@kibo/sdk";
import MarkdownIt from "markdown-it";

export type TicketRef = { id: string; title: string; statusId: StatusId };

type Token = ReturnType<MarkdownIt["parse"]>[number];
type Piece = { at: number; end: number; html: string };

const KEY = /\b[A-Z][A-Z0-9]{1,5}-\d+\b/g;
const WIKI = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g;
const SCHEME = /^[a-z][a-z0-9+.-]*:/i;

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

export function renderNote(markdown: string, tickets: ReadonlyMap<string, TicketRef>): string {
  const env = {};
  const tokens = md.parse(markdown, env);
  for (const token of tokens) {
    if (token.type === "inline" && token.children) expandInline(token.children, tickets);
  }
  return md.renderer.render(tokens, md.options, env);
}
