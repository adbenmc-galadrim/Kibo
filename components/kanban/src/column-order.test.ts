import { expect, test } from "bun:test";
import fc from "fast-check";
import { orderColumn, placeInColumn } from "./column-order";

const t = (id: string) => ({ id });

test("orderColumn follows the saved order, appends the rest in tree order, ignores unknown ids", () => {
  expect(orderColumn([t("a"), t("b"), t("c")], ["c", "zz", "a"]).map((x) => x.id)).toEqual(["c", "a", "b"]);
  expect(orderColumn([t("a"), t("b")], undefined).map((x) => x.id)).toEqual(["a", "b"]);
});

test("placeInColumn moves before or after the target, into an empty column, and purges unknown ids", () => {
  expect(placeInColumn(["a", "b", "c"], ["a", "b", "c"], "c", "a", "before")).toEqual(["c", "a", "b"]);
  expect(placeInColumn(["a", "b"], ["a", "b"], "a", "b", "after")).toEqual(["b", "a"]);
  expect(placeInColumn([], [], "x", null, "after")).toEqual(["x"]);
  expect(placeInColumn(["gone", "a"], ["a"], "n", "a", "after")).toEqual(["a", "n"]);
});

test("placeInColumn puts a card dropped on its column or an unknown target at the end", () => {
  expect(placeInColumn(["a", "b"], ["a", "b"], "a", null, "after")).toEqual(["b", "a"]);
  expect(placeInColumn(["a", "b"], ["a", "b"], "n", "gone", "before")).toEqual(["a", "b", "n"]);
});

const ids = fc.uniqueArray(fc.constantFrom("a", "b", "c", "d", "e", "f", "g"), { maxLength: 7 });

test("placeInColumn keeps every card of the column exactly once, the moved one included", () => {
  fc.assert(
    fc.property(
      ids,
      ids,
      fc.constantFrom("a", "x"),
      fc.option(fc.constantFrom("a", "b", "z")),
      (saved, column, moved, over) => {
        const next = placeInColumn(saved, column, moved, over, "before");
        expect(new Set(next).size).toBe(next.length);
        expect([...next].sort()).toEqual([...new Set([...column, moved])].sort());
      },
    ),
  );
});

test("orderColumn is a permutation of the column whatever the saved order", () => {
  fc.assert(
    fc.property(ids, fc.array(fc.string({ maxLength: 2 })), (column, saved) => {
      const shown = orderColumn(column.map(t), saved).map((x) => x.id);
      expect([...shown].sort()).toEqual([...column].sort());
    }),
  );
});
