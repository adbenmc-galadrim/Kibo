import { expect, test } from "bun:test";
import fc from "fast-check";
import type { GraphEdge } from "./critical-path";
import { reduceTransitive } from "./transitive";

const blocks = (from: string, to: string): GraphEdge => ({ from, to, type: "blocks" });

test("a shortcut implied by a path is set aside", () => {
  expect(reduceTransitive([blocks("A", "B"), blocks("B", "C"), blocks("A", "C")])).toEqual({
    kept: [blocks("A", "B"), blocks("B", "C")],
    implied: [blocks("A", "C")],
  });
});

test("a diamond keeps every link and relates are never reduced", () => {
  const diamond = [blocks("A", "B"), blocks("A", "C"), blocks("B", "D"), blocks("C", "D")];
  expect(reduceTransitive(diamond)).toEqual({ kept: diamond, implied: [] });
  const relates: GraphEdge = { from: "A", to: "C", type: "relates" };
  expect(reduceTransitive([blocks("A", "B"), blocks("B", "C"), relates]).kept).toContainEqual(relates);
});

const closure = (edges: GraphEdge[]): Set<string> => {
  const succ = new Map<string, string[]>();
  for (const e of edges) succ.set(e.from, [...(succ.get(e.from) ?? []), e.to]);
  const pairs = new Set<string>();
  for (const start of succ.keys()) {
    const stack = [...(succ.get(start) ?? [])];
    const seen = new Set<string>();
    while (stack.length > 0) {
      const id = stack.pop();
      if (id === undefined || seen.has(id)) continue;
      seen.add(id);
      pairs.add(`${start}>${id}`);
      stack.push(...(succ.get(id) ?? []));
    }
  }
  return pairs;
};

const dagArb = fc
  .array(fc.tuple(fc.nat(9), fc.nat(9)), { maxLength: 40 })
  .map((pairs) => pairs.filter(([a, b]) => a < b).map(([a, b]) => blocks(`N${a}`, `N${b}`)));

test("kept and implied partition the blocks and kept has the same reachability", () => {
  fc.assert(
    fc.property(dagArb, (edges) => {
      const { kept, implied } = reduceTransitive(edges);
      expect(kept.length + implied.length).toBe(edges.length);
      for (const e of edges) expect([...kept, ...implied]).toContainEqual(e);
      expect(closure(kept)).toEqual(closure(edges));
    }),
  );
});
