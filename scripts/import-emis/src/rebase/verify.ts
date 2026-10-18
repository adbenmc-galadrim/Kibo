import {
  type ExternalRef,
  type Link,
  QUESTION_CONTEXT_MAX,
  QUESTION_TITLE_MAX,
  type Question,
  type Ticket,
} from "@kibo/schema";
import { isPlaced, type Mapping, type PlacedQuestion } from "./mapping";
import type { OldProject, OldTicket } from "./old-project";

export type FreshSnapshot = {
  tickets: readonly Ticket[];
  links: readonly Link[];
  questions: readonly Question[];
};
type Expected = {
  newKey: string;
  title: string;
  labels: readonly string[];
  ticket: OldTicket;
  parentKey: string | null;
};

const STEP_KEY = /^[A-Z]{2,6}-(\d+)$/;
const RETIRED_LABEL = /^(sprint|phase):/;

function refSignature(ref: ExternalRef): string {
  switch (ref.kind) {
    case "github_pr":
      return `PR #${ref.number} ${ref.state}`;
    case "git_branch":
      return `branche ${ref.branch} ← ${ref.base ?? "?"}`;
    case "import_ref":
      return `import ${ref.source}:${ref.id}`;
    default:
      return JSON.stringify(ref);
  }
}

const sameList = (a: readonly string[], b: readonly string[]): boolean =>
  a.length === b.length && [...a].sort().every((v, i) => v === [...b].sort()[i]);

function expectedTickets(mapping: Mapping): Expected[] {
  return mapping.features.flatMap((f) => [
    { newKey: f.shortKey, title: f.title, labels: f.labels, ticket: f.ticket, parentKey: null },
    ...f.steps.map((s) => ({
      newKey: s.newKey,
      title: s.title,
      labels: s.labels,
      ticket: s.ticket,
      parentKey: f.shortKey,
    })),
  ]);
}

function refProblems(who: string, want: readonly ExternalRef[], got: readonly ExternalRef[]): string[] {
  const wanted = want.map(refSignature);
  const found = got.map(refSignature);
  return [
    ...wanted.filter((s) => !found.includes(s)).map((s) => `${who} : ${s} manquant`),
    ...found.filter((s) => !wanted.includes(s)).map((s) => `${who} : ${s} en trop`),
  ];
}

function fieldProblems(e: Expected, t: Ticket, keyOf: (id: string | null) => string | null): string[] {
  const who = `${e.newKey} (ex ${e.ticket.key})`;
  const out: string[] = [];
  const differs = (field: string, want: unknown, got: unknown) => {
    if (want !== got) out.push(`${who} : ${field} ${String(want)} attendu, ${String(got)} trouvé`);
  };
  differs("titre", e.title, t.title);
  if (e.ticket.description !== t.description) out.push(`${who} : description différente`);
  if (e.parentKey !== null) {
    differs("statut", e.ticket.statusId, t.statusId);
    if (e.ticket.statusId === t.statusId) differs("raison", e.ticket.blockedReason, t.blockedReason);
    differs("parent", e.parentKey, keyOf(t.parentId));
    differs("facultative", e.ticket.optional, t.optional);
    differs("étape de livraison", e.ticket.delivery?.step ?? null, t.delivery?.step ?? null);
  }
  if (t.assignee !== null) out.push(`${who} : assignee ${t.assignee.kind}:${t.assignee.ref} recopié`);
  for (const label of t.labels.filter((l) => RETIRED_LABEL.test(l)))
    out.push(`${who} : étiquette ${label} restée`);
  const kept = t.labels.filter((l) => !RETIRED_LABEL.test(l));
  if (!sameList(kept, e.labels)) differs("étiquettes", e.labels.join(","), kept.join(","));
  return [...out, ...refProblems(who, e.ticket.refs, t.externalRefs)];
}

function ticketProblems(expected: readonly Expected[], fresh: FreshSnapshot): string[] {
  const byKey = new Map(fresh.tickets.map((t) => [t.key, t]));
  const byId = new Map(fresh.tickets.map((t) => [t.id, t.key]));
  const keyOf = (id: string | null) => (id === null ? null : (byId.get(id) ?? null));
  return expected.flatMap((e) => {
    const t = byKey.get(e.newKey);
    const who = `${e.newKey} (ex ${e.ticket.key})`;
    if (t === undefined)
      return [e.parentKey === null ? `${who} : fonctionnalité sans clé ${e.newKey}` : `${who} : absent`];
    if (e.parentKey === null && (t.shortKey !== e.newKey || t.parentId !== null))
      return [`${who} : fonctionnalité sans clé ${e.newKey}`];
    return fieldProblems(e, t, keyOf);
  });
}

