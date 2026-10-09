import {
  ActionOutcome,
  type Batch,
  type BatchStatus,
  type ProjectSnapshot,
  type RunState,
  type RunView,
} from "@kibo/schema";
import type { ProjectFingerprint, QuestionPrint, TicketPrint } from "./fingerprint";

export type ChangeCategory = "runs" | "tickets" | "questions" | "notes";
export type Change = { category: ChangeCategory; key: string; text: string };
export type ChangeNames = {
  ticket(id: string): string;
  question(id: string): string;
  run(id: string): string;
};

export const DIGEST_LIMIT = 50;
export const DIGEST_TITLE = "## Depuis ton dernier tour";
export const NO_CHANGE = "Aucun changement depuis ton dernier tour.";
const CATEGORIES: readonly ChangeCategory[] = ["runs", "tickets", "questions", "notes"];

export const RUN_STATE_TEXT: Record<RunState, string> = {
  queued: "en file",
  starting: "démarrage",
  running: "en cours",
  waiting_input: "attend une réponse",
  done: "terminé",
  failed: "en échec",
  cancelled: "annulé",
};

type Field = { name: keyof TicketPrint; label: string; none: string };
const TICKET_FIELDS: readonly Field[] = [
  { name: "title", label: "titre", none: "aucun" },
  { name: "statusId", label: "statut", none: "aucun" },
  { name: "labels", label: "étiquettes", none: "aucune" },
  { name: "parentId", label: "parent", none: "aucun" },
  { name: "assignee", label: "assigné", none: "aucun" },
  { name: "branch", label: "branche", none: "aucune" },
  { name: "pr", label: "PR", none: "aucune" },
];

const byKey = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);
const unionKeys = (a: Record<string, unknown>, b: Record<string, unknown>): string[] =>
  [...new Set([...Object.keys(a), ...Object.keys(b)])].sort(byKey);

function diffRecord<T>(
  before: Record<string, T>,
  after: Record<string, T>,
  lines: (key: string, old: T | undefined, next: T | undefined) => string[],
): { key: string; text: string }[] {
  return unionKeys(before, after).flatMap((key) =>
    lines(key, before[key], after[key]).map((text) => ({ key, text })),
  );
}

function fieldText(field: Field, value: TicketPrint[keyof TicketPrint], parentKey: (id: string) => string) {
  if (value === null || (Array.isArray(value) && value.length === 0)) return field.none;
  if (Array.isArray(value)) return value.join(", ");
  if (field.name === "title") return `« ${value} »`;
  return field.name === "parentId" ? parentKey(value) : value;
}

function ticketLines(
  name: string,
  old: TicketPrint | undefined,
  next: TicketPrint | undefined,
  parentKey: (id: string) => string,
): string[] {
  if (old === undefined) return next === undefined ? [] : [`Ticket créé : ${name}`];
  if (next === undefined) return [`Ticket supprimé : ${name}`];
  return TICKET_FIELDS.filter((f) => JSON.stringify(old[f.name]) !== JSON.stringify(next[f.name])).map(
    (f) =>
      `${name} : ${f.label} ${fieldText(f, old[f.name], parentKey)} → ${fieldText(f, next[f.name], parentKey)}`,
  );
}

function questionLines(name: string, old: QuestionPrint | undefined, next: QuestionPrint | undefined) {
  if (old === undefined) {
    return next === "answered" ? [`Question posée et répondue : ${name}`] : [`Question posée : ${name}`];
  }
  if (next === undefined) return [`Question supprimée : ${name}`];
  if (old === next) return [];
  return [next === "answered" ? `Question répondue : ${name}` : `Question rouverte : ${name}`];
}

function runLines(name: string, old: RunState | undefined, next: RunState | undefined): string[] {
  if (old === undefined) return next === undefined ? [] : [`Nouveau run ${name} : ${RUN_STATE_TEXT[next]}`];
  if (next === undefined) return [`Run retiré : ${name}`];
  return old === next ? [] : [`Run ${name} : ${RUN_STATE_TEXT[old]} → ${RUN_STATE_TEXT[next]}`];
}

