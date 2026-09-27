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
