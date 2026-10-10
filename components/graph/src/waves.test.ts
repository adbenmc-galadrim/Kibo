import { expect, test } from "bun:test";
import type { StatusId } from "@kibo/schema";
import fc from "fast-check";
import type { GraphEdge } from "./critical-path";
import { GAP_X, GAP_Y, NODE_H, NODE_W } from "./layout";
import { layoutWaves, WAVE_COLUMN_DONE, type WaveTicket } from "./waves";

const ticket = (id: string, patch: Partial<WaveTicket> = {}): WaveTicket => ({
  id,
  key: id,
  statusId: "todo",
  startable: false,
  live: false,
  labels: [],
  ...patch,
});
const blocks = (from: string, to: string): GraphEdge => ({ from, to, type: "blocks" });
const columns = (tickets: WaveTicket[], edges: GraphEdge[], showDone = false) =>
  Object.fromEntries(layoutWaves(tickets, edges, { showDone }).nodes.map((n) => [n.id, n.layer]));

const chain = (statusA: StatusId = "todo") => [
  ticket("K-1", { statusId: statusA, startable: statusA === "todo" }),
  ticket("K-2"),
  ticket("K-3"),
];
const chainEdges = [blocks("K-1", "K-2"), blocks("K-2", "K-3")];

test("a chain spreads over successive waves from the startable ticket", () => {
  expect(columns(chain(), chainEdges)).toEqual({ "K-1": 1, "K-2": 2, "K-3": 3 });
});

test("a hidden done blocker is closed and the shown one sits in the done column", () => {
  expect(columns(chain("done"), chainEdges)).toEqual({ "K-2": 1, "K-3": 2 });
  expect(columns(chain("done"), chainEdges, true)).toEqual({ "K-1": WAVE_COLUMN_DONE, "K-2": 1, "K-3": 2 });
});

test("active, live and question-blocked tickets without blockers open the first wave", () => {
  const tickets = [
    ticket("K-1", { statusId: "in_progress" }),
    ticket("K-2", { live: true }),
    ticket("K-3"),
    ticket("K-4", { statusId: "blocked" }),
  ];
  expect(columns(tickets, [])).toEqual({ "K-1": 1, "K-2": 1, "K-3": 1, "K-4": 1 });
});

test("positions follow columns and ranks, ordered by blocker barycenter then key", () => {
  const tickets = [
    ticket("K-1", { startable: true }),
    ticket("K-2", { startable: true }),
    ticket("K-3"),
    ticket("K-4"),
    ticket("K-5"),
  ];
  const edges = [blocks("K-2", "K-3"), blocks("K-1", "K-4"), blocks("K-2", "K-5")];
  const l = layoutWaves(tickets, edges, { showDone: false });
  const at = Object.fromEntries(l.nodes.map((n) => [n.id, [n.layer, n.order, n.x, n.y]]));
  const step = (c: number, r: number) => [c * (NODE_W + GAP_X), r * (NODE_H + GAP_Y)];
  expect(at["K-1"]).toEqual([1, 0, ...step(0, 0)]);
  expect(at["K-2"]).toEqual([1, 1, ...step(0, 1)]);
  expect(at["K-4"]).toEqual([2, 0, ...step(1, 0)]);
  expect(at["K-3"]).toEqual([2, 1, ...step(1, 1)]);
  expect(at["K-5"]).toEqual([2, 2, ...step(1, 2)]);
  expect(l.width).toBe(2 * NODE_W + GAP_X);
  expect(l.height).toBe(3 * NODE_H + 2 * GAP_Y);
  expect(l.columns).toBe(2);
  expect(l.isolatedTop).toBeNull();
  expect(l.nodes.every((n) => !n.isolated)).toBe(true);
});

test("shown done tickets take the first slot on the left", () => {
  const l = layoutWaves(chain("done"), chainEdges, { showDone: true });
  expect(l.nodes.find((n) => n.id === "K-1")?.x).toBe(0);
  expect(l.nodes.find((n) => n.id === "K-2")?.x).toBe(NODE_W + GAP_X);
  expect(l.columns).toBe(3);
});

test("an empty project has an empty layout", () => {
  expect(layoutWaves([], [], { showDone: false })).toEqual({
    nodes: [],
    width: 0,
    height: 0,
    isolatedTop: null,
    columns: 0,
  });
});

const statuses: StatusId[] = ["backlog", "todo", "done"];
const graphArb = fc
  .integer({ min: 1, max: 12 })
  .chain((n) =>
    fc.record({
      tickets: fc.tuple(
        ...Array.from({ length: n }, (_, i) =>
          fc.constantFrom(...statuses).map((statusId) => ticket(`K-${i + 1}`, { statusId })),
        ),
      ),
      pairs: fc.array(fc.tuple(fc.nat(n - 1), fc.nat(n - 1)), { maxLength: 30 }),
      showDone: fc.boolean(),
    }),
  )
  .map(({ tickets, pairs, showDone }) => ({
    tickets,
    showDone,
    edges: pairs.filter(([a, b]) => a < b).map(([a, b]) => blocks(`K-${a + 1}`, `K-${b + 1}`)),
  }));

const shuffle = <T>(items: readonly T[], seed: number): T[] =>
  items
    .map((item, i) => ({ item, k: (i * 7919 + seed * 104729) % 1000003 }))
    .sort((a, b) => a.k - b.k)
    .map((x) => x.item);

test("the layout ignores input order, never stacks two nodes and blocks always go right", () => {
  fc.assert(
    fc.property(graphArb, fc.nat(1000), ({ tickets, edges, showDone }, seed) => {
      const l = layoutWaves(tickets, edges, { showDone });
      expect(layoutWaves(shuffle(tickets, seed), shuffle(edges, seed + 1), { showDone })).toEqual(l);
      expect(new Set(l.nodes.map((n) => `${n.x},${n.y}`)).size).toBe(l.nodes.length);
      const column = new Map(l.nodes.map((n) => [n.id, n.layer]));
      const status = new Map(tickets.map((t) => [t.id, t.statusId]));
      for (const e of edges) {
        const from = column.get(e.from);
        const to = column.get(e.to);
        if (from === undefined || to === undefined || status.get(e.to) === "done") continue;
        expect(to).toBeGreaterThan(from);
      }
    }),
  );
});
