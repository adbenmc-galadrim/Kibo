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
