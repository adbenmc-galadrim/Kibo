import { isBlocked, type Question, type TicketView } from "@kibo/schema";
import { fr } from "./fr";
import { featureOf, featureOrKey, type TicketOf } from "./ticket-feature";

export type Unblocked = { label: string; ticketId: string };
export type UnblockedToast = Unblocked & { message: string };

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

export function unblockedToast(found: readonly Unblocked[]): UnblockedToast | null {
  const [first, ...others] = found;
  if (first === undefined) return null;
  const message =
    others.length === 0 ? fr.unblocked(first.label) : fr.unblockedMany(first.label, others.length);
  return { ...first, message };
}
