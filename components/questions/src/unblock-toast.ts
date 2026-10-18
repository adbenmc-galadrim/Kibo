import { isBlocked, type Question, type TicketView } from "@kibo/schema";
import { featureOf, featureOrKey, type TicketOf } from "./ticket-feature";

export type Unblocked = { label: string; ticketId: string };

export function unblockedFeatures(
  tickets: readonly TicketView[],
  ticketOf: TicketOf,
  before: readonly Question[],
  after: readonly Question[],
): Unblocked[] {
  const labelOf = (t: TicketView) => featureOrKey(t, ticketOf);
  const stillBlocked = new Set(tickets.filter((t) => isBlocked(t, after)).map(labelOf));
  const found = new Map<string, Unblocked>();
  for (const t of tickets.filter((t) => isBlocked(t, before) && !isBlocked(t, after))) {
    const label = labelOf(t);
    if (!stillBlocked.has(label) && !found.has(label))
      found.set(label, { label, ticketId: (featureOf(t, ticketOf) ?? t).id });
  }
  return [...found.values()];
}
