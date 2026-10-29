import type { TicketView } from "@kibo/schema";
import { splitList } from "../args";
import type { TicketSummary } from "./ticket-view";

export type TicketFilter = (t: TicketSummary) => boolean;

export function featureFilter(root: TicketView): TicketFilter {
  return (t) => t.id === root.id || t.feature?.key === root.keyLabel || t.parent?.key === root.keyLabel;
}

export function labelFilter(raw: string): TicketFilter {
  const wanted = new Set(splitList(raw));
  return (t) => t.labels.some((label) => wanted.has(label));
}
