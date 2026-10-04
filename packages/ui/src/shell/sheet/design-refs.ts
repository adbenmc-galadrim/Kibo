import type { DesignProvider, FigmaNodeRef, PenpotBoardRef, TicketView } from "@kibo/schema";

export type DesignRef = FigmaNodeRef | PenpotBoardRef;

export const designRefs = (ticket: TicketView): DesignRef[] =>
  ticket.externalRefs.filter((r): r is DesignRef => r.kind === "figma_node" || r.kind === "penpot_board");

export const refProvider = (ref: DesignRef): DesignProvider =>
  ref.kind === "figma_node" ? "figma" : "penpot";