function noteLines(path: string, old: string | undefined, next: string | undefined): string[] {
  if (old === undefined) return [`Note créée : ${path}`];
  if (next === undefined) return [`Note supprimée : ${path}`];
  return old === next ? [] : [`Note modifiée : ${path}`];
}

export function diffFingerprints(
  before: ProjectFingerprint,
  after: ProjectFingerprint,
  names: ChangeNames,
): Change[] {
  const parentKey = (id: string) => after.tickets[id]?.key ?? before.tickets[id]?.key ?? id;
  const tag = (category: ChangeCategory) => (c: { key: string; text: string }) => ({ category, ...c });
  return [
    ...diffRecord(before.runs, after.runs, (k, o, n) => runLines(names.run(k), o, n)).map(tag("runs")),
    ...diffRecord(before.tickets, after.tickets, (k, o, n) =>
      ticketLines(names.ticket(k), o, n, parentKey),
    ).map(tag("tickets")),
    ...diffRecord(before.questions, after.questions, (k, o, n) => questionLines(names.question(k), o, n)).map(
      tag("questions"),
    ),
    ...diffRecord(before.notes, after.notes, noteLines).map(tag("notes")),
  ];
}

export function changeNames(
  project: ProjectSnapshot,
  runs: readonly RunView[],
  before: ProjectFingerprint,
): ChangeNames {
  const label = (key: string | null, title: string, id: string) => `${key ?? id} · ${title}`;
  return {
    ticket(id) {
      const current = project.tickets.find((t) => t.id === id);
      if (current) return label(current.key, current.title, id);
      const old = before.tickets[id];
      return old ? label(old.key, old.title, id) : id;
    },
    question: (id) => project.questions.find((q) => q.id === id)?.title ?? id,
    run: (id) => runs.find((r) => r.id === id)?.label ?? id,
  };
}

const plural = (n: number, word: string): string => `${n} ${word}${n === 1 ? "" : "s"}`;

function totalsLine(changes: readonly Change[]): string {
  const totals = CATEGORIES.map((c) => [c, changes.filter((x) => x.category === c).length] as const)
    .filter(([, n]) => n > 0)
    .map(([c, n]) => plural(n, c.slice(0, -1)));
  return `${changes.length} changements : ${totals.join(", ")}`;
}

const OUTCOME_TEXT: Record<ActionOutcome, string> = {
  applied: "appliqué",
  stale: "périmé",
  failed: "échec",
  skipped: "ignoré",
};
const STATUS_TEXT: Record<Exclude<BatchStatus, "applied" | "partial">, string> = {
  pending: "en attente",
  rejected: "refusé",
  superseded: "remplacé",
  abandoned: "abandonné",
};

export function batchLine(batch: Batch): string {
  const head = `Dernier lot : n° ${batch.seq} — `;
  if (batch.status !== "applied" && batch.status !== "partial") return head + STATUS_TEXT[batch.status];
  const counts = ActionOutcome.options.map(
    (o) => `${OUTCOME_TEXT[o]} ${batch.results.filter((r) => r.outcome === o).length}`,
  );
  return head + counts.join(", ");
}

export function renderDigest(
  changes: readonly Change[],
  lastBatch: Batch | null,
  limit = DIGEST_LIMIT,
): string {
  const lines = [DIGEST_TITLE, ""];
  if (lastBatch) lines.push(batchLine(lastBatch), "");
  if (changes.length === 0) return [...lines, NO_CHANGE].join("\n");
  if (changes.length > limit) lines.push(totalsLine(changes), "");
  lines.push(...changes.slice(0, limit).map((c) => `- ${c.text}`));
  if (changes.length > limit) lines.push("", "… le reste par `project_changes`.");
  return lines.join("\n");
}
