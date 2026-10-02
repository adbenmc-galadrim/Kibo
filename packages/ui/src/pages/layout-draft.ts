import {
  type ComponentFormat,
  FORMAT_SIZES,
  formatOf,
  GRID_COLUMNS,
  type Layout,
  layoutFor,
  nearestFormat,
} from "@kibo/schema";
import { type CellMetrics, canPlace, dropTarget } from "../lib/format-grid";

export type Draft = ReadonlyMap<string, Layout>;
export type Target = { layout: Layout; free: boolean };

const othersThan = (layouts: Draft, id: string): Layout[] =>
  [...layouts].filter(([other]) => other !== id).map(([, l]) => l);

export const sameLayout = (a: Layout, b: Layout): boolean =>
  a.x === b.x && a.y === b.y && a.w === b.w && a.h === b.h;

export const asFormat = (l: Layout): Layout => layoutFor(formatOf(l) ?? nearestFormat(l), l.x, l.y);

export function targetOf(
  layouts: Draft,
  id: string,
  delta: { x: number; y: number },
  m: CellMetrics,
): Target | null {
  const current = layouts.get(id);
  if (!current) return null;
  const layout = dropTarget(asFormat(current), delta, m);
  return { layout, free: canPlace(layout, othersThan(layouts, id)) };
}

export function moveWidget(
  layouts: Draft,
  id: string,
  delta: { x: number; y: number },
  m: CellMetrics,
): { layouts: Draft; placed: boolean } {
  const current = layouts.get(id);
  const target = targetOf(layouts, id, delta, m);
  if (!current || !target?.free || (target.layout.x === current.x && target.layout.y === current.y)) {
    return { layouts, placed: false };
  }
  return { layouts: new Map(layouts).set(id, target.layout), placed: true };
}

export function formatChoice(layouts: Draft, id: string, format: ComponentFormat): Target | null {
  const current = layouts.get(id);
  if (!current) return null;
  const { w } = FORMAT_SIZES[format];
  const layout = layoutFor(format, Math.min(current.x, Math.max(0, GRID_COLUMNS - w)), current.y);
  return { layout, free: canPlace(layout, othersThan(layouts, id)) };
}

export function changedIds(origin: Draft, draft: Draft): string[] {
  return [...draft]
    .filter(([id, l]) => {
      const before = origin.get(id);
      return !before || !sameLayout(before, l);
    })
    .sort(([a, la], [b, lb]) => la.y - lb.y || la.x - lb.x || (a < b ? -1 : a > b ? 1 : 0))
    .map(([id]) => id);
}
