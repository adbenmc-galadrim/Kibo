import MarkdownIt from "markdown-it";

type Token = ReturnType<MarkdownIt["parse"]>[number];
type ListLevel = { ordered: boolean };

const md = new MarkdownIt("default", { html: false, linkify: false, typographer: false });

const WORD = /^\w+$/;
const WORD_END = /\w$/;
const isDunder = (open: Token, inner: Token | undefined): boolean =>
  open.markup === "__" && inner?.type === "text" && WORD.test(inner.content);
const literal = (open: Token, inner: Token | undefined, before: string): boolean =>
  isDunder(open, inner) || WORD_END.test(before);

function inlineText(tokens: readonly Token[]): string {
  let out = "";
  const links: (string | null)[] = [];
  const linkStart: number[] = [];
  const kept: string[] = [];
  tokens.forEach((t, i) => {
    switch (t.type) {
      case "text":
      case "text_special":
      case "code_inline":
      case "html_inline":
        out += t.content;
        return;
      case "softbreak":
      case "hardbreak":
        out += "\n";
        return;
      case "strong_open":
      case "em_open": {
        const keep = literal(t, tokens[i + 1], out) ? t.markup : "";
        kept.push(keep);
        out += keep;
        return;
      }
      case "strong_close":
      case "em_close":
        out += kept.pop() ?? "";
        return;
      case "link_open":
        links.push(t.attrGet("href"));
        linkStart.push(out.length);
        return;
      case "link_close": {
        const href = links.pop() ?? null;
        const text = out.slice(linkStart.pop() ?? out.length);
        if (href !== null && href !== text && `mailto:${text}` !== href) out += ` (${href})`;
        return;
      }
      case "image":
        out += `[image : ${t.content}] (${t.attrGet("src") ?? ""})`;
        return;
      default:
        return;
    }
  });
  return out;
}

class Writer {
  lines: string[] = [];
  private lists: ListLevel[] = [];
  private quotes = 0;
  private marker: string | null = null;
  private row: string[] | null = null;

  private indent(): string {
    return "  ".repeat(Math.max(this.lists.length - 1, 0));
  }

  private prefix(first: boolean): string {
    const quote = "> ".repeat(this.quotes);
    if (this.lists.length === 0) return quote;
    const marker = first ? this.marker : null;
    this.marker = null;
    return `${quote}${this.indent()}${marker ?? "  "}`;
  }

  emit(text: string): void {
    text.split("\n").forEach((line, i) => {
      if (line.trim() !== "") this.lines.push(`${this.prefix(i === 0)}${line.trimEnd()}`);
    });
  }

  code(text: string): void {
    const body = text.replace(/\n$/, "");
    for (const line of body.split("\n")) this.lines.push(`${this.prefix(false)}${line}`.trimEnd());
  }

  token(t: Token): void {
    switch (t.type) {
      case "bullet_list_open":
      case "ordered_list_open":
        this.lists.push({ ordered: t.type === "ordered_list_open" });
        return;
      case "bullet_list_close":
      case "ordered_list_close":
        this.lists.pop();
        return;
      case "list_item_open":
        this.marker = this.lists.at(-1)?.ordered ? `${t.info}. ` : "• ";
        return;
      case "blockquote_open":
        this.quotes += 1;
        return;
      case "blockquote_close":
        this.quotes -= 1;
        return;
      case "fence":
      case "code_block":
        this.code(t.content);
        return;
      case "tr_open":
        this.row = [];
        return;
      case "tr_close":
        if (this.row !== null) this.emit(this.row.join(" · "));
        this.row = null;
        return;
      case "inline":
        if (this.row !== null) this.row.push(inlineText(t.children ?? []).trim());
        else this.emit(inlineText(t.children ?? []));
        return;
      default:
        return;
    }
  }
}

export function plainText(markdown: string): string[] {
  const writer = new Writer();
  const tokens = md.parse(markdown, {});
  for (const t of tokens) writer.token(t);
  return writer.lines;
}
