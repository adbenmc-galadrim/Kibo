import { createHash } from "node:crypto";
import {
  type Actor,
  DeliveryStep,
  ExternalRef,
  type ImportRef,
  KiboError,
  type Link,
  type ProjectMeta,
  type Question,
  StatusId,
  type Ticket,
} from "@kibo/schema";
import { z } from "zod";

export type OldTicket = {
  id: string;
  key: string;
  planId: string | null;
  title: string;
  description: string;
  statusId: StatusId;
  blockedReason: string | null;
  parentKey: string | null;
  rank: number;
  labels: string[];
  refs: ExternalRef[];
  delivery: DeliveryStep | null;
  optional: boolean;
};
export type OldAnswer = { text: string; by: Actor; at: number };
export type OldQuestion = {
  id: string;
  ticketKey: string;
  title: string;
  context: string;
  blocking: boolean;
  importRef: ImportRef | null;
  recipient: string | null;
  createdBy: Actor;
  answer: OldAnswer | null;
  archived: boolean;
};
export type OldLink = { fromKey: string; toKey: string; type: Link["type"] };
export type OldMeta = Pick<ProjectMeta, "name" | "key" | "folder" | "color" | "client">;
export type OldProject = {
  project: OldMeta;
  tickets: OldTicket[];
  links: OldLink[];
  questions: OldQuestion[];
  fingerprint: string;
};
export type OldSnapshot = {
  meta: ProjectMeta;
  tickets: readonly Ticket[];
  links: readonly Link[];
  questions: readonly Question[];
};

const planIdOf = (refs: readonly ExternalRef[]): string | null =>
  refs.find((r): r is ImportRef => r.kind === "import_ref" && r.source === "plan")?.id ?? null;

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value === null || typeof value !== "object") return value;
  const entries = Object.entries(value).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return Object.fromEntries(entries.map(([k, v]) => [k, canonical(v)]));
}

export const fingerprintOf = (content: Omit<OldProject, "fingerprint">): string =>
  createHash("sha256")
    .update(JSON.stringify(canonical(content)))
    .digest("hex");

function ranked<T extends { parentKey: string | null }>(items: readonly T[]): (T & { rank: number })[] {
  const seen = new Map<string | null, number>();
  return items.map((item) => {
    const rank = seen.get(item.parentKey) ?? 0;
    seen.set(item.parentKey, rank + 1);
    return { ...item, rank };
  });
}

const sealed = (content: Omit<OldProject, "fingerprint">): OldProject => ({
  ...content,
  fingerprint: fingerprintOf(content),
});

function answerOf(q: Question): OldAnswer | null {
  if (q.answer === null) return null;
  const text = q.answer.text.length > 0 ? q.answer.text : (q.answer.option ?? "");
  return { text, by: q.answer.by, at: q.answer.at };
}

export function readOldProject(snapshot: OldSnapshot): OldProject {
  const keyOf = new Map<string, string>();
  for (const t of snapshot.tickets) {
    if (t.key === null) throw new KiboError("INVALID_INPUT", `ticket ${t.id} has no key yet`);
    keyOf.set(t.id, t.key);
  }
  const key = (id: string): string => {
    const found = keyOf.get(id);
    if (found === undefined) throw new KiboError("INVALID_INPUT", `unknown ticket ${id}`);
    return found;
  };
  const tickets = ranked(
    snapshot.tickets.map((t) => ({
      id: t.id,
      key: key(t.id),
      planId: planIdOf(t.externalRefs),
      title: t.title,
      description: t.description,
      statusId: t.statusId,
      blockedReason: t.blockedReason,
      parentKey: t.parentId === null ? null : key(t.parentId),
      labels: [...t.labels],
      refs: [...t.externalRefs],
      delivery: t.delivery,
      optional: t.optional,
    })),
  );
  const questions = snapshot.questions.map((q) => ({
    id: q.id,
    ticketKey: key(q.ticketId),
    title: q.title,
    context: q.context,
    blocking: q.blocking,
    importRef: q.importRef,
    recipient: q.recipient,
    createdBy: q.createdBy,
    answer: answerOf(q),
    archived: q.archivedAt !== null,
  }));
  const { name, key: projectKey, folder, color, client } = snapshot.meta;
  return sealed({
    project: { name, key: projectKey, folder, color, client },
    tickets,
    links: snapshot.links.map((l) => ({ fromKey: key(l.from), toKey: key(l.to), type: l.type })),
    questions,
  });
}

const ListRef = z.object({ key: z.string().min(1) });
const ListTicket = z.object({
  id: z.string().min(1),
  key: z.string().min(1),
  title: z.string().min(1),
  kiboStatus: StatusId,
  blockedReason: z.string().nullable(),
  parent: ListRef.nullable(),
  deps: z.array(ListRef),
  labels: z.array(z.string()),
  optional: z.boolean(),
  delivery: DeliveryStep.nullable(),
  refs: z.array(ExternalRef),
});

export function readTicketsList(list: unknown, project: OldMeta): OldProject {
  const rows = z.array(ListTicket).parse(list);
  const tickets = ranked(
    rows.map((t) => ({
      id: t.id,
      key: t.key,
      planId: planIdOf(t.refs),
      title: t.title,
      description: "",
      statusId: t.kiboStatus,
      blockedReason: t.blockedReason,
      parentKey: t.parent?.key ?? null,
      labels: t.labels,
      refs: t.refs,
      delivery: t.delivery,
      optional: t.optional,
    })),
  );
  const links = rows.flatMap((t) =>
    t.deps.map((d) => ({ fromKey: d.key, toKey: t.key, type: "blocks" as const })),
  );
  return sealed({ project, tickets, links, questions: [] });
}
