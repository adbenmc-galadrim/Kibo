import { join } from "node:path";
import {
  type ExternalRef,
  externalRefKey,
  type ImportRef,
  KiboError,
  type Link,
  type PrInfo,
  type ProjectCommand,
  type Question,
  type Ticket,
} from "@kibo/schema";
import { type Desired, desiredState } from "./desired";
import { loadEmisFiles } from "./emis-files";
import { slugify } from "./markdown";
import { loadAnswers, loadPlan } from "./plan-source";
import { type ReconcileSnapshot, type Reconciliation, resolveCommand } from "./reconcile";

export const FIXTURE = join(import.meta.dir, "..", "fixtures", "emis");

export const fixturePlan = () => loadPlan(join(FIXTURE, "tmp", "plan-data.js"));

export function fixtureDesired(notesDir = "/notes", prs = new Map<number, PrInfo>()): Desired {
  const plan = fixturePlan();
  return desiredState({
    plan,
    answers: loadAnswers(join(FIXTURE, "tmp", "reponses.json")),
    files: loadEmisFiles(FIXTURE, join(FIXTURE, "emis")),
    repoUrl: plan.meta.repo,
    prs,
    notesDir,
  });
}

export const ref = (source: string, id: string): ImportRef => ({ kind: "import_ref", source, id });
export const emptySnapshot = (): ReconcileSnapshot => ({ tickets: [], links: [], questions: [] });

function freshId(prefix: string, taken: readonly { id: string }[]): string {
  let n = taken.length + 1;
  while (taken.some((x) => x.id === `${prefix}${n}`)) n += 1;
  return `${prefix}${n}`;
}

export function withTicket(snapshot: ReconcileSnapshot, patch: Partial<Ticket>): ReconcileSnapshot {
  const id = freshId("t", snapshot.tickets);
  const ticket: Ticket = {
    id,
    key: `EMIS-${id.slice(1)}`,
    pendingSeq: null,
    title: "Sans titre",
    description: "",
    statusId: "todo",
    blockedReason: null,
    domainId: null,
    assignee: null,
    parentId: null,
    externalRefs: [],
    labels: [],
    ...patch,
  };
  return { ...snapshot, tickets: [...snapshot.tickets, ticket] };
}

const upsert = (refs: ExternalRef[], r: ExternalRef): ExternalRef[] => [
  ...refs.filter((e) => e.kind !== r.kind || externalRefKey(e) !== externalRefKey(r)),
  r,
];

function editTicket(
  snapshot: ReconcileSnapshot,
  id: string,
  change: (t: Ticket) => Ticket,
): ReconcileSnapshot {
  if (!snapshot.tickets.some((t) => t.id === id)) throw new KiboError("NOT_FOUND", `ticket ${id}`);
  return { ...snapshot, tickets: snapshot.tickets.map((t) => (t.id === id ? change(t) : t)) };
}

function subtree(snapshot: ReconcileSnapshot, id: string): Set<string> {
  const ids = new Set([id]);
  let size = 0;
  while (ids.size !== size) {
    size = ids.size;
    for (const t of snapshot.tickets) if (t.parentId !== null && ids.has(t.parentId)) ids.add(t.id);
  }
  return ids;
}

function deleteLocally(snapshot: ReconcileSnapshot, id: string): ReconcileSnapshot {
  if (!snapshot.tickets.some((t) => t.id === id)) throw new KiboError("NOT_FOUND", `ticket ${id}`);
  const gone = subtree(snapshot, id);
  return {
    tickets: snapshot.tickets.filter((t) => !gone.has(t.id)),
    links: snapshot.links.filter((l) => !gone.has(l.from) && !gone.has(l.to)),
    questions: snapshot.questions.filter((q) => !gone.has(q.ticketId)),
  };
}

type Cmd<M extends ProjectCommand["method"]> = Extract<ProjectCommand, { method: M }>;

function createLocally(snapshot: ReconcileSnapshot, c: Cmd<"createQuestion">): ReconcileSnapshot {
  if (!snapshot.tickets.some((t) => t.id === c.ticketId)) throw new KiboError("NOT_FOUND", c.ticketId);
  const question: Question = {
    id: freshId("q", snapshot.questions),
    ticketId: c.ticketId,
    runId: null,
    title: c.title,
    context: c.context ?? "",
    options: [...(c.options ?? [])],
    provisional: c.provisional ?? null,
    blocking: c.blocking ?? false,
    createdBy: c.createdBy,
    createdAt: 0,
    importRef: c.importRef ?? null,
    answer: null,
  };
  return { ...snapshot, questions: [...snapshot.questions, question] };
}

