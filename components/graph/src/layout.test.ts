import { expect, test } from "bun:test";
import fc from "fast-check";
import type { GraphEdge, GraphTicket } from "./critical-path";
import { DEMO_EDGES, DEMO_TICKETS } from "./demo-graph";
import { layoutGraph } from "./layout";

const layerOf = (layout: ReturnType<typeof layoutGraph>) =>
  Object.fromEntries(layout.nodes.map((n) => [n.id, n.layer]));
const todo = (n: number): GraphTicket[] =>
  Array.from({ length: n }, (_, i) => ({ id: `t${i}`, key: `KIB-${i + 1}`, statusId: "todo" }));
const blocks = (from: string, to: string): GraphEdge => ({ from, to, type: "blocks" });

test("demo layout is right-aligned like screen 10", () => {
  const layout = layoutGraph(DEMO_TICKETS, DEMO_EDGES);
  expect(layerOf(layout)).toMatchObject({
    "KIB-5": 0,
    "KIB-13": 0,
    "KIB-11": 0,
    "KIB-12": 1,
    "KIB-16": 1,
    "KIB-21": 1,
    "KIB-15": 2,
    "KIB-22": 2,
  });
  const isolated = layout.nodes.filter((n) => n.isolated).map((n) => n.id);
  expect(isolated).toEqual(["KIB-9", "KIB-14", "KIB-18"]);
  const bottom = Math.max(...layout.nodes.filter((n) => !n.isolated).map((n) => n.y));
  for (const n of layout.nodes.filter((x) => x.isolated)) expect(n.y).toBeGreaterThan(bottom);
});

test("an empty graph has no nodes and no size", () => {
  expect(layoutGraph([], [])).toEqual({ nodes: [], width: 0, height: 0 });
});

test("tickets without blocks edges sit on one row from the top", () => {
  const layout = layoutGraph(todo(3), [{ from: "t0", to: "t1", type: "relates" }, blocks("t2", "t2")]);
  expect(layout.nodes.every((n) => n.isolated && n.y === 0)).toBe(true);
  expect(layout.nodes.map((n) => n.id)).toEqual(["t0", "t1", "t2"]);
});

test("a cycle is laid out once per ticket", () => {
  const layout = layoutGraph(todo(3), [blocks("t0", "t1"), blocks("t1", "t2"), blocks("t2", "t0")]);
  expect(layout.nodes.map((n) => n.id).sort()).toEqual(["t0", "t1", "t2"]);
  expect(new Set(layout.nodes.map((n) => `${n.x},${n.y}`)).size).toBe(3);
});

test("a large graph is laid out in bounded time", () => {
  const n = 2000;
  const edges = Array.from({ length: n - 1 }, (_, i) => blocks(`t${i}`, `t${i + 1}`));
  for (let i = 0; i < n; i += 3) edges.push(blocks(`t${i}`, `t${(i * 7 + 11) % n}`));
  const started = performance.now();
  const layout = layoutGraph(todo(n), edges);
  expect(layout.nodes).toHaveLength(n);
  expect(performance.now() - started).toBeLessThan(3000);
});

const dag = fc
  .integer({ min: 1, max: 14 })
  .chain((n) =>
    fc.tuple(
      fc.constant(n),
      fc.array(fc.tuple(fc.integer({ min: 0, max: n - 1 }), fc.integer({ min: 0, max: n - 1 })), {
        maxLength: 30,
      }),
    ),
  )
  .map(([n, pairs]) => {
    const tickets = todo(n);
    const edges: GraphEdge[] = pairs.filter(([a, b]) => a < b).map(([a, b]) => blocks(`t${a}`, `t${b}`));
    return { tickets, edges };
  });

test("a blocks target is always on a later layer than its source", () => {
  fc.assert(
    fc.property(dag, ({ tickets, edges }) => {
      const layers = layerOf(layoutGraph(tickets, edges));
      return edges.every((e) => (layers[e.to] ?? -1) > (layers[e.from] ?? Number.POSITIVE_INFINITY));
    }),
  );
});

test("the layout is deterministic and positions never overlap", () => {
  fc.assert(
    fc.property(dag, ({ tickets, edges }) => {
      const a = layoutGraph(tickets, edges);
      const b = layoutGraph([...tickets].reverse(), [...edges].reverse());
      const spots = new Set(a.nodes.map((n) => `${n.x},${n.y}`));
      return JSON.stringify(a) === JSON.stringify(b) && spots.size === a.nodes.length;
    }),
  );
});
