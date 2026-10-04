import { GRID_COLUMNS, MAX_GRID_ROWS, overlaps } from "./format";
import type { Layout } from "./instance";

export type PlacedLayout = { id: string; layout: Layout };

const clamp = (value: number, min: number, max: number): number => Math.min(Math.max(value, min), max);

const readingOrder = (a: PlacedLayout, b: PlacedLayout): number =>
  a.layout.y - b.layout.y || a.layout.x - b.layout.x || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

const normalized = (l: Layout): Layout => {
  const w = clamp(l.w, 1, GRID_COLUMNS);
  const h = clamp(l.h, 1, MAX_GRID_ROWS);
  return { x: clamp(l.x, 0, GRID_COLUMNS - w), y: clamp(l.y, 0, MAX_GRID_ROWS - h), w, h };
};

const lowestFree = (layout: Layout, from: number, taken: readonly Layout[]): Layout => {
  let y = from;
  while (y + layout.h < MAX_GRID_ROWS && taken.some((t) => overlaps(t, { ...layout, y }))) y++;
  return { ...layout, y };
};

function settle(items: readonly PlacedLayout[], first: readonly string[]): PlacedLayout[] {
  const byId = new Map(items.map((item) => [item.id, item]));
  const pinnedIds = new Set<string>();
  const settled: PlacedLayout[] = [];
  for (const id of first) {
    const item = byId.get(id);
    if (item === undefined || pinnedIds.has(id)) continue;
    pinnedIds.add(id);
    settled.push({ id, layout: normalized(item.layout) });
  }
  const others = items
    .filter((item) => !pinnedIds.has(item.id))
    .map((item) => ({ id: item.id, layout: normalized(item.layout) }))
    .sort(readingOrder);
  for (const item of others) {
    const taken = settled.map((s) => s.layout);
    settled.push({ id: item.id, layout: lowestFree(item.layout, item.layout.y, taken) });
  }
  return settled;
}

export function compactLayouts(
  items: readonly PlacedLayout[],
  first: readonly string[] = [],
): Map<string, Layout> {
  const out = new Map<string, Layout>();
  const placed: Layout[] = [];
  for (const item of settle(items, first).sort(readingOrder)) {
    const layout = lowestFree(item.layout, 0, placed);
    out.set(item.id, layout);
    placed.push(layout);
  }
  return out;
}
