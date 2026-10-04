import type { TicketView } from "@kibo/schema";

export type TicketNode = { ticket: TicketView; depth: number; children: TicketNode[] };

export function buildTree(tickets: TicketView[]): TicketNode[] {
  const byParent = new Map<string | null, TicketView[]>();
  for (const t of tickets) byParent.set(t.parentId, [...(byParent.get(t.parentId) ?? []), t]);
  const build = (parentId: string | null, depth: number): TicketNode[] =>
    (byParent.get(parentId) ?? []).map((ticket) => ({
      ticket,
      depth,
      children: build(ticket.id, depth + 1),
    }));
  return build(null, 0);
}

export function mineOnly(tickets: TicketView[], viewer: string): TicketView[] {
  const mine = tickets.filter((t) => t.assignee?.kind === "human" && t.assignee.ref === viewer);
  const ids = new Set(mine.map((t) => t.id));
  return mine.map((t) => (t.parentId !== null && !ids.has(t.parentId) ? { ...t, parentId: null } : t));
}

export function withAncestors(tickets: TicketView[], ids: readonly string[]): ReadonlySet<string> {
  const parentOf = new Map(tickets.map((t) => [t.id, t.parentId]));
  const kept = new Set<string>();
  for (const id of ids) {
    let at: string | null = id;
    while (at !== null && !kept.has(at)) {
      kept.add(at);
      at = parentOf.get(at) ?? null;
    }
  }
  return kept;
}
