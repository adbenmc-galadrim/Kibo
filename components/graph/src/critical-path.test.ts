import { expect, test } from "bun:test";
import { compareKeys, criticalPath, type GraphEdge, type GraphTicket } from "./critical-path";
import { DEMO_EDGES, DEMO_TICKETS } from "./demo-graph";

const todo = (n: number): GraphTicket[] =>
  Array.from({ length: n }, (_, i) => ({ id: `t${i}`, key: `KIB-${i + 1}`, statusId: "todo" }));
const blocks = (from: string, to: string): GraphEdge => ({ from, to, type: "blocks" });

test("the critical path of the demo data is KIB-11 → KIB-21 → KIB-22", () => {
  expect(criticalPath(DEMO_TICKETS, DEMO_EDGES)).toEqual(["KIB-11", "KIB-21", "KIB-22"]);
});

test("done tickets are left out and ties go to the smallest keys", () => {
  const tickets = DEMO_TICKETS.map((x) => (x.key === "KIB-11" ? { ...x, statusId: "done" as const } : x));
  expect(criticalPath(tickets, DEMO_EDGES)).toEqual(["KIB-12", "KIB-15"]);
  expect(compareKeys("KIB-5", "KIB-11")).toBeLessThan(0);
});

test("keys compare by prefix then by number", () => {
  expect(compareKeys("ABC-2", "KIB-1")).toBeLessThan(0);
  expect(compareKeys("KIB-7", "KIB-7")).toBe(0);
  expect(compareKeys("KIB-30", "KIB-4")).toBeGreaterThan(0);
});

test("no chain means no critical path", () => {
  expect(criticalPath(DEMO_TICKETS, [])).toEqual([]);
  expect(criticalPath([], [])).toEqual([]);
  expect(criticalPath(todo(1), [blocks("t0", "t0")])).toEqual([]);
});

test("edges to unknown tickets are ignored", () => {
  expect(criticalPath(todo(2), [blocks("t0", "ghost"), blocks("ghost", "t1")])).toEqual([]);
});

test("a cycle terminates and yields a simple chain", () => {
  const path = criticalPath(todo(3), [blocks("t0", "t1"), blocks("t1", "t2"), blocks("t2", "t0")]);
  expect(path).toEqual(["t0", "t1", "t2"]);
});

test("a long chain is handled quickly", () => {
  const n = 3000;
  const edges = Array.from({ length: n - 1 }, (_, i) => blocks(`t${i}`, `t${i + 1}`));
  const started = performance.now();
  const path = criticalPath(todo(n), edges);
  expect(path).toHaveLength(n);
  expect(performance.now() - started).toBeLessThan(1000);
});

test("a dense graph with cycles stays bounded", () => {
  const n = 200;
  const edges: GraphEdge[] = [];
  for (let a = 0; a < n; a += 1)
    for (let b = 0; b < n; b += 7) if (a !== b) edges.push(blocks(`t${a}`, `t${(a + b) % n}`));
  const started = performance.now();
  const path = criticalPath(todo(n), edges);
  expect(new Set(path).size).toBe(path.length);
  expect(performance.now() - started).toBeLessThan(2000);
});
