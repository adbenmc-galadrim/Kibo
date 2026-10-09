import {
  type ExternalRef,
  externalRefKey,
  type ImportRef,
  KiboError,
  type Link,
  type ProjectCommand,
  type Question,
  type Ticket,
} from "@kibo/schema";
import type { Desired, DesiredTicket } from "./desired";
import { refKey } from "./desired-tickets";
import type { ImportMemory } from "./import-memory";
import {
  legacyRef,
  migrateQuestionTickets,
  reconcileQuestions,
  withRecoveredAnswers,
} from "./reconcile-questions";
import { describeFields, desiredMemory, fieldCommands, same } from "./ticket-fields";

export type ChangeKind = "created" | "updated" | "kept" | "orphan" | "drift" | "migrated";
export type Change = { kind: ChangeKind; what: string; detail: string };
export type ReconcileSnapshot = {
  tickets: readonly Ticket[];
  links: readonly Link[];
  questions: readonly Question[];
};
export type Reconciliation = {
  commands: ProjectCommand[];
  defines: ReadonlyMap<number, string>;
  changes: Change[];
  memory: ImportMemory;
};
type Wanted = Pick<Desired, "tickets" | "links" | "questions">;
type Match = { desired: DesiredTicket; existing: Ticket | null; id: string };
type Phases = {
  create: ProjectCommand[];
  edit: ProjectCommand[];
  status: ProjectCommand[];
  refs: ProjectCommand[];
};

export const IMPORT_SOURCES: readonly string[] = ["plan", "todo"];
const PENDING = "new:";

export const pendingId = (ref: ImportRef): string => `${PENDING}${refKey(ref)}`;
export const sameImportRef = (a: ImportRef, b: ImportRef): boolean => a.source === b.source && a.id === b.id;

const importRefsOf = (t: Ticket): ImportRef[] =>
  t.externalRefs.filter((r): r is ImportRef => r.kind === "import_ref");

function matchTickets(snapshot: ReconcileSnapshot, desired: readonly DesiredTicket[]): Match[] {
  const byRef = new Map<string, Ticket>();
  for (const t of snapshot.tickets) for (const r of importRefsOf(t)) byRef.set(refKey(r), t);
  const used = new Set<string>();
  const found = desired.map((d) => {
    const t = byRef.get(refKey(d.ref)) ?? null;
    if (t) used.add(t.id);
    return t;
  });
  return desired.map((d, i) => {
    const byTitle = () =>
      snapshot.tickets.find(
        (t) =>
          !used.has(t.id) &&
          t.title.trim() === d.title.trim() &&
          !importRefsOf(t).some((r) => r.source === d.ref.source),
      ) ?? null;
    const existing = found[i] ?? byTitle();
    if (existing) used.add(existing.id);
    return { desired: d, existing, id: existing?.id ?? pendingId(d.ref) };
  });
}

function parentId(d: DesiredTicket, ids: ReadonlyMap<string, string>): string | null {
  if (d.parent === null) return null;
  const id = ids.get(refKey(d.parent));
  if (id === undefined) throw new KiboError("INVALID_INPUT", `parent ${refKey(d.parent)} is not imported`);
  return id;
}

function createCommand(d: DesiredTicket, parent: string | null): ProjectCommand {
  return {
    method: "createTicket",
    title: d.title.trim(),
    description: d.description,
    statusId: d.statusId,
    ...(d.blockedReason === null ? {} : { blockedReason: d.blockedReason }),
    parentId: parent,
    labels: d.labels,
  };
}

function refsToSet(d: DesiredTicket, existing: Ticket | null): ExternalRef[] {
  const wanted: ExternalRef[] = [d.ref, ...d.refs];
  if (existing === null) return wanted;
  return wanted.filter((r) => {
    if (r.kind === "git_branch") return false;
    const current = existing.externalRefs.find(
      (e) => e.kind === r.kind && externalRefKey(e) === externalRefKey(r),
    );
    if (current === undefined) return true;
    return r.kind !== "github_pr" && !same(current, r);
  });
}

function ticketChanges(
  matches: Match[],
  ids: ReadonlyMap<string, string>,
  phases: Phases,
  memory: ImportMemory,
) {
  const defines = new Map<number, string>();
  const changes: Change[] = [];
  const next: ImportMemory = { ...memory };
  for (const m of matches) {
    const key = refKey(m.desired.ref);
    const what = `ticket ${m.desired.ref.id}`;
    const parent = parentId(m.desired, ids);
    const title = m.desired.title.replace(`${m.desired.ref.id} · `, "");
    const refs = refsToSet(m.desired, m.existing);
    for (const ref of refs) phases.refs.push({ method: "upsertExternalRef", ticketId: m.id, ref });
    if (m.existing === null) {
      defines.set(phases.create.length, m.id);
      phases.create.push(createCommand(m.desired, parent));
      next[key] = desiredMemory(m.desired);
      changes.push({ kind: "created", what, detail: title });
      continue;
    }
    const outcome = fieldCommands(m.existing, m.desired, parent, memory[key], ids, phases);
    next[key] = outcome.memory;
    const change = describeFields(
      outcome,
      refs.map((r) => r.kind),
    );
    changes.push(change ? { ...change, what } : { kind: "kept", what, detail: title });
  }
  return { defines, changes, memory: next };
}

