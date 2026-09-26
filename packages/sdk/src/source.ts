import { InstanceSource, type TicketView } from "@kibo/schema";

export function readSource(config: Record<string, unknown>): InstanceSource | null {
  const parsed = InstanceSource.safeParse(config.source);
  return parsed.success ? parsed.data : null;
}

export function matchesSource(ticket: TicketView, source: InstanceSource | null): boolean {
  if (source === null) return true;
  return ticket.externalRefs.some((r) => r.kind === "github_issue" && r.bindingId === source.bindingId);
}

export function filterBySource(tickets: TicketView[], source: InstanceSource | null): TicketView[] {
  if (source === null) return tickets;
  const byId = new Map(tickets.map((t) => [t.id, t]));
  const memo = new Map<string, boolean>();
  const inside = (t: TicketView): boolean => {
    const known = memo.get(t.id);
    if (known !== undefined) return known;
    memo.set(t.id, false);
    const parent = t.parentId ? byId.get(t.parentId) : undefined;
    const result = matchesSource(t, source) || (parent !== undefined && inside(parent));
    memo.set(t.id, result);
    return result;
  };
  return tickets.filter(inside);
}
