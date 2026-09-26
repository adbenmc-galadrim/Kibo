export type RawLink = { kind: "wiki" | "relative"; target: string };

export function splitFrontmatter(markdown: string): { tickets: string[]; body: string } {
  const text = markdown.replace(/\r\n/g, "\n");
  if (!text.startsWith("---\n")) return { tickets: [], body: markdown };
  const end = text.indexOf("\n---", 3);
  if (end < 0) return { tickets: [], body: markdown };
  const yaml = text.slice(4, end).split("\n");
  const afterEnd = text.indexOf("\n", end + 4);
  const body = afterEnd < 0 ? "" : text.slice(afterEnd + 1);
  const tickets: string[] = [];
  const at = yaml.findIndex((l) => /^tickets\s*:/.test(l));
  if (at >= 0) {
    const inline = (yaml[at] ?? "").replace(/^tickets\s*:/, "").trim();
    if (inline) tickets.push(...inline.replace(/^\[|\]$/g, "").split(","));
    for (let i = at + 1; i < yaml.length && /^\s+-\s+/.test(yaml[i] ?? ""); i += 1) {
      tickets.push((yaml[i] ?? "").replace(/^\s+-\s+/, ""));
    }
  }
  return {
    tickets: tickets
      .map((t) => t.trim().replace(/^["']|["']$/g, ""))
      .filter((t) => /^[A-Z]{2,6}-\d+$/.test(t)),
    body,
  };
}

export function stripCode(markdown: string): string {
  const blank = (s: string) => s.replace(/[^\n]/g, " ");
  return markdown.replace(/^(```|~~~)[^\n]*\n[\s\S]*?^\1[^\n]*$/gm, blank).replace(/`[^`\n]*`/g, blank);
}

export function noteTitle(path: string, markdown: string): string {
  const match = /^# +(.+?)\s*#*\s*$/m.exec(stripCode(splitFrontmatter(markdown).body));
  if (match?.[1]) return match[1].trim();
  return (path.split("/").at(-1) ?? path).replace(/\.md$/, "");
}

const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export function ticketKeys(markdown: string, projectKey: string): string[] {
  const { tickets, body } = splitFrontmatter(markdown);
  const re = new RegExp(`(?<![A-Za-z0-9_-])${escapeRegExp(projectKey)}-\\d+(?![A-Za-z0-9_])`, "g");
  const inBody = [...stripCode(body).matchAll(re)].map((m) => m[0]);
  const own = tickets.filter((t) => t.startsWith(`${projectKey}-`));
  return [...new Set([...own, ...inBody])];
}

const WIKI = /\[\[([^\]|#\n]+)(?:#[^\]|\n]*)?(?:\|[^\]\n]*)?\]\]/g;
const MARKDOWN = /\[[^\]\n]*\]\(([^)\s]+?\.md)(?:#[^)\s]*)?\)/g;

export function rawLinks(markdown: string): RawLink[] {
  const text = stripCode(splitFrontmatter(markdown).body);
  const found: { index: number; link: RawLink }[] = [];
  for (const m of text.matchAll(WIKI)) {
    found.push({ index: m.index ?? 0, link: { kind: "wiki", target: (m[1] ?? "").trim() } });
  }
  for (const m of text.matchAll(MARKDOWN)) {
    const target = m[1] ?? "";
    if (/^[a-z][a-z0-9+.-]*:/i.test(target) || target.startsWith("/")) continue;
    found.push({ index: m.index ?? 0, link: { kind: "relative", target } });
  }
  return found.sort((a, b) => a.index - b.index).map((f) => f.link);
}

function normalize(path: string): string | null {
  const out: string[] = [];
  for (const segment of path.split("/")) {
    if (segment === "" || segment === ".") continue;
    if (segment === "..") {
      if (out.length === 0) return null;
      out.pop();
    } else out.push(segment);
  }
  return out.join("/");
}

const dirOf = (path: string) => path.split("/").slice(0, -1).join("/");
const byLength = (a: string, b: string) => a.length - b.length || (a < b ? -1 : a > b ? 1 : 0);

function resolveWiki(target: string, allPaths: string[]): string | null {
  const wanted = target.toLowerCase().replace(/\.md$/, "");
  const matches = allPaths.filter((p) => {
    const lower = p.toLowerCase().replace(/\.md$/, "");
    if (wanted.includes("/")) return lower === wanted || lower.endsWith(`/${wanted}`);
    return (lower.split("/").at(-1) ?? "") === wanted;
  });
  return matches.sort(byLength)[0] ?? null;
}

function decodeTarget(target: string): string | null {
  try {
    return decodeURIComponent(target);
  } catch (e) {
    if (e instanceof URIError) return null;
    throw e;
  }
}

export function resolveLinks(fromPath: string, links: RawLink[], allPaths: string[]): string[] {
  const known = new Set(allPaths);
  const out: string[] = [];
  for (const link of links) {
    if (link.kind === "wiki") {
      const hit = resolveWiki(link.target, allPaths);
      if (hit) out.push(hit);
      continue;
    }
    const target = decodeTarget(link.target);
    if (target === null) continue;
    const resolved = normalize(`${dirOf(fromPath)}/${target}`);
    if (resolved !== null && known.has(resolved)) out.push(resolved);
  }
  return out;
}

export function parseNote(
  path: string,
  markdown: string,
  projectKey: string,
  allPaths: string[],
): { title: string; tickets: string[]; links: string[] } {
  return {
    title: noteTitle(path, markdown),
    tickets: ticketKeys(markdown, projectKey),
    links: resolveLinks(path, rawLinks(markdown), allPaths),
  };
}
