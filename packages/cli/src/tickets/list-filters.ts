import { featureLabel, KiboError, type TicketView } from "@kibo/schema";
import { splitList } from "../args";
import { lookupTicket, type TicketSummary } from "./ticket-view";

export type TicketFilter = (t: TicketSummary) => boolean;

export function featureFilter(tickets: readonly TicketView[], raw: string): TicketFilter | null {
  const root = lookupTicket(tickets, raw);
  if (root === null) return null;
  if (root.parentId !== null) {
    const parent = tickets.find((t) => t.id === root.parentId);
    const feature = parent === undefined ? root.parentId : featureLabel(parent) || parent.id;
    throw new KiboError("INVALID_INPUT", `${root.keyLabel} is a step of ${feature}: give the feature`);
  }
  return (t) => t.id === root.id || t.feature?.key === root.keyLabel || t.parent?.key === root.keyLabel;
}

export function labelFilter(raw: string): TicketFilter {
  const wanted = new Set(splitList(raw));
  return (t) => t.labels.some((label) => wanted.has(label));
}
