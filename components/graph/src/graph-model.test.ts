import { expect, test } from "bun:test";
import type { GraphEdge } from "./critical-path";
import { DEMO_EDGES, DEMO_WAVE_TICKETS } from "./demo-graph";
import { type EnsembleIndex, NO_ENSEMBLES } from "./ensembles";
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
  ensembles: NO_ENSEMBLES,
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

const group: EnsembleIndex = {
  groupOf: new Map([
    ["A", "G"],
    ["B", "G"],
  ]),
  info: new Map([["G", { name: "G", label: "G · Lot · 0/2", compact: "G · 0/2" }]]),
};
const grouped = [ticket("G"), ticket("A", { labels: ["chapitre:c1"] }), ticket("B"), ticket("X")];
const fromGroup = [blocks("G", "X")];

test("by default a group is a frame around its sub-tickets, its links attached to the frame", () => {
  const model = buildGraphModel(grouped, fromGroup, options({ ensembles: group }));
  expect(model.frames).toMatchObject([
    { id: "group:ensemble:G", name: "G", label: "G · Lot · 0/2", count: 2 },
  ]);
  expect(model.layout.nodes.map((n) => n.id).sort()).toEqual(["A", "B", "X"]);
  expect(model.anchors.map((a) => a.id)).toEqual(["group:ensemble:G"]);
  expect(model.edges).toEqual([blocks("group:ensemble:G", "X")]);
  const x = (id: string) => model.layout.nodes.find((n) => n.id === id)?.x ?? 0;
  expect(x("X")).toBeGreaterThan(x("A"));
  expect(model.blocks.size).toBe(0);
});

test("a folded group is a compact block that keeps its links", () => {
  const model = buildGraphModel(grouped, fromGroup, options({ ensembles: group, collapsed: new Set(["G"]) }));
  expect(model.groupNodes.get("group:ensemble:G")).toEqual({ value: "G", name: "G", label: "G · 0/2" });
  expect(model.edges).toEqual([blocks("group:ensemble:G", "X")]);
});

test("grouping by label wins: the group stays a compact block inside the frames", () => {
  const model = buildGraphModel(grouped, fromGroup, options({ ensembles: group, groupBy: "chapitre" }));
  expect(model.frames.map((f) => f.label)).toEqual(["c1 · 1 ticket"]);
  expect(model.blocks.get("G")).toBe("G · 0/2");
  const hierarchical = buildGraphModel(
    grouped,
    fromGroup,
    options({ ensembles: group, mode: "hierarchical" }),
  );
  expect(hierarchical.blocks.get("G")).toBe("G · 0/2");
});
