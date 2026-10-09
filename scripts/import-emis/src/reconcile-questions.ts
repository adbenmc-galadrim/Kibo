import {
  type Actor,
  ANSWER_TEXT_MAX,
  type ImportRef,
  type Link,
  type ProjectCommand,
  type Question,
  type Ticket,
} from "@kibo/schema";
import type { DesiredAnswer, DesiredQuestion } from "./desired-questions";
import { refKey } from "./desired-tickets";
import { truncate } from "./markdown";
import type { Change } from "./reconcile";

export type QuestionSnapshot = { tickets: readonly Ticket[]; questions: readonly Question[] };
export type MigrationSnapshot = QuestionSnapshot & { links: readonly Link[] };
export type QuestionPlan = { commands: ProjectCommand[]; changes: Change[]; defines: Map<number, string> };
export type Migration = { commands: ProjectCommand[]; changes: Change[]; deleted: ReadonlySet<string> };

export const IMPORT_ACTOR: Actor = { kind: "import", ref: "plan" };
const PENDING_QUESTION = "new:question:";
const LEGACY = /^(Q\d+|arbitrages\/.+)$/;
const ANSWER_SECTION = /^## Réponse[ \t]*\n([\s\S]*?)(?=^## |(?![\s\S]))/m;

export const pendingQuestionId = (ref: ImportRef): string => `${PENDING_QUESTION}${refKey(ref)}`;

const planRefOf = (t: Ticket): ImportRef | null =>
  t.externalRefs.find((r): r is ImportRef => r.kind === "import_ref" && r.source === "plan") ?? null;

export function legacyRef(t: Ticket): ImportRef | null {
  const r = planRefOf(t);
  return r !== null && LEGACY.test(r.id) ? r : null;
}

function answerCommand(questionId: string, answer: DesiredAnswer): ProjectCommand {
  const at = answer.at === null ? Number.NaN : Date.parse(answer.at);
  return {
    method: "answerQuestion",
    questionId,
    answer: { kind: "text", text: truncate(answer.text, ANSWER_TEXT_MAX) },
    by: IMPORT_ACTOR,
    ...(Number.isNaN(at) ? {} : { at }),
  };
}

function findExisting(
  snapshot: QuestionSnapshot,
  q: DesiredQuestion,
  ticketId: string | undefined,
  used: ReadonlySet<string>,
): Question | null {
  const free = snapshot.questions.filter((x) => !used.has(x.id));
  return (
    free.find((x) => x.importRef !== null && refKey(x.importRef) === refKey(q.ref)) ??
    free.find((x) => x.importRef === null && x.ticketId === ticketId && x.title.trim() === q.title.trim()) ??
    null
  );
}

export function reconcileQuestions(
  snapshot: QuestionSnapshot,
  desired: readonly DesiredQuestion[],
  ids: ReadonlyMap<string, string>,
): QuestionPlan {
  const plan: QuestionPlan = { commands: [], changes: [], defines: new Map() };
  const used = new Set<string>();
  for (const q of desired) {
    const ticketId = ids.get(refKey(q.ticket));
    const existing = findExisting(snapshot, q, ticketId, used);
    const what = `question ${q.ref.id}`;
    if (existing !== null) {
      used.add(existing.id);
      if (ticketId !== undefined && existing.ticketId !== ticketId)
        plan.changes.push({ kind: "drift", what, detail: "ticket" });
      if (existing.answer === null && q.answer !== null) {
        plan.commands.push(answerCommand(existing.id, q.answer));
        plan.changes.push({ kind: "updated", what, detail: "answer" });
      } else plan.changes.push({ kind: "kept", what, detail: q.title });
      continue;
    }
    if (ticketId === undefined) continue;
    const placeholder = pendingQuestionId(q.ref);
    plan.defines.set(plan.commands.length, placeholder);
    plan.commands.push({
      method: "createQuestion",
      ticketId,
      title: q.title.trim(),
      context: q.context,
      blocking: q.blocking,
      createdBy: IMPORT_ACTOR,
      importRef: q.ref,
    });
    if (q.answer !== null) plan.commands.push(answerCommand(placeholder, q.answer));
    plan.changes.push({ kind: "created", what, detail: q.title });
  }
  for (const x of snapshot.questions)
    if (!used.has(x.id) && x.importRef?.source === "plan")
      plan.changes.push({ kind: "orphan", what: `question ${x.importRef.id}`, detail: x.title });
  return plan;
}

