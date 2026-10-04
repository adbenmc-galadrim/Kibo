import { expect, test } from "bun:test";
import { inGrid, MAX_GRID_ROWS } from "./format";
import { compactLayouts, type PlacedLayout } from "./layout-compaction";

const at = (id: string, x: number, y: number, w: number, h: number): PlacedLayout => ({
  id,
  layout: { x, y, w, h },
});
const sorted = (m: Map<string, { x: number; y: number; w: number; h: number }>) =>
  [...m].sort(([a], [b]) => a.localeCompare(b));

test("every widget rises to the first free row above it, keeping x and size", () => {
  const out = compactLayouts([at("k", 0, 4, 6, 6), at("t", 6, 0, 6, 3), at("g", 6, 9, 6, 3)]);
  expect(sorted(out)).toEqual([
    ["g", { x: 6, y: 3, w: 6, h: 3 }],
    ["k", { x: 0, y: 0, w: 6, h: 6 }],
    ["t", { x: 6, y: 0, w: 6, h: 3 }],
  ]);
});

test("overlaps are resolved in reading order, the first ids win their place, and the result is compact and idempotent", () => {
  const stacked = [at("a", 0, 0, 12, 6), at("b", 0, 0, 12, 6)];
  expect(sorted(compactLayouts(stacked))).toEqual([
    ["a", { x: 0, y: 0, w: 12, h: 6 }],
    ["b", { x: 0, y: 6, w: 12, h: 6 }],
  ]);
  expect(sorted(compactLayouts(stacked, ["b"]))).toEqual([
    ["a", { x: 0, y: 6, w: 12, h: 6 }],
    ["b", { x: 0, y: 0, w: 12, h: 6 }],
  ]);
  const once = compactLayouts([at("k", 0, 4, 6, 6), at("t", 6, 0, 6, 3)]);
  const twice = compactLayouts([...once].map(([id, layout]) => ({ id, layout })));
  expect(sorted(twice)).toEqual(sorted(once));
});

test("a widget dropped under another stays under it, a widget dropped on another pushes it down", () => {
  const under = compactLayouts([at("a", 0, 0, 6, 3), at("b", 0, 7, 6, 3)], ["b"]);
  expect(under.get("b")).toEqual({ x: 0, y: 3, w: 6, h: 3 });
  const onTop = compactLayouts([at("a", 0, 0, 6, 3), at("b", 0, 1, 6, 3)], ["b"]);
  expect(sorted(onTop)).toEqual([
    ["a", { x: 0, y: 3, w: 6, h: 3 }],
    ["b", { x: 0, y: 0, w: 6, h: 3 }],
  ]);
});

test("a widget wider than the grid or past its right edge is pulled back inside", () => {
  expect(compactLayouts([at("w", 8, 0, 6, 3)]).get("w")).toEqual({ x: 6, y: 0, w: 6, h: 3 });
  expect(compactLayouts([at("x", 0, 0, 14, 3)]).get("x")).toEqual({ x: 0, y: 0, w: 12, h: 3 });
});

test("unknown ids in first are ignored and the input order does not matter", () => {
  const items = [at("a", 0, 0, 6, 3), at("b", 6, 0, 6, 3), at("c", 0, 7, 12, 3)];
  const forward = compactLayouts(items, ["zz"]);
  const backward = compactLayouts([...items].reverse());
  expect(sorted(forward)).toEqual(sorted(backward));
  expect(forward.get("c")).toEqual({ x: 0, y: 3, w: 12, h: 3 });
});

test("a widget can rise to the last rows of the grid but never past them, even when the grid is full", () => {
  const tall = at("a", 0, 0, 12, MAX_GRID_ROWS - 4);
  expect(compactLayouts([tall, at("b", 0, 0, 12, 4)]).get("b")).toEqual({
    x: 0,
    y: MAX_GRID_ROWS - 4,
    w: 12,
    h: 4,
  });
  const full = compactLayouts([tall, at("b", 0, 0, 12, 4), at("c", 0, 0, 12, 4)]);
  for (const layout of full.values()) expect(inGrid(layout)).toBe(true);
});
