import { clampSize, GRID_COLUMNS, type Layout, MAX_GRID_ROWS, type SizeLimits } from "@kibo/schema";
import type { CellMetrics } from "../lib/format-grid";

export type ResizeEdge = "right" | "bottom" | "corner";
export type ArrowKey = "ArrowLeft" | "ArrowRight" | "ArrowUp" | "ArrowDown";

const KEY_DELTA: Readonly<Record<ArrowKey, readonly [number, number]>> = {
  ArrowRight: [1, 0],
  ArrowLeft: [-1, 0],
  ArrowDown: [0, 1],
  ArrowUp: [0, -1],
};

export const isArrowKey = (key: string): key is ArrowKey => Object.hasOwn(KEY_DELTA, key);

const bounded = (layout: Layout, w: number, h: number, limits: SizeLimits): Layout => {
  const size = clampSize({ w, h }, limits);
  return {
    ...layout,
    w: Math.min(size.w, GRID_COLUMNS - layout.x),
    h: Math.min(size.h, MAX_GRID_ROWS - layout.y),
  };
};

const cells = (distance: number, step: number): number => Math.round(distance / step) || 0;

export function resizeTarget(
  layout: Layout,
  edge: ResizeEdge,
  delta: { x: number; y: number },
  m: CellMetrics,
  limits: SizeLimits,
): Layout {
  const dw = edge === "bottom" ? 0 : cells(delta.x, m.column + m.gap);
  const dh = edge === "right" ? 0 : cells(delta.y, m.row + m.gap);
  return bounded(layout, layout.w + dw, layout.h + dh, limits);
}

export function keyboardResize(layout: Layout, key: ArrowKey, limits: SizeLimits): Layout {
  const [dw, dh] = KEY_DELTA[key];
  return bounded(layout, layout.w + dw, layout.h + dh, limits);
}
