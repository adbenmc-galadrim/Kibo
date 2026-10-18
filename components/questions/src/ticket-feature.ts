import { featureLabel, type SprintView, type TicketView } from "@kibo/schema";

export type TicketOf = (id: string) => TicketView | null;
export type Impact = { feature: string; sprint: string | null };

function rootOf(ticket: TicketView, ticketOf: TicketOf): TicketView {
  const seen = new Set<string>([ticket.id]);
  let current = ticket;
  while (current.parentId !== null && !seen.has(current.parentId)) {
    const parent = ticketOf(current.parentId);
    if (parent === null) return current;
    seen.add(parent.id);
    current = parent;
  }
  return current;
}

export function featureOf(ticket: TicketView, ticketOf: TicketOf): TicketView | null {
  const root = rootOf(ticket, ticketOf);
  return root.shortKey === null ? null : root;
}

export function featureOrKey(ticket: TicketView, ticketOf: TicketOf): string {
  const feature = featureOf(ticket, ticketOf);
  return feature === null ? ticket.keyLabel : featureLabel(feature);
}

export function impactOf(
  ticket: TicketView,
  ticketOf: TicketOf,
  sprints: readonly Pick<SprintView, "id" | "code">[],
): Impact {
  const sprint = sprints.find((s) => s.id === ticket.effectiveSprintId);
  return { feature: featureOrKey(ticket, ticketOf), sprint: sprint?.code ?? null };
}
