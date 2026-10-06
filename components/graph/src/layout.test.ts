import { expect, test } from "bun:test";
import { seedDemo } from "@kibo/sdk/fixtures";
import { createMockSdk } from "@kibo/sdk/mock";
import fc from "fast-check";
import type { GraphEdge, GraphTicket } from "./critical-path";
import { DEMO_EDGES, DEMO_TICKETS } from "./demo-graph";
import { graphInput } from "./filter";
import { manifest } from "./index";
import { ISOLATED_GAP_X, ISOLATED_GAP_Y, isolatedColumns, layoutGraph, NODE_H, NODE_W } from "./layout";
import { fitAll } from "./viewport";

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
  expect(layoutGraph([], [])).toEqual({ nodes: [], width: 0, height: 0, isolatedTop: null });
});

test("tickets without blocks edges form a compact grid from the top", () => {
  const l = layoutGraph(todo(3), [{ from: "t0", to: "t1", type: "relates" }]);
  expect(l.isolatedTop).toBe(0);
  expect(l.nodes.map((n) => [n.id, n.x, n.y])).toEqual([
    ["t0", 0, 0],
    ["t1", NODE_W + ISOLATED_GAP_X, 0],
    ["t2", 0, NODE_H + ISOLATED_GAP_Y],
  ]);
  expect(l.nodes.every((n) => n.isolated)).toBe(true);
});

test("the demo project fits the page at 100 % and a large widget above 0.7", async () => {
  const m = createMockSdk(manifest, { seed: seedDemo, surface: "view", format: "full", viewer: "adam" });
  const input = graphInput(
    await m.sdk.list("ticket"),
    await m.sdk.list("link"),
    { assignee: "all", hideDone: false, domain: null },
    "adam",
  );
  const l = layoutGraph(input.tickets, input.edges);
  expect(l.nodes.filter((n) => n.isolated)).toHaveLength(14);
  expect(l.width).toBe(720);
  expect(l.height).toBe(608);
  expect(l.isolatedTop).toBe(300);
  expect(fitAll(l, { width: 1570, height: 800 }).zoom).toBe(1);
  expect(fitAll(l, { width: 566, height: 520 }).zoom).toBeGreaterThanOrEqual(0.7);
});

test("isolatedColumns follows the connected graph, else a square", () => {
  expect(isolatedColumns(14, 3)).toBe(3);
  expect(isolatedColumns(3, 8)).toBe(8);
  expect(isolatedColumns(3, 0)).toBe(2);
  expect(isolatedColumns(200, 0)).toBe(15);
  expect(isolatedColumns(1, 0)).toBe(1);
  expect(isolatedColumns(0, 0)).toBe(1);
});

test("isolated nodes never overlap and never widen a connected graph", () => {
  fc.assert(
    fc.property(fc.integer({ min: 1, max: 60 }), fc.boolean(), (n, linked) => {
      const tickets = todo(n);
      const edges = linked && n > 2 ? [blocks("t0", "t1")] : [];
      const l = layoutGraph(tickets, edges);
      const spots = new Set(l.nodes.map((node) => `${node.x},${node.y}`));
      const connected = l.nodes.filter((node) => !node.isolated);
      const isolated = l.nodes.filter((node) => node.isolated);
      const below = isolated.every((node) => connected.every((c) => node.y > c.y));
      const connectedWidth = Math.max(0, ...connected.map((c) => c.x + NODE_W));
      const isolatedWidth = Math.max(0, ...isolated.map((node) => node.x + NODE_W));
      const narrow = connected.length === 0 || isolated.length === 0 || isolatedWidth <= connectedWidth;
      return (
        spots.size === l.nodes.length &&
        below &&
        narrow &&
        (l.isolatedTop === null) === (isolated.length === 0)
      );
    }),
  );
});

test("the isolated block is at most ⌈√n⌉ wide without blocks edges", () => {
  fc.assert(
    fc.property(fc.integer({ min: 1, max: 200 }), (n) => {
      const l = layoutGraph(todo(n), []);
      const columns = new Set(l.nodes.map((node) => node.x)).size;
      return l.isolatedTop === 0 && columns === Math.ceil(Math.sqrt(n));
    }),
  );
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