function recoveredAnswer(t: Ticket): DesiredAnswer | null {
  const text = ANSWER_SECTION.exec(t.description)?.[1]?.trim();
  return text ? { text, at: null } : null;
}

export function withRecoveredAnswers(
  snapshot: QuestionSnapshot,
  desired: readonly DesiredQuestion[],
): DesiredQuestion[] {
  const legacy = new Map<string, Ticket>();
  for (const t of snapshot.tickets) {
    const r = legacyRef(t);
    if (r !== null) legacy.set(refKey(r), t);
  }
  return desired.map((q) => {
    const ticket = legacy.get(refKey(q.ref));
    const answer = q.answer ?? (ticket ? recoveredAnswer(ticket) : null);
    return answer === q.answer ? q : { ...q, answer };
  });
}

function deletableTickets(
  snapshot: MigrationSnapshot,
  placed: ReadonlySet<string>,
): { deletable: Ticket[]; refused: Ticket[] } {
  const children = (id: string) => snapshot.tickets.filter((t) => t.parentId === id);
  const memo = new Map<string, boolean>();
  const deletable = (t: Ticket): boolean => {
    const known = memo.get(t.id);
    if (known !== undefined) return known;
    const r = legacyRef(t);
    const self = r !== null && (r.id.startsWith("arbitrages/") || placed.has(refKey(r)));
    const result = self && children(t.id).every(deletable);
    memo.set(t.id, result);
    return result;
  };
  const legacy = snapshot.tickets.filter((t) => legacyRef(t) !== null);
  return { deletable: legacy.filter(deletable), refused: legacy.filter((t) => !deletable(t)) };
}

function depth(snapshot: MigrationSnapshot, t: Ticket): number {
  let n = 0;
  let parent = t.parentId;
  while (parent !== null) {
    n += 1;
    const id = parent;
    parent = snapshot.tickets.find((x) => x.id === id)?.parentId ?? null;
  }
  return n;
}

export function migrateQuestionTickets(
  snapshot: MigrationSnapshot,
  desired: readonly DesiredQuestion[],
  ids: ReadonlyMap<string, string>,
): Migration {
  const placed = new Set(desired.filter((q) => ids.has(refKey(q.ticket))).map((q) => refKey(q.ref)));
  const { deletable, refused } = deletableTickets(snapshot, placed);
  const deleted = new Set(deletable.map((t) => t.id));
  const links = snapshot.links.filter((l) => deleted.has(l.from) || deleted.has(l.to));
  const ordered = [...deletable].sort((a, b) => depth(snapshot, b) - depth(snapshot, a));
  const changes: Change[] = [
    ...ordered.map((t) => ({
      kind: "migrated" as const,
      what: `ticket ${legacyRef(t)?.id}`,
      detail: t.title,
    })),
    ...refused.map((t) => {
      const r = legacyRef(t);
      const what = `ticket ${r?.id}`;
      return r !== null && !r.id.startsWith("arbitrages/") && !placed.has(refKey(r))
        ? { kind: "orphan" as const, what, detail: t.title }
        : { kind: "drift" as const, what, detail: "holds other tickets, kept" };
    }),
  ];
  return {
    commands: [
      ...links.map((l): ProjectCommand => ({ method: "removeLink", linkId: l.id })),
      ...ordered.map((t): ProjectCommand => ({ method: "deleteTicket", ticketId: t.id })),
    ],
    changes,
    deleted,
  };
}
