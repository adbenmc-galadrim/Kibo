import {
  type ComponentFormat,
  FORMAT_SIZES,
  type FormatSize,
  formatOf,
  GRID_COLUMNS,
  type Instance,
  inGrid,
  type Layout,
  MAX_GRID_ROWS,
  nearestFormat,
  overlaps,
  type Page,
} from "@kibo/schema";

export const ROW_HEIGHT = 80;
export const GAP = 16;
export const WIDE_QUERY = "(min-width: 1024px)";

export type CellMetrics = { column: number; row: number; gap: number };

const clamp = (value: number, min: number, max: number): number => Math.min(Math.max(value, min), max);

export const cellMetrics = (width: number): CellMetrics => ({
  column: Math.max(0, (width - GAP * (GRID_COLUMNS - 1)) / GRID_COLUMNS),
  row: ROW_HEIGHT,
  gap: GAP,
});

export const spanLength = (cells: number, unit: number, gap: number): number =>
  cells * unit + (cells - 1) * gap;

export const formatBox = (format: ComponentFormat, width: number): { width: number; height: number } => {
  const m = cellMetrics(width);
  const { w, h } = FORMAT_SIZES[format];
  return { width: spanLength(w, m.column, m.gap), height: spanLength(h, m.row, m.gap) };
};

export const readingOrder = (instances: readonly Instance[]): Instance[] =>
  [...instances].sort(
    (a, b) => a.layout.y - b.layout.y || a.layout.x - b.layout.x || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
  );

export const canPlace = (layout: Layout, others: readonly Layout[]): boolean =>
  inGrid(layout) && !others.some((o) => overlaps(layout, o));

const firstFreeRow = (layout: Layout, placed: readonly Layout[]): Layout | null => {
  const x = layout.w <= GRID_COLUMNS ? clamp(layout.x, 0, GRID_COLUMNS - layout.w) : layout.x;
  for (let y = layout.y; y + layout.h <= MAX_GRID_ROWS; y++) {
    const candidate = { ...layout, x, y };
    if (canPlace(candidate, placed)) return candidate;
  }
  return null;
};

export const resolveOverlaps = (instances: readonly Instance[]): Map<string, Layout> => {
  const out = new Map<string, Layout>();
  for (const instance of readingOrder(instances)) {
    const placed = [...out.values()];
    const kept = canPlace(instance.layout, placed) ? instance.layout : firstFreeRow(instance.layout, placed);
    out.set(instance.id, kept ?? instance.layout);
  }
  return out;
};

export const nextLayout = (taken: readonly Layout[], size: FormatSize): Layout => {
  for (let y = 0; y + size.h <= MAX_GRID_ROWS; y++) {
    for (let x = 0; x + size.w <= GRID_COLUMNS; x++) {
      const slot = { x, y, ...size };
      if (canPlace(slot, taken)) return slot;
    }
  }
  return { x: 0, y: Math.max(0, ...taken.map((t) => t.y + t.h)), ...size };
};

export const dropTarget = (layout: Layout, delta: { x: number; y: number }, metrics: CellMetrics): Layout => {
  const dx = Math.round(delta.x / (metrics.column + metrics.gap)) || 0;
  const dy = Math.round(delta.y / (metrics.row + metrics.gap)) || 0;
  return {
    ...layout,
    x: clamp(layout.x + dx, 0, Math.max(0, GRID_COLUMNS - layout.w)),
    y: clamp(layout.y + dy, 0, Math.max(0, MAX_GRID_ROWS - layout.h)),
  };
};

export const instanceFormat = (instance: Instance, page: Pick<Page, "kind">): ComponentFormat =>
  page.kind === "view" ? "full" : (formatOf(instance.layout) ?? nearestFormat(instance.layout));