function importedIds(snapshot: ReconcileSnapshot): Map<string, ImportRef> {
  const out = new Map<string, ImportRef>();
  for (const t of snapshot.tickets) {
    const r = importRefsOf(t).find((x) => IMPORT_SOURCES.includes(x.source));
    if (r) out.set(t.id, r);
  }
  return out;
}

function linkChanges(
  snapshot: ReconcileSnapshot,
  wanted: Wanted,
  ids: ReadonlyMap<string, string>,
  deleted: ReadonlySet<string>,
) {
  const commands: ProjectCommand[] = [];
  const changes: Change[] = [];
  const pairs = new Set<string>();
  for (const l of wanted.links) {
    const from = ids.get(refKey(l.from));
    const to = ids.get(refKey(l.to));
    if (from === undefined || to === undefined) continue;
    pairs.add(`${from}>${to}`);
    const what = `link ${l.from.id} → ${l.to.id}`;
    const exists = snapshot.links.some((x) => x.type === "blocks" && x.from === from && x.to === to);
    if (!exists) commands.push({ method: "addLink", from, to, type: "blocks" });
    changes.push({ kind: exists ? "kept" : "created", what, detail: "blocks" });
  }
  const imported = importedIds(snapshot);
  for (const l of snapshot.links) {
    const from = imported.get(l.from);
    const to = imported.get(l.to);
    if (l.type !== "blocks" || !from || !to || pairs.has(`${l.from}>${l.to}`)) continue;
    if (deleted.has(l.from) || deleted.has(l.to)) continue;
    changes.push({ kind: "drift", what: `link ${from.id} → ${to.id}`, detail: "blocks" });
  }
  return { commands, changes };
}

function orphans(snapshot: ReconcileSnapshot, wanted: Wanted): Change[] {
  const keys = new Set(wanted.tickets.map((t) => refKey(t.ref)));
  return snapshot.tickets.flatMap((t) =>
    legacyRef(t) !== null
      ? []
      : importRefsOf(t)
          .filter((r) => IMPORT_SOURCES.includes(r.source) && !keys.has(refKey(r)))
          .map((r) => ({ kind: "orphan" as const, what: `ticket ${r.id}`, detail: t.title })),
  );
}

export function reconcile(
  snapshot: ReconcileSnapshot,
  wanted: Wanted,
  memory: ImportMemory = {},
): Reconciliation {
  const matches = matchTickets(snapshot, wanted.tickets);
  const ids = new Map(matches.map((m) => [refKey(m.desired.ref), m.id]));
  const phases: Phases = { create: [], edit: [], status: [], refs: [] };
  const tickets = ticketChanges(matches, ids, phases, memory);
  const migration = migrateQuestionTickets(snapshot, wanted.questions, ids);
  const links = linkChanges(snapshot, wanted, ids, migration.deleted);
  const before = [...phases.create, ...phases.edit, ...phases.status, ...phases.refs, ...links.commands];
  const questions = reconcileQuestions(snapshot, withRecoveredAnswers(snapshot, wanted.questions), ids);
  const defines = new Map(tickets.defines);
  for (const [index, id] of questions.defines) defines.set(before.length + index, id);
  return {
    commands: [...before, ...questions.commands, ...migration.commands],
    defines,
    memory: tickets.memory,
    changes: [
      ...tickets.changes,
      ...links.changes,
      ...questions.changes,
      ...migration.changes,
      ...orphans(snapshot, wanted),
    ],
  };
}

function resolveId(id: string, ids: ReadonlyMap<string, string>): string {
  if (!id.startsWith(PENDING)) return id;
  const real = ids.get(id);
  if (real === undefined) throw new KiboError("INTERNAL", `${id} was not created`);
  return real;
}

export function resolveCommand(c: ProjectCommand, ids: ReadonlyMap<string, string>): ProjectCommand {
  const r = (id: string) => resolveId(id, ids);
  switch (c.method) {
    case "createTicket":
      return c.parentId ? { ...c, parentId: r(c.parentId) } : c;
    case "updateTicket":
    case "setStatus":
    case "upsertExternalRef":
      return { ...c, ticketId: r(c.ticketId) };
    case "moveTicket":
      return { ...c, ticketId: r(c.ticketId), parentId: c.parentId === null ? null : r(c.parentId) };
    case "addLink":
      return { ...c, from: r(c.from), to: r(c.to) };
    case "createQuestion":
      return { ...c, ticketId: r(c.ticketId) };
    case "answerQuestion":
      return { ...c, questionId: r(c.questionId) };
    default:
      return c;
  }
}
