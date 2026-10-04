import { describe, expect, test } from "bun:test";
import { type Instance, layoutFor } from "@kibo/schema";
import { formatBox } from "./format-box";
import {
  cellMetrics,
  compactInstances,
  dropTarget,
  instanceFormat,
  nextLayout,
  readingOrder,
} from "./format-grid";

const inst = (id: string, layout: Instance["layout"]): Instance => ({
  id,
  pageId: "pg",
  component: "kanban@1.0.0",
  layout,
  config: {},
  componentHash: null,
});

describe("format grid", () => {
  test("cellMetrics and formatBox at 1200 px", () => {
    const m = cellMetrics(1200);
    expect(m).toEqual({ column: (1200 - 16 * 11) / 12, row: 80, gap: 16 });
    expect(formatBox("small", 1200)).toEqual({ width: 3 * m.column + 2 * 16, height: 3 * 80 + 2 * 16 });
  });

  test("readingOrder sorts by y, x then id", () => {
    const out = readingOrder([
      inst("b", layoutFor("small", 3, 0)),
      inst("a", layoutFor("small", 0, 0)),
      inst("c", layoutFor("small", 0, 3)),
    ]);
    expect(out.map((i) => i.id)).toEqual(["a", "b", "c"]);
  });

  test("compactInstances renders a stored state compacted, without writing", () => {
    const a = inst("a", { x: 0, y: 4, w: 6, h: 6 });
    const b = inst("b", { x: 6, y: 0, w: 6, h: 3 });
    expect([...compactInstances([a, b])]).toEqual([
      ["b", { x: 6, y: 0, w: 6, h: 3 }],
      ["a", { x: 0, y: 0, w: 6, h: 6 }],
    ]);
  });

  test("nextLayout, dropTarget, instanceFormat", () => {
    expect(nextLayout([layoutFor("large", 0, 0)], { w: 6, h: 6 })).toEqual(layoutFor("large", 6, 0));
    expect(nextLayout([layoutFor("half", 0, 0)], { w: 3, h: 3 })).toEqual(layoutFor("small", 0, 6));
    const m = cellMetrics(1200);
    expect(dropTarget(layoutFor("small", 0, 0), { x: 2 * (m.column + 16) + 10, y: -5 }, m)).toEqual(
      layoutFor("small", 2, 0),
    );
    expect(dropTarget(layoutFor("half", 0, 0), { x: 500, y: 0 }, m)).toEqual(layoutFor("half", 0, 0));
    expect(instanceFormat(inst("a", { x: 0, y: 0, w: 5, h: 5 }), { kind: "dashboard" })).toBe("medium");
    expect(instanceFormat(inst("a", layoutFor("small", 0, 0)), { kind: "dashboard" })).toBe("small");
    expect(instanceFormat(inst("a", layoutFor("small", 0, 0)), { kind: "view" })).toBe("full");
  });
});
