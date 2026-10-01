import { describe, expect, test } from "bun:test";
import {
  COMPONENT_FORMATS,
  FORMAT_PREFERENCE,
  FORMAT_SIZES,
  type FormatSize,
  formatOf,
  GRID_COLUMNS,
  inGrid,
  isFormatLayout,
  type Layout,
  layoutFor,
  MAX_GRID_ROWS,
  nearestFormat,
  overlaps,
} from "@kibo/schema";
import fc from "fast-check";

const area = (s: FormatSize) => s.w * s.h;

const cellsOf = (l: Layout): Set<string> => {
  const out = new Set<string>();
  for (let x = l.x; x < l.x + l.w; x++) for (let y = l.y; y < l.y + l.h; y++) out.add(`${x},${y}`);
  return out;
};

const layoutWithin = (max: number, side: number) =>
  fc.record({
    x: fc.nat(max),
    y: fc.nat(max),
    w: fc.integer({ min: 1, max: side }),
    h: fc.integer({ min: 1, max: side }),
  });

describe("format properties", () => {
  test("inGrid holds exactly when the layout ends within the columns and the rows", () => {
    fc.assert(
      fc.property(layoutWithin(500, 30), (l) => {
        expect(inGrid(l)).toBe(l.x + l.w <= GRID_COLUMNS && l.y + l.h <= MAX_GRID_ROWS);
      }),
    );
  });

  test("overlaps is symmetric, reflexive and true exactly when a cell is shared", () => {
    fc.assert(
      fc.property(layoutWithin(8, 4), layoutWithin(8, 4), (a, b) => {
        const mine = cellsOf(a);
        const shared = [...cellsOf(b)].some((cell) => mine.has(cell));
        expect(overlaps(a, b)).toBe(shared);
        expect(overlaps(b, a)).toBe(overlaps(a, b));
        expect(overlaps(a, a)).toBe(true);
      }),
    );
  });

  test("nearestFormat is the exact format, else the first preferred format of minimal area gap", () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 40 }), fc.integer({ min: 1, max: 40 }), (w, h) => {
        const nearest = nearestFormat({ w, h });
        const exact = formatOf({ w, h });
        const gap = (s: FormatSize) => Math.abs(area(s) - w * h);
        const best = Math.min(...COMPONENT_FORMATS.map((f) => gap(FORMAT_SIZES[f])));
        const preferred = FORMAT_PREFERENCE.find((f) => gap(FORMAT_SIZES[f]) === best);
        expect(nearest).toBe(exact ?? preferred ?? "half");
      }),
    );
  });

  test("layoutFor gives a layout of the format at the requested cell", () => {
    fc.assert(
      fc.property(fc.constantFrom(...COMPONENT_FORMATS), fc.nat(20), fc.nat(500), (format, x, y) => {
        const l = layoutFor(format, x, y);
        expect(l).toEqual({ x, y, ...FORMAT_SIZES[format] });
        expect(formatOf(l)).toBe(format);
        expect(isFormatLayout(l)).toBe(true);
        expect(nearestFormat(l)).toBe(format);
      }),
    );
  });
});
