import { awaitsDelivery, isArchived, isOpen, type Question } from "@kibo/schema";

export const PREVIEW_ROWS_MAX = 5;
export const PREVIEW_EXCERPT_MAX = 200;

export const previewFr = {
  open: "ouverte",
  answered: "répondue",
  answeredToDeliver: "répondue · à transmettre",
  delivered: (label: string) => `transmise à ${label}`,
  archived: "archivée",
  more: (n: number) => `${n} ${n > 1 ? "autres" : "autre"}…`,
  blocking: "bloquante",
  for: (name: string) => `Pour : ${name}`,
  by: (who: string, age: string) => `posée par ${who} · ${age}`,
  options: (list: string) => `Options : ${list}`,
  provisional: (value: string) => `provisoire : ${value}`,
  ticket: (key: string, title: string) => `${key} · ${title}`,
  heading: (n: number) => `${n} ${n > 1 ? "questions ouvertes" : "question ouverte"}`,
  removedRecipient: "(supprimé)",
  age: {
    now: "à l'instant",
    minutes: (n: number) => `il y a ${n} min`,
    hours: (n: number) => `il y a ${n} h`,
    days: (n: number) => `il y a ${n} j`,
  },
};

const MARKS: readonly [RegExp, string][] = [
  [/\[([^\]]*)\]\([^)]*\)/g, "$1"],
  [/^\s{0,3}(#{1,6}|>|[-*+]|\d+[.)])\s+/gm, ""],
  [/(\*\*|__|`+|~~)/g, ""],
  [/\s+/g, " "],
];

export function previewExcerpt(markdown: string, max: number): string {
  const plain = MARKS.reduce((text, [mark, by]) => text.replace(mark, by), markdown).trim();
  if (plain.length <= max) return plain;
  const cut = plain.slice(0, max - 1);
  const space = cut.lastIndexOf(" ");
  return `${(space > 0 ? cut.slice(0, space) : cut).trimEnd()}…`;
}

export function previewState(q: Question, runLabel: (runId: string) => string): string {
  if (isArchived(q)) return previewFr.archived;
  if (isOpen(q)) return previewFr.open;
  const run = q.answer?.deliveredRunId ?? null;
  if (run !== null) return previewFr.delivered(runLabel(run));
  return awaitsDelivery(q) ? previewFr.answeredToDeliver : previewFr.answered;
}

export function ticketPreviewRows(
  questions: readonly Question[],
  ticketId: string,
): { rows: Question[]; more: number } {
  const open = questions
    .filter((q) => q.ticketId === ticketId && isOpen(q))
    .sort((a, b) => a.createdAt - b.createdAt);
  return { rows: open.slice(0, PREVIEW_ROWS_MAX), more: Math.max(0, open.length - PREVIEW_ROWS_MAX) };
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export function previewAge(at: number, now: number): string {
  const elapsed = Math.max(0, now - at);
  if (elapsed < MINUTE) return previewFr.age.now;
  if (elapsed < HOUR) return previewFr.age.minutes(Math.floor(elapsed / MINUTE));
  if (elapsed < DAY) return previewFr.age.hours(Math.floor(elapsed / HOUR));
  return previewFr.age.days(Math.floor(elapsed / DAY));
}

export const firstOpenQuestion = (questions: readonly Question[], ticketId: string): string | null =>
  ticketPreviewRows(questions, ticketId).rows[0]?.id ?? null;
