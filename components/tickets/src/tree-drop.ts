import type { TicketView } from "@kibo/schema";

const isDescendant = (tickets: readonly TicketView[], id: string, ancestorId: string): boolean => {
  let current = tickets.find((t) => t.id === id)?.parentId ?? null;
  while (current !== null) {
    if (current === ancestorId) return true;
    current = tickets.find((t) => t.id === current)?.parentId ?? null;
  }
  return false;
};

export function reparentOnDrop(
  tickets: readonly TicketView[],
  activeId: string,
  overId: string,
): { ticketId: string; parentId: string } | null {
  const active = tickets.find((t) => t.id === activeId);
  const over = tickets.find((t) => t.id === overId);
  if (!active || !over || activeId === overId) return null;
  if (active.parentId === overId) return null;
  if (isDescendant(tickets, overId, activeId)) return null;
  return { ticketId: activeId, parentId: overId };
}

export type DropZone = { kind: "before" | "inside" | "after"; ticketId: string };
export type TicketMove = { ticketId: string; parentId: string | null; index?: number };

const KINDS = ["before", "inside", "after"] as const;
type Kind = (typeof KINDS)[number];
const isKind = (s: string): s is Kind => KINDS.some((k) => k === s);

export const zoneId = (zone: DropZone): string => `${zone.ticketId}:${zone.kind}`;

export function parseZoneId(id: string): DropZone | null {
  const at = id.lastIndexOf(":");
  const ticketId = id.slice(0, at);
  const kind = id.slice(at + 1);
  return at > 0 && isKind(kind) ? { kind, ticketId } : null;
}

export function dropPlan(
  tickets: readonly TicketView[],
  activeId: string,
  zone: DropZone,
): TicketMove | null {
  if (zone.kind === "inside") return reparentOnDrop(tickets, activeId, zone.ticketId);
  const active = tickets.find((t) => t.id === activeId);
  const target = tickets.find((t) => t.id === zone.ticketId);
  if (!active || !target || target.id === activeId || isDescendant(tickets, target.id, activeId)) return null;
  const parentId = target.parentId;
  const siblings = tickets.filter((t) => t.parentId === parentId && t.id !== activeId);
  const at = siblings.findIndex((t) => t.id === target.id);
  const index = zone.kind === "before" ? at : at + 1;
  const current = tickets.filter((t) => t.parentId === parentId).findIndex((t) => t.id === activeId);
  if (active.parentId === parentId && current === index) return null;
  return { ticketId: activeId, parentId, index };
}
