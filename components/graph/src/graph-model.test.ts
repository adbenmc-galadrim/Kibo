import { expect, test } from "bun:test";
import type { GraphEdge } from "./critical-path";
import { DEMO_EDGES, DEMO_WAVE_TICKETS } from "./demo-graph";
import { buildGraphModel, type GraphOptions, WAVE_HEADER_H } from "./graph-model";
import { layoutGraph } from "./layout";
import { fitAll } from "./viewport";
import type { WaveTicket } from "./waves";

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
const options = (patch: Partial<GraphOptions> = {}): GraphOptions => ({
  mode: "waves",
  showDone: false,
  groupBy: null,
  collapsed: new Set(),
  ...patch,
});

const chain = [ticket("A", { startable: true }), ticket("B"), ticket("C")];
const chainEdges = [blocks("A", "B"), blocks("B", "C"), blocks("A", "C")];

test("waves: one header per column, nodes below the headers, implied links set apart", () => {
  const model = buildGraphModel(chain, chainEdges, options());
  expect(model.headers.map((h) => h.label)).toEqual([
    "Vague 1 · démarrables et en cours",
    "Vague 2",
    "Vague 3",
  ]);
  expect(model.layout.nodes.every((n) => n.y >= WAVE_HEADER_H)).toBe(true);
  expect(model.edges).toEqual([blocks("A", "B"), blocks("B", "C")]);
  expect(model.implied).toEqual([blocks("A", "C")]);
  expect(model.frames).toEqual([]);
});

test("waves with done tickets shown: the done column comes first", () => {
  const tickets = [ticket("D", { statusId: "done" }), ...chain];
  const model = buildGraphModel(tickets, [blocks("D", "A"), ...chainEdges], options({ showDone: true }));
  expect(model.headers[0]?.label).toBe("Terminés");
  expect(model.headers[0]?.x).toBe(0);
});

test("hierarchical keeps the former layout, without headers", () => {
  const model = buildGraphModel(chain, chainEdges, options({ mode: "hierarchical" }));
  expect(model.layout).toEqual(layoutGraph(chain, chainEdges));
  expect(model.headers).toEqual([]);
});

test("grouping frames the members and hides the links inside a frame", () => {
  const tickets = DEMO_WAVE_TICKETS;
  const model = buildGraphModel(tickets, DEMO_EDGES, options({ groupBy: "chapitre" }));
  expect(model.frames.map((f) => f.label).sort()).toEqual(["c1 · 2 tickets", "c2 · 3 tickets"]);
  expect(model.headers).toEqual([]);
  const inside = (e: GraphEdge) =>
    model.frameOf.get(e.from) !== undefined && model.frameOf.get(e.from) === model.frameOf.get(e.to);
  expect([...model.edges, ...model.implied].some(inside)).toBe(false);
  const folded = buildGraphModel(
    tickets,
    DEMO_EDGES,
    options({ groupBy: "chapitre", collapsed: new Set(["c2"]) }),
  );
  expect(folded.groupNodes.get("group:chapitre:c2")?.label).toBe("c2 · 3 tickets");
});

test("large widget: « Tout voir » keeps the demo set at 70 % or more in waves", () => {
  const model = buildGraphModel(DEMO_WAVE_TICKETS, DEMO_EDGES, options());
  const large = { width: 584, height: 520 };
  expect(fitAll(model.layout, large).zoom).toBeGreaterThanOrEqual(0.7);
});
