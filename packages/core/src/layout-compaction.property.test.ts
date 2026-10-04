import { expect, test } from "bun:test";
import { compactLayouts, GRID_COLUMNS, inGrid, type Layout, overlaps, type PlacedLayout } from "@kibo/schema";
import fc from "fast-check";

const item = fc.record({
  id: fc.uuid(),
  layout: fc.record({
    x: fc.integer({ min: 0, max: 11 }),
    y: fc.integer({ min: 0, max: 40 }),
    w: fc.integer({ min: 1, max: 14 }),
    h: fc.integer({ min: 1, max: 9 }),
  }),
});
const items = fc.uniqueArray(item, { maxLength: 12, selector: (i) => i.id });
const withFirst = items.chain((list) =>
  fc.tuple(
    fc.constant(list),
    fc.subarray(list.map((i) => i.id)),
    fc.shuffledSubarray(list, { minLength: list.length }),
  ),
);
const byId = (m: Map<string, Layout>): [string, Layout][] => [...m].sort(([a], [b]) => a.localeCompare(b));

function assertCompact(list: readonly PlacedLayout[], out: Map<string, Layout>): void {
  expect(out.size).toBe(list.length);
  const layouts = [...out.values()];
  for (const l of layouts) {
    expect(inGrid(l)).toBe(true);
    expect(l.x + l.w).toBeLessThanOrEqual(GRID_COLUMNS);
  }
  for (const [i, a] of layouts.entries())
    for (const b of layouts.slice(i + 1)) expect(overlaps(a, b)).toBe(false);
  for (const l of layouts) {
    if (l.y === 0) continue;
    const above = { ...l, y: l.y - 1 };
    expect(layouts.some((o) => o !== l && overlaps(o, above))).toBe(true);
  }
}

test("compaction never overlaps, stays in the grid and leaves no free row above any widget", () => {
  fc.assert(
    fc.property(withFirst, ([list, first]) => {
      assertCompact(list, compactLayouts(list, first));
    }),
  );
});

test("compaction is idempotent on a compact state", () => {
  fc.assert(
    fc.property(withFirst, ([list, first]) => {
      const out = compactLayouts(list, first);
      const again = compactLayouts([...out].map(([id, layout]) => ({ id, layout })));
      expect(byId(again)).toEqual(byId(out));
    }),
  );
});

test("the result does not depend on the input order", () => {
  fc.assert(
    fc.property(withFirst, ([list, first, shuffled]) => {
      expect(byId(compactLayouts(shuffled, first))).toEqual(byId(compactLayouts(list, first)));
    }),
  );
});

test("a pinned widget keeps its column and size", () => {
  fc.assert(
    fc.property(withFirst, ([list, first]) => {
      const out = compactLayouts(list, first);
      for (const id of first) {
        const before = list.find((i) => i.id === id)?.layout;
        const after = out.get(id);
        if (before === undefined || after === undefined) throw new Error("missing pinned widget");
        expect(after.w).toBe(Math.min(before.w, GRID_COLUMNS));
        expect(after.h).toBe(before.h);
        expect(after.x).toBe(Math.min(before.x, GRID_COLUMNS - after.w));
      }
    }),
  );
});
