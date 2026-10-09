import { PLAN_ID } from "./plan-check";
import type { PlanPr } from "./plan-source";

export type TodoLevel = "p0" | "p1" | "p2" | "p3" | "unsorted";
export type TodoItem = { code: string; level: TodoLevel; pending: boolean; text: string };
export type PassationSection = { number: string; slug: string; title: string; body: string };
export type Frontmatter = { source: string; imported: string; tickets: readonly string[] };

const endWithNewline = (text: string) => `${text.trimEnd()}\n`;

export const stripInlineMarkup = (text: string): string =>
  text
    .replace(/\*\*|__/g, "")
    .replace(/`/g, "")
    .replace(/\s+/g, " ")
    .trim();

export function firstSentence(text: string): string {
  const match = /^(.+?[.!?])(\s|$)/s.exec(text.trim());
  return (match?.[1] ?? text).trim();
}

export const truncate = (text: string, max: number): string =>
  text.length <= max ? text : `${text.slice(0, max - 1).trimEnd()}…`;

export const slugify = (text: string): string =>
  text
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

type DescribedPr = Pick<
  PlanPr,
  "phase" | "sprint" | "areas" | "why" | "perimetre" | "tests" | "pieges" | "note"
>;

const listSection = (title: string, items: readonly string[]) =>
  items.length === 0 ? [] : [`## ${title}`, items.map((i) => `- ${i}`).join("\n")];

export function renderDescription(pr: DescribedPr): string {
  const header = [`Phase ${pr.phase}`, `Sprint ${pr.sprint}`];
  if (pr.areas.length > 0) header.push(`Zones ${pr.areas.join(", ")}`);
  const note = pr.note?.trim() ?? "";
  const blocks = [
    header.join(" · "),
    "## Pourquoi",
    pr.why,
    ...listSection("Périmètre", pr.perimetre),
    ...listSection("Tests", pr.tests),
    ...listSection("Pièges", pr.pieges),
    ...(note ? ["## Note", note] : []),
  ];
  return endWithNewline(blocks.join("\n\n"));
}

const PRIORITIES: Record<string, TodoLevel> = { P0: "p0", P1: "p1", P2: "p2", P3: "p3" };

function todoLevel(heading: string): TodoLevel | null {
  const priority = PRIORITIES[/^P\d\b/.exec(heading)?.[0] ?? ""];
  if (priority) return priority;
  return /^À trier/i.test(heading) ? "unsorted" : null;
}

export function parseTodo(markdown: string): TodoItem[] {
  const items: TodoItem[] = [];
  let level: TodoLevel | null = null;
  let current: TodoItem | null = null;
  for (const line of markdown.split("\n")) {
    const heading = /^# (.+)$/.exec(line);
    if (heading) {
      level = todoLevel(heading[1] ?? "");
      current = null;
      continue;
    }
    const item = /^- \*\*([A-Z]+-\d+)\*\*\s*(🟡)?\s*(.*)$/u.exec(line);
    if (item && level !== null) {
      current = { code: item[1] ?? "", level, pending: item[2] !== undefined, text: (item[3] ?? "").trim() };
      items.push(current);
    } else if (current && /^\s+\S/.test(line)) current.text = `${current.text}\n${line.trim()}`;
    else current = null;
  }
  return items;
}

export function splitPassation(markdown: string): { intro: string; sections: PassationSection[] } {
  const lines = markdown.split("\n");
  const starts = lines.flatMap((l, i) => (/^## \d{2}\. /.test(l) ? [i] : []));
  const intro = endWithNewline(lines.slice(0, starts[0] ?? lines.length).join("\n"));
  const sections = starts.map((start, n) => {
    const heading = /^## (\d{2})\. (.+)$/.exec(lines[start] ?? "");
    const title = (heading?.[2] ?? "").trim();
    const body = lines.slice(start, starts[n + 1] ?? lines.length).join("\n");
    return { number: heading?.[1] ?? "", slug: slugify(title), title, body: endWithNewline(body) };
  });
  return { intro, sections };
}

export const citedPlanIds = (text: string): string[] => [...new Set(text.match(PLAN_ID) ?? [])].sort();

export function cutClaudeMd(markdown: string): string {
  const lines = markdown.split("\n");
  const start = lines.findIndex((l) => /^## 4\./.test(l));
  if (start < 0) return endWithNewline(markdown);
  const next = lines.findIndex((l, i) => i > start && /^## /.test(l));
  const kept = [...lines.slice(0, start), ...(next < 0 ? [] : lines.slice(next))];
  return endWithNewline(kept.join("\n"));
}

export function withFrontmatter(meta: Frontmatter, body: string): string {
  const lines = ["---", `source: ${meta.source}`, `imported: ${meta.imported}`];
  if (meta.tickets.length > 0) lines.push(`tickets: [${meta.tickets.join(", ")}]`);
  return `${lines.join("\n")}\n---\n\n${endWithNewline(body)}`;
}
