import type { GraphEdge } from "./critical-path";
import { fr } from "./fr";
import { type FrameBox, type GroupNodeInfo, layoutFramed } from "./group-layout";
import { GAP_X, type GraphLayout, layoutGraph, NODE_W } from "./layout";
import { reduceTransitive } from "./transitive";
import { layoutWaves, WAVE_COLUMN_DONE, type WaveTicket } from "./waves";

export const WAVE_HEADER_H = 28;
export const SEMANTIC_ZOOM = 0.6;

export type GraphMode = "waves" | "hierarchical";
export type GraphOptions = {
  mode: GraphMode;
  showDone: boolean;
  groupBy: string | null;
  collapsed: ReadonlySet<string>;
};
export type ColumnHeader = { x: number; label: string };
export type GraphModel = {
  layout: GraphLayout;
  edges: GraphEdge[];
  implied: GraphEdge[];
  headers: ColumnHeader[];
  frames: FrameBox[];
  rows: ReadonlySet<string>;
  frameOf: ReadonlyMap<string, string>;
  groupNodes: ReadonlyMap<string, GroupNodeInfo>;
};

const NONE: ReadonlySet<string> = new Set();
const NO_FRAME: ReadonlyMap<string, string> = new Map();
const NO_GROUP: ReadonlyMap<string, GroupNodeInfo> = new Map();

function plain(layout: GraphLayout, edges: readonly GraphEdge[], headers: ColumnHeader[]): GraphModel {
  const { kept, implied } = reduceTransitive(edges);
  return {
    layout,
    edges: kept,
    implied,
    headers,
    frames: [],
    rows: NONE,
    frameOf: NO_FRAME,
    groupNodes: NO_GROUP,
  };
}

function withHeaders(layout: GraphLayout): { layout: GraphLayout; headers: ColumnHeader[] } {
  const layers = [...new Set(layout.nodes.map((n) => n.layer))].sort((a, b) => a - b);
  const first = layers[0] ?? 0;
  const headers = layers.map((layer) => ({
    x: (layer - first) * (NODE_W + GAP_X),
    label: layer === WAVE_COLUMN_DONE ? fr.doneColumn : fr.wave(layer),
  }));
  return {
    headers,
    layout: {
      ...layout,
      nodes: layout.nodes.map((n) => ({ ...n, y: n.y + WAVE_HEADER_H })),
      height: layout.nodes.length === 0 ? 0 : layout.height + WAVE_HEADER_H,
    },
  };
}

function framed(tickets: readonly WaveTicket[], edges: readonly GraphEdge[], opts: GraphOptions): GraphModel {
  const out = layoutFramed(tickets, edges, { prefix: opts.groupBy ?? "", collapsed: opts.collapsed });
  const outside = (e: GraphEdge) => {
    const frame = out.frameOf.get(e.from);
    return frame === undefined || frame !== out.frameOf.get(e.to);
  };
  const { kept, implied } = reduceTransitive(out.edges);
  return {
    layout: out.layout,
    edges: kept.filter(outside),
    implied: implied.filter(outside),
    headers: [],
    frames: out.frames,
    rows: out.rows,
    frameOf: out.frameOf,
    groupNodes: out.groupNodes,
  };
}

export function buildGraphModel(
  tickets: readonly WaveTicket[],
  edges: readonly GraphEdge[],
  opts: GraphOptions,
): GraphModel {
  const shown = opts.showDone ? [...tickets] : tickets.filter((t) => t.statusId !== "done");
  const ids = new Set(shown.map((t) => t.id));
  const links = edges.filter((e) => ids.has(e.from) && ids.has(e.to));
  if (opts.mode === "hierarchical") return plain(layoutGraph(shown, links), links, []);
  if (opts.groupBy !== null) return framed(shown, links, opts);
  const waves = withHeaders(layoutWaves(shown, links, { showDone: opts.showDone }));
  return plain(waves.layout, links, waves.headers);
}
