import { expect, test } from "bun:test";
import type { GraphEdge } from "./critical-path";
import { FRAME_HEAD, FRAME_PAD, layoutFramed, ROW_GAP, ROW_H } from "./group-layout";
import { GAP_X, NODE_W } from "./layout";
import type { WaveTicket } from "./waves";

const ticket = (id: string, labels: string[] = [], patch: Partial<WaveTicket> = {}): WaveTicket => ({
  id,
  key: id,
  statusId: "todo",
  startable: false,
  live: false,
  labels,
  ...patch,
});
const blocks = (from: string, to: string): GraphEdge => ({ from, to, type: "blocks" });

const tickets = [
  ticket("K-1", ["chapitre:c1"], { startable: true }),
  ticket("K-2", ["chapitre:c2"]),
  ticket("K-3", ["chapitre:c2"]),
  ticket("K-4"),
];
const edges = [blocks("K-1", "K-2"), blocks("K-2", "K-3"), blocks("K-3", "K-4")];
const spec = (collapsed: string[] = []) => ({ prefix: "chapitre", collapsed: new Set(collapsed) });

test("an expanded group is a framed block in the column of its leftmost member, members stacked", () => {
  const framed = layoutFramed(tickets, edges, spec());
  const c2 = framed.frames.find((f) => f.value === "c2");
  expect(c2).toMatchObject({ id: "group:chapitre:c2", label: "c2 · 2 tickets", count: 2 });
  const at = new Map(framed.layout.nodes.map((n) => [n.id, n]));
  const x = FRAME_PAD + (NODE_W + GAP_X);
  expect(at.get("K-2")).toMatchObject({ x, y: FRAME_HEAD });
  expect(at.get("K-3")).toMatchObject({ x, y: FRAME_HEAD + ROW_H + ROW_GAP });
  expect(c2).toMatchObject({ x: x - FRAME_PAD, y: 0, width: NODE_W + 2 * FRAME_PAD });
  expect(framed.rows).toEqual(new Set(["K-1", "K-2", "K-3"]));
  expect(framed.frameOf.get("K-3")).toBe("group:chapitre:c2");
  expect(at.get("K-4")?.x).toBeGreaterThan(x);
  expect(framed.layout.width).toBeGreaterThanOrEqual((at.get("K-4")?.x ?? 0) + NODE_W);
});

test("a collapsed group becomes one node that carries its members' links", () => {
  const framed = layoutFramed(tickets, edges, spec(["c2"]));
  const ids = framed.layout.nodes.map((n) => n.id).sort();
  expect(ids).toEqual(["K-1", "K-4", "group:chapitre:c2"]);
  expect(framed.groupNodes.get("group:chapitre:c2")).toEqual({
    value: "c2",
    name: "c2",
    label: "c2 · 2 tickets",
  });
  expect(framed.edges).toEqual([blocks("K-1", "group:chapitre:c2"), blocks("group:chapitre:c2", "K-4")]);
  expect(framed.frames.map((f) => f.value)).toEqual(["c1"]);
  expect(framed.rows.has("group:chapitre:c2")).toBe(false);
});

test("the same input always gives the same framed layout", () => {
  const a = layoutFramed(tickets, edges, spec());
  const b = layoutFramed([...tickets].reverse(), [...edges].reverse(), spec());
  expect(b.layout).toEqual(a.layout);
  expect(b.frames).toEqual(a.frames);
});