function answerLocally(snapshot: ReconcileSnapshot, c: Cmd<"answerQuestion">): ReconcileSnapshot {
  const question = snapshot.questions.find((q) => q.id === c.questionId);
  if (!question) throw new KiboError("NOT_FOUND", c.questionId);
  if (question.answer !== null) throw new KiboError("INVALID_TRANSITION", c.questionId);
  const answer = {
    kind: c.answer.kind,
    option: c.answer.option ?? null,
    text: c.answer.text ?? "",
    by: c.by,
    at: c.at ?? 0,
    deliveredAt: null,
    deliveredRunId: null,
  };
  return {
    ...snapshot,
    questions: snapshot.questions.map((q) => (q.id === c.questionId ? { ...q, answer } : q)),
  };
}

function applyCommand(snapshot: ReconcileSnapshot, c: ProjectCommand): ReconcileSnapshot {
  switch (c.method) {
    case "createTicket": {
      const { method: _m, blockedReason, ...fields } = c;
      return withTicket(snapshot, { ...fields, blockedReason: blockedReason ?? null });
    }
    case "updateTicket": {
      const { method: _m, ticketId, ...patch } = c;
      return editTicket(snapshot, ticketId, (t) => ({ ...t, ...patch }));
    }
    case "setStatus":
      return editTicket(snapshot, c.ticketId, (t) => ({
        ...t,
        statusId: c.statusId,
        blockedReason: c.reason ?? null,
      }));
    case "moveTicket":
      return editTicket(snapshot, c.ticketId, (t) => ({ ...t, parentId: c.parentId }));
    case "upsertExternalRef":
      return editTicket(snapshot, c.ticketId, (t) => ({ ...t, externalRefs: upsert(t.externalRefs, c.ref) }));
    case "addLink": {
      const link: Link = { id: freshId("l", snapshot.links), from: c.from, to: c.to, type: c.type };
      return { ...snapshot, links: [...snapshot.links, link] };
    }
    case "removeLink":
      return { ...snapshot, links: snapshot.links.filter((l) => l.id !== c.linkId) };
    case "deleteTicket":
      return deleteLocally(snapshot, c.ticketId);
    case "createQuestion":
      return createLocally(snapshot, c);
    case "answerQuestion":
      return answerLocally(snapshot, c);
    default:
      throw new KiboError("INVALID_INPUT", `unexpected command ${c.method}`);
  }
}

export function applyLocally(snapshot: ReconcileSnapshot, plan: Reconciliation): ReconcileSnapshot {
  let current = snapshot;
  const ids = new Map<string, string>();
  for (const [index, raw] of plan.commands.entries()) {
    current = applyCommand(current, resolveCommand(raw, ids));
    const placeholder = plan.defines.get(index);
    const created = raw.method === "createQuestion" ? current.questions.at(-1) : current.tickets.at(-1);
    if (placeholder && created) ids.set(placeholder, created.id);
  }
  return current;
}

const idOf = (snapshot: ReconcileSnapshot, source: string, id: string): string | null =>
  snapshot.tickets.find((t) =>
    t.externalRefs.some((r) => r.kind === "import_ref" && r.source === source && r.id === id),
  )?.id ?? null;

export function withLegacyArbitrages(
  snapshot: ReconcileSnapshot,
  descriptions: Readonly<Record<string, string>> = {},
): ReconcileSnapshot {
  let current = snapshot;
  for (const group of fixturePlan().arbitrages) {
    current = withTicket(current, {
      title: group.group,
      parentId: idOf(current, "plan", "arbitrages"),
      externalRefs: [ref("plan", `arbitrages/${slugify(group.group)}`)],
    });
    const groupId = current.tickets.at(-1)?.id ?? null;
    for (const q of group.items) {
      current = withTicket(current, {
        title: `${q.ref} · ${q.question}`,
        description: descriptions[q.ref] ?? `${q.question}\n`,
        statusId: q.resolved ? "done" : "blocked",
        blockedReason: q.resolved ? null : `Attend une réponse (${group.group})`,
        parentId: groupId,
        externalRefs: [ref("plan", q.ref)],
      });
      const from = current.tickets.at(-1)?.id ?? "";
      const to = idOf(current, "plan", q.blocks);
      if (to !== null)
        current = {
          ...current,
          links: [...current.links, { id: freshId("l", current.links), from, to, type: "blocks" }],
        };
    }
  }
  return current;
}