function keyProblems(mapping: Mapping, fresh: FreshSnapshot): string[] {
  const steps = mapping.features.flatMap((f) => f.steps).length;
  const prefix = mapping.project.key;
  const outside = fresh.tickets
    .filter((t) => t.parentId !== null || t.shortKey === null)
    .map((t) => t.key ?? "(sans clé)")
    .filter((key) => {
      const n = Number(STEP_KEY.exec(key)?.[1] ?? Number.NaN);
      return !key.startsWith(`${prefix}-`) || !(n >= 1 && n <= steps);
    });
  return outside.length > 0
    ? [`clés d'étapes non contiguës : ${outside.join(", ")} hors de ${prefix}-1..${prefix}-${steps}`]
    : [];
}

function countProblems(old: OldProject, mapping: Mapping, fresh: FreshSnapshot): string[] {
  const dropped = new Set(mapping.dropped.map((d) => d.oldKey));
  const asQuestion = new Set(mapping.questions.map((q) => q.old.ticketKey));
  const lost = old.tickets.filter(
    (t) => !mapping.keys.has(t.key) && !dropped.has(t.key) && !asQuestion.has(t.key),
  );
  const want = mapping.keys.size;
  return [
    ...lost.map((t) => `${t.key} « ${t.title} » : ni recréé, ni écarté, ni devenu question`),
    ...(fresh.tickets.length === want ? [] : [`tickets : ${want} attendus, ${fresh.tickets.length} trouvés`]),
  ];
}

const linkSignature = (from: string, to: string, type: string) => `${from} → ${to} (${type})`;

function linkProblems(mapping: Mapping, fresh: FreshSnapshot): string[] {
  const keyOf = new Map(fresh.tickets.map((t) => [t.id, t.key ?? t.id]));
  const want = mapping.links.map((l) => linkSignature(l.from, l.to, l.type));
  const got = fresh.links.map((l) =>
    linkSignature(keyOf.get(l.from) ?? l.from, keyOf.get(l.to) ?? l.to, l.type),
  );
  return [
    ...want.filter((s) => !got.includes(s)).map((s) => `lien ${s} manquant`),
    ...got.filter((s) => !want.includes(s)).map((s) => `lien ${s} en trop`),
  ];
}

function questionSignature(q: PlacedQuestion, ticketKey: string): string {
  const ref = q.old.importRef ? `${q.old.importRef.source}:${q.old.importRef.id}` : "-";
  const title = q.old.title.slice(0, QUESTION_TITLE_MAX);
  const context = q.old.context.slice(0, QUESTION_CONTEXT_MAX);
  return [ref, ticketKey, title, context, q.old.blocking, q.old.answer?.text ?? "", q.old.archived].join("|");
}

function freshQuestionSignature(q: Question, ticketKey: string): string {
  const ref = q.importRef ? `${q.importRef.source}:${q.importRef.id}` : "-";
  const answer = q.answer ? q.answer.text || (q.answer.option ?? "") : "";
  return [ref, ticketKey, q.title, q.context, q.blocking, answer, q.archivedAt !== null].join("|");
}

function questionProblems(mapping: Mapping, fresh: FreshSnapshot): string[] {
  const keyOf = new Map(fresh.tickets.map((t) => [t.id, t.key ?? t.id]));
  const placed = mapping.questions.filter(isPlaced);
  const got = fresh.questions.map((q) => freshQuestionSignature(q, keyOf.get(q.ticketId) ?? q.ticketId));
  const missing = placed.flatMap((q) => {
    const ticketKey = mapping.keys.get(q.ticketOldKey) ?? q.ticketOldKey;
    if (got.includes(questionSignature(q, ticketKey))) return [];
    const label = q.old.importRef?.id ?? q.old.id;
    return [`question ${label} « ${q.old.title} » manquante ou différente sur ${ticketKey}`];
  });
  const count =
    fresh.questions.length === placed.length
      ? []
      : [`questions : ${placed.length} attendues, ${fresh.questions.length} trouvées`];
  return [...missing, ...count];
}

export function verifyRebase(old: OldProject, fresh: FreshSnapshot, mapping: Mapping): string[] {
  return [
    ...countProblems(old, mapping, fresh),
    ...ticketProblems(expectedTickets(mapping), fresh),
    ...keyProblems(mapping, fresh),
    ...linkProblems(mapping, fresh),
    ...questionProblems(mapping, fresh),
  ];
}
