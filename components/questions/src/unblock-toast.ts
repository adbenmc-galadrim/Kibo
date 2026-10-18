import { isBlocked, type Question, type TicketView } from "@kibo/schema";
import { featureOrKey, type TicketOf } from "./ticket-feature";

export function unblockedFeatures(
  tickets: readonly TicketView[],
  ticketOf: TicketOf,
  before: readonly Question[],
  after: readonly Question[],
): string[] {
  const labelOf = (t: TicketView) => featureOrKey(t, ticketOf);
  const stillBlocked = new Set(tickets.filter((t) => isBlocked(t, after)).map(labelOf));
  const labels = tickets
    .filter((t) => isBlocked(t, before) && !isBlocked(t, after))
    .map(labelOf)
    .filter((label) => !stillBlocked.has(label));
  return [...new Set(labels)];
}
