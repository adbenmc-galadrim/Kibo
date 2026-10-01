import { StatusId } from "@kibo/schema";
import type { KiboSdk } from "@kibo/sdk";
import { type ColumnOrder, ORDER_KEY, orderColumn, type Place, placeInColumn } from "./column-order";

type Id = string | number;
export type DropEvent = { active: { id: Id }; over: { id: Id } | null };
export type Drop = { ticketId: string; statusId: StatusId; overId: string | null; place: Place };
type Placed = { id: string; statusId: StatusId };

const columnOf = (columns: ColumnOrder, id: string): string | undefined =>
  Object.keys(columns).find((s) => columns[s]?.includes(id));

const asStatus = (id: string | undefined): StatusId | null => {
  const parsed = StatusId.safeParse(id);
  return parsed.success ? parsed.data : null;
};

function sideOf(columns: ColumnOrder, target: string, ticketId: string, overId: string): Place {
  const ids = columns[target] ?? [];
  if (!ids.includes(ticketId)) return "before";
  return ids.indexOf(ticketId) < ids.indexOf(overId) ? "after" : "before";
}

export function dropInColumn(event: DropEvent, columns: ColumnOrder): Drop | null {
  if (!event.over) return null;
  const ticketId = String(event.active.id);
  const overId = String(event.over.id);
  if (overId === ticketId) return null;
  const column = asStatus(overId);
  if (column !== null && Object.hasOwn(columns, column)) {
    return { ticketId, statusId: column, overId: null, place: "after" };
  }
  const target = asStatus(columnOf(columns, overId));
  if (target === null) return null;
  return { ticketId, statusId: target, overId, place: sideOf(columns, target, ticketId, overId) };
}

export function readColumnOrder(value: unknown): ColumnOrder {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return {};
  const order: ColumnOrder = {};
  for (const [statusId, ids] of Object.entries(value)) {
    if (Array.isArray(ids)) order[statusId] = ids.filter((id): id is string => typeof id === "string");
  }
  return order;
}

export function nextOrder(saved: ColumnOrder, tickets: readonly Placed[], drop: Drop): ColumnOrder {
  const moved = tickets.find((t) => t.id === drop.ticketId);
  const idsIn = (statusId: StatusId) =>
    tickets.filter((t) => t.statusId === statusId && t.id !== drop.ticketId).map((t) => t.id);
  const next: ColumnOrder = {
    ...saved,
    [drop.statusId]: placeInColumn(
      saved[drop.statusId] ?? [],
      idsIn(drop.statusId),
      drop.ticketId,
      drop.overId,
      drop.place,
    ),
  };
  const source = moved?.statusId;
  if (source !== undefined && source !== drop.statusId && saved[source] !== undefined) {
    next[source] = orderColumn(
      idsIn(source).map((id) => ({ id })),
      saved[source],
    ).map((t) => t.id);
  }
  return next;
}

export async function commitDrop(
  sdk: Pick<KiboSdk, "run" | "data">,
  tickets: readonly Placed[],
  drop: Drop,
  reason?: string,
): Promise<ColumnOrder> {
  const moved = tickets.find((t) => t.id === drop.ticketId);
  if (moved && moved.statusId !== drop.statusId) {
    await sdk.run({ method: "setStatus", ticketId: drop.ticketId, statusId: drop.statusId, reason });
  }
  const saved = readColumnOrder(await sdk.data.get(ORDER_KEY));
  const next = nextOrder(saved, tickets, drop);
  await sdk.data.set(ORDER_KEY, next);
  return next;
}
