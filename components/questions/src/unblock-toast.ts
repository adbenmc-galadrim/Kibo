import { isBlocked, type Question, type TicketView } from "@kibo/schema";
import { featureOrKey, type TicketOf } from "./ticket-feature";

export function unblockedFeatures(
  tickets: readonly TicketView[],
  ticketOf: TicketOf,
  before: readonly Question[],
  after: readonly Question[],
): string[] {
  const labels = tickets
    .filter((t) => isBlocked(t, before) && !isBlocked(t, after))
    .map((t) => featureOrKey(t, ticketOf));
  return [...new Set(labels)];
}
