export type ColumnOrder = Record<string, string[]>;
export type Place = "before" | "after";

export const ORDER_KEY = "order";

export function orderColumn<T extends { id: string }>(
  tickets: readonly T[],
  order: readonly string[] | undefined,
): T[] {
  const byId = new Map(tickets.map((t) => [t.id, t]));
  const saved = (order ?? []).flatMap((id) => byId.get(id) ?? []);
  const placed = new Set(saved.map((t) => t.id));
  return [...new Set(saved)].concat(tickets.filter((t) => !placed.has(t.id)));
}

export function placeInColumn(
  order: readonly string[],
  columnIds: readonly string[],
  movedId: string,
  overId: string | null,
  place: Place,
): string[] {
  const rest = orderColumn(
    columnIds.map((id) => ({ id })),
    order,
  )
    .map((t) => t.id)
    .filter((id) => id !== movedId);
  const at = overId === null ? -1 : rest.indexOf(overId);
  if (at === -1) return [...rest, movedId];
  const index = place === "before" ? at : at + 1;
  return [...rest.slice(0, index), movedId, ...rest.slice(index)];
}
