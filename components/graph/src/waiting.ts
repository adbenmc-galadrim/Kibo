import { compareKeys, type GraphEdge, type GraphTicket } from "./critical-path";

const unfinished = (tickets: readonly GraphTicket[]) =>
  new Set(tickets.filter((t) => t.statusId !== "done").map((t) => t.id));

const keyOrder = (tickets: readonly GraphTicket[]) => {
  const keyOf = new Map(tickets.map((t) => [t.id, t.key ?? t.id]));
  return (a: string, b: string) => compareKeys(keyOf.get(a) ?? a, keyOf.get(b) ?? b);
};

export function waitingOn(
  tickets: readonly GraphTicket[],
  edges: readonly GraphEdge[],
): Map<string, string[]> {
  const open = unfinished(tickets);
  const byKey = keyOrder(tickets);
  const out = new Map<string, string[]>();
  for (const id of [...open].sort(byKey)) {
    const blockers = new Set(
      edges
        .filter((e) => e.type === "blocks" && e.to === id && e.from !== id && open.has(e.from))
        .map((e) => e.from),
    );
    if (blockers.size > 0) out.set(id, [...blockers].sort(byKey));
  }
  return out;
}

const NOT_STARTED: ReadonlySet<GraphTicket["statusId"]> = new Set(["backlog", "todo"]);

export function readyTickets(tickets: readonly GraphTicket[], edges: readonly GraphEdge[]): string[] {
  const waiting = waitingOn(tickets, edges);
  return tickets
    .filter((t) => NOT_STARTED.has(t.statusId) && !waiting.has(t.id))
    .map((t) => t.id)
    .sort(keyOrder(tickets));
}
