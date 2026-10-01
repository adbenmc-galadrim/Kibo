import { describe, expect, test } from "bun:test";
import {
  COMPONENT_FORMATS,
  FORMAT_SIZES,
  GRID_COLUMNS,
  type Instance,
  inGrid,
  layoutFor,
  overlaps,
} from "@kibo/schema";
import fc from "fast-check";
import {
  canPlace,
  cellMetrics,
  dropTarget,
  formatBox,
  instanceFormat,
  nextLayout,
  readingOrder,
  resolveOverlaps,
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

  test("resolveOverlaps pushes the later widget down and keeps a clean grid intact", () => {
    const clean = [inst("a", layoutFor("large", 0, 0)), inst("b", layoutFor("large", 6, 0))];
    expect([...resolveOverlaps(clean).values()]).toEqual(clean.map((i) => i.layout));
    const dirty = [inst("a", layoutFor("large", 0, 0)), inst("b", layoutFor("medium", 0, 3))];
    expect(resolveOverlaps(dirty).get("b")).toEqual(layoutFor("medium", 0, 6));
  });

  test("resolveOverlaps never loses a widget nor leaves an overlap (property)", () => {
    const arb = fc.array(
      fc.record({ format: fc.constantFrom(...COMPONENT_FORMATS), x: fc.nat(11), y: fc.nat(40) }),
      { maxLength: 12 },
    );
    fc.assert(
      fc.property(arb, (specs) => {
        const instances = specs.map((s, i) =>
          inst(`i${i}`, layoutFor(s.format, Math.min(s.x, GRID_COLUMNS - FORMAT_SIZES[s.format].w), s.y)),
        );
        const out = resolveOverlaps(instances);
        expect(out.size).toBe(instances.length);
        const layouts = [...out.values()];
        for (const l of layouts) expect(inGrid(l)).toBe(true);
        for (let a = 0; a < layouts.length; a++)
          for (let b = a + 1; b < layouts.length; b++) {
            const [la, lb] = [layouts[a], layouts[b]];
            if (la && lb) expect(overlaps(la, lb)).toBe(false);
          }
      }),
    );
  });

  test("nextLayout, dropTarget, canPlace, instanceFormat", () => {
    expect(nextLayout([layoutFor("large", 0, 0)], { w: 6, h: 6 })).toEqual(layoutFor("large", 6, 0));
    expect(nextLayout([layoutFor("half", 0, 0)], { w: 3, h: 3 })).toEqual(layoutFor("small", 0, 6));
    const m = cellMetrics(1200);
    expect(dropTarget(layoutFor("small", 0, 0), { x: 2 * (m.column + 16) + 10, y: -5 }, m)).toEqual(
      layoutFor("small", 2, 0),
    );
    expect(dropTarget(layoutFor("half", 0, 0), { x: 500, y: 0 }, m)).toEqual(layoutFor("half", 0, 0));
    expect(canPlace(layoutFor("small", 0, 0), [layoutFor("small", 2, 2)])).toBe(false);
    expect(canPlace(layoutFor("small", 10, 0), [])).toBe(false);
    expect(canPlace(layoutFor("small", 3, 0), [layoutFor("small", 0, 0)])).toBe(true);
    expect(instanceFormat(inst("a", { x: 0, y: 0, w: 5, h: 5 }), { kind: "dashboard" })).toBe("medium");
    expect(instanceFormat(inst("a", layoutFor("small", 0, 0)), { kind: "dashboard" })).toBe("small");
    expect(instanceFormat(inst("a", layoutFor("small", 0, 0)), { kind: "view" })).toBe("full");
  });
});
