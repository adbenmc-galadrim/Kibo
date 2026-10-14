import type { Link } from "./link";
import type { Question } from "./question";
import type { TicketView } from "./rpc";
import { FINAL_STATUSES, NOT_STARTED_STATUSES } from "./startable";

export type DeliveryReason = "done" | "blocked" | "question" | "busy" | "status";
export type DeliveryItem = {
  ticketId: string;
  key: string;
  title: string;
  ready: boolean;
  reason: DeliveryReason | null;
  blockedBy: string[];
};
type DeliverySource = Pick<TicketView, "id" | "key" | "title" | "parentId" | "statusId" | "startable">;
export type DeliveryOrderTicket = DeliverySource & { rank: number; openBlockingQuestions: number };
export type DeliveryOrderInput = {
  tickets: readonly DeliveryOrderTicket[];
  links: readonly Pick<Link, "from" | "to" | "type">[];
  busy: ReadonlySet<string>;
  parentId: string;
};

type OpenFacts = Pick<Question, "ticketId" | "blocking" | "answer" | "archivedAt">;

export function deliveryTicketsOf(snapshot: {
  tickets: readonly DeliverySource[];
  questions: readonly OpenFacts[];
}): DeliveryOrderTicket[] {
  const blocking = new Map<string, number>();
  for (const q of snapshot.questions) {
    if (q.blocking && q.answer === null && q.archivedAt === null)
      blocking.set(q.ticketId, (blocking.get(q.ticketId) ?? 0) + 1);
  }
  return snapshot.tickets.map((t, rank) => ({
    id: t.id,
    key: t.key,
    title: t.title,
    parentId: t.parentId,
    statusId: t.statusId,
    startable: t.startable,
    rank,
    openBlockingQuestions: blocking.get(t.id) ?? 0,
  }));
}

function leavesOf(tickets: readonly DeliveryOrderTicket[], parentId: string): DeliveryOrderTicket[] {
  const children = new Map<string, DeliveryOrderTicket[]>();
  for (const t of tickets) {
    if (t.parentId !== null) children.set(t.parentId, [...(children.get(t.parentId) ?? []), t]);
  }
  const leaves: DeliveryOrderTicket[] = [];
  const seen = new Set<string>([parentId]);
  const stack = [...(children.get(parentId) ?? [])];
  while (stack.length > 0) {
    const t = stack.pop();
    if (t === undefined || seen.has(t.id)) continue;
    seen.add(t.id);
    const below = children.get(t.id) ?? [];
    if (below.length === 0) leaves.push(t);
    else stack.push(...below);
  }
  return leaves;
}

const byRank = (a: DeliveryOrderTicket, b: DeliveryOrderTicket): number =>
  a.rank - b.rank || (a.key ?? a.id).localeCompare(b.key ?? b.id);

function topological(
  leaves: DeliveryOrderTicket[],
  edges: readonly [string, string][],
): DeliveryOrderTicket[] {
  const remaining = [...leaves].sort(byRank);
  const waiting = new Map<string, Set<string>>(remaining.map((t) => [t.id, new Set<string>()]));
  for (const [from, to] of edges) if (from !== to) waiting.get(to)?.add(from);
  const order: DeliveryOrderTicket[] = [];
  while (remaining.length > 0) {
    const free = remaining.findIndex((t) => (waiting.get(t.id)?.size ?? 0) === 0);
    const [next] = remaining.splice(free === -1 ? 0 : free, 1);
    if (next === undefined) break;
    order.push(next);
    for (const blockers of waiting.values()) blockers.delete(next.id);
  }
  return order;
}

function reasonOf(
  t: DeliveryOrderTicket,
  busy: boolean,
  blockedBy: readonly string[],
): DeliveryReason | null {
  if (FINAL_STATUSES.includes(t.statusId)) return "done";
  if (busy) return "busy";
  if (!NOT_STARTED_STATUSES.includes(t.statusId)) return "status";
  if (blockedBy.length > 0) return "blocked";
  if (t.openBlockingQuestions > 0) return "question";
  return t.startable ? null : "status";
}

export function deliveryOrder(input: DeliveryOrderInput): DeliveryItem[] {
  const byId = new Map(input.tickets.map((t) => [t.id, t]));
  const leaves = leavesOf(input.tickets, input.parentId);
  const leafIds = new Set(leaves.map((t) => t.id));
  const blocks = input.links.filter((l) => l.type === "blocks");
  const edges = blocks
    .filter((l) => leafIds.has(l.from) && leafIds.has(l.to))
    .map((l): [string, string] => [l.from, l.to]);
  return topological(leaves, edges).map((t) => {
    const blockedBy = blocks
      .filter((l) => l.to === t.id && l.from !== t.id)
      .map((l) => byId.get(l.from))
      .filter((b): b is DeliveryOrderTicket => b !== undefined && !FINAL_STATUSES.includes(b.statusId))
      .map((b) => b.key ?? b.id);
    const ready = t.startable && !input.busy.has(t.id);
    return {
      ticketId: t.id,
      key: t.key ?? t.id,
      title: t.title,
      ready,
      reason: ready ? null : reasonOf(t, input.busy.has(t.id), blockedBy),
      blockedBy,
    };
  });
}
