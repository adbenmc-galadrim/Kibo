import type { FigmaNodeRef, TicketView } from "@kibo/schema";

export const figmaRefs = (ticket: TicketView): FigmaNodeRef[] =>
  ticket.externalRefs.filter((r): r is FigmaNodeRef => r.kind === "figma_node");
