import type { GraphEdge } from "./critical-path";
import { ENSEMBLE_PREFIX, type EnsembleIndex, ensembleEdges, layeringEdges } from "./ensembles";
import { fr } from "./fr";
import { type Anchor, type FrameBox, type GroupNodeInfo, layoutFramed } from "./group-layout";
import type { GroupSpec } from "./groups";
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
  ensembles: EnsembleIndex;
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
  anchors: readonly Anchor[];
  blocks: ReadonlyMap<string, string>;
};

const NONE: ReadonlySet<string> = new Set();
const NO_FRAME: ReadonlyMap<string, string> = new Map();
const NO_GROUP: ReadonlyMap<string, GroupNodeInfo> = new Map();
const NO_BLOCK: ReadonlyMap<string, string> = new Map();

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
    anchors: [],
    blocks: NO_BLOCK,
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

function framed(
  tickets: readonly WaveTicket[],
  edges: readonly GraphEdge[],
  spec: GroupSpec,
  layering: readonly GraphEdge[] = edges,
): GraphModel {
  const out = layoutFramed(tickets, edges, spec, layering);
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
    anchors: out.anchors,
    blocks: NO_BLOCK,
  };
}

function framedEnsembles(
  tickets: readonly WaveTicket[],
  edges: readonly GraphEdge[],
  opts: GraphOptions,
): GraphModel {
  const index = opts.ensembles;
  const shown = tickets.filter((t) => !index.info.has(t.id));
  const spec = { prefix: ENSEMBLE_PREFIX, collapsed: opts.collapsed, ensembles: index };
  return framed(shown, ensembleEdges(edges, index), spec, layeringEdges(edges, index));
}

const blocksOf = (tickets: readonly WaveTicket[], index: EnsembleIndex): ReadonlyMap<string, string> =>
  new Map(
    tickets.flatMap((t) => {
      const compact = index.info.get(t.id)?.compact;
      return compact === undefined ? [] : [[t.id, compact] as const];
    }),
  );

export function buildGraphModel(
  tickets: readonly WaveTicket[],
  edges: readonly GraphEdge[],
  opts: GraphOptions,
): GraphModel {
  const shown = opts.showDone ? [...tickets] : tickets.filter((t) => t.statusId !== "done");
  const ids = new Set(shown.map((t) => t.id));
  const links = edges.filter((e) => ids.has(e.from) && ids.has(e.to));
  const blocks = blocksOf(shown, opts.ensembles);
  if (opts.mode === "hierarchical") return { ...plain(layoutGraph(shown, links), links, []), blocks };
  if (opts.groupBy !== null)
    return { ...framed(shown, links, { prefix: opts.groupBy, collapsed: opts.collapsed }), blocks };
  if (blocks.size > 0) return framedEnsembles(shown, links, opts);
  const waves = withHeaders(layoutWaves(shown, links, { showDone: opts.showDone }));
  return plain(waves.layout, links, waves.headers);
}
