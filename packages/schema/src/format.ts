import { z } from "zod";
import type { Layout } from "./instance";

export const COMPONENT_FORMATS = ["small", "medium", "large", "half", "full"] as const;
export const ComponentFormat = z.enum(COMPONENT_FORMATS);
export type ComponentFormat = z.infer<typeof ComponentFormat>;
export type FormatSize = { w: number; h: number };

export const GRID_COLUMNS = 12;
export const MAX_GRID_ROWS = 400;

export const FORMAT_SIZES: Readonly<Record<ComponentFormat, FormatSize>> = {
  small: { w: 3, h: 3 },
  medium: { w: 6, h: 3 },
  large: { w: 6, h: 6 },
  half: { w: 12, h: 6 },
  full: { w: 12, h: 9 },
};

export const FORMAT_PREFERENCE: readonly ComponentFormat[] = ["medium", "large", "half", "small", "full"];

export const inGrid = (l: Layout): boolean => l.x + l.w <= GRID_COLUMNS && l.y + l.h <= MAX_GRID_ROWS;

export const overlaps = (a: Layout, b: Layout): boolean =>
  a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

export const formatOf = (size: FormatSize): ComponentFormat | null =>
  COMPONENT_FORMATS.find((f) => FORMAT_SIZES[f].w === size.w && FORMAT_SIZES[f].h === size.h) ?? null;

export const isFormatLayout = (l: Layout): boolean => formatOf(l) !== null;

const areaGap = (format: ComponentFormat, size: FormatSize): number =>
  Math.abs(FORMAT_SIZES[format].w * FORMAT_SIZES[format].h - size.w * size.h);

export const nearestFormat = (size: FormatSize): ComponentFormat =>
  formatOf(size) ??
  FORMAT_PREFERENCE.reduce((best, f) => (areaGap(f, size) < areaGap(best, size) ? f : best));

export const layoutFor = (format: ComponentFormat, x: number, y: number): Layout => ({
  x,
  y,
  ...FORMAT_SIZES[format],
});
