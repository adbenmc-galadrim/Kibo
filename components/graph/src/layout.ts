import { blocksDag, sortTickets } from "./blocks-dag";
import type { GraphEdge, GraphTicket } from "./critical-path";

export const NODE_W = 176;
export const NODE_H = 52;
export const GAP_X = 96;
export const GAP_Y = 40;
export const ISOLATED_GAP = 64;
export const ISOLATED_GAP_X = 24;
export const ISOLATED_GAP_Y = 12;

export type NodePosition = {
  id: string;
  layer: number;
  order: number;
  x: number;
  y: number;
  isolated: boolean;
};
export type GraphLayout = {
  nodes: NodePosition[];
  width: number;
  height: number;
  isolatedTop: number | null;
};

export const isolatedColumns = (count: number, connectedLayers: number): number =>
  connectedLayers > 0 ? connectedLayers : Math.max(1, Math.ceil(Math.sqrt(count)));

const PASSES = 4;

const maxOf = (values: number[]): number => values.reduce((a, b) => Math.max(a, b), 0);

function assignLayers(order: string[], succ: Map<string, string[]>): string[][] {
  const height = new Map<string, number>();
  for (let i = order.length - 1; i >= 0; i -= 1) {
    const id = order[i];
    if (id === undefined) continue;
    height.set(id, maxOf((succ.get(id) ?? []).map((s) => 1 + (height.get(s) ?? 0))));
  }
  const top = maxOf([...height.values()]);
  const layers: string[][] = Array.from({ length: order.length > 0 ? top + 1 : 0 }, () => []);
  for (const id of order) layers[top - (height.get(id) ?? 0)]?.push(id);
  return layers;
}

function orderLayers(
  layers: string[][],
  succ: Map<string, string[]>,
  pred: Map<string, string[]>,
  compareIds: (a: string, b: string) => number,
): void {
  const position = new Map<string, number>();
  const index = (layer: string[]) => {
    for (const [i, id] of layer.entries()) position.set(id, i);
  };
  for (const layer of layers) {
    layer.sort(compareIds);
    index(layer);
  }
  const all = layers.map((_, i) => i);
  for (let pass = 0; pass < PASSES; pass += 1) {
    const down = pass % 2 === 0;
    const sequence = down ? all.slice(1) : all.slice(0, -1).reverse();
    for (const li of sequence) {
      const layer = layers[li] ?? [];
      const bary = new Map(
        layer.map((id) => {
          const refs = (down ? pred.get(id) : succ.get(id)) ?? [];
          const values = refs.map((r) => position.get(r) ?? 0);
          const mean =
            values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : (position.get(id) ?? 0);
          return [id, mean];
        }),
      );
      layer.sort((a, b) => (bary.get(a) ?? 0) - (bary.get(b) ?? 0) || compareIds(a, b));
      index(layer);
    }
  }
}

export function layoutGraph(tickets: GraphTicket[], edges: GraphEdge[]): GraphLayout {
  const sorted = sortTickets(tickets);
  const rank = new Map(sorted.map((t, i) => [t.id, i]));
  const compareIds = (a: string, b: string) => (rank.get(a) ?? 0) - (rank.get(b) ?? 0);
  const { order, succ, pred } = blocksDag(sorted, edges);
  const linked = (id: string) => succ.has(id) || pred.has(id);
  const connected = order.filter(linked);
  const isolated = sorted.filter((t) => !linked(t.id)).map((t) => t.id);

  const layers = assignLayers(connected, succ);
  orderLayers(layers, succ, pred, compareIds);

  const nodes: NodePosition[] = [];
  for (const [li, layer] of layers.entries()) {
    for (const [i, id] of layer.entries()) {
      nodes.push({
        id,
        layer: li,
        order: i,
        x: li * (NODE_W + GAP_X),
        y: i * (NODE_H + GAP_Y),
        isolated: false,
      });
    }
  }
  const rows = maxOf(layers.map((l) => l.length));
  const connectedBottom = rows === 0 ? 0 : rows * (NODE_H + GAP_Y) - GAP_Y + ISOLATED_GAP;
  const isolatedTop = isolated.length === 0 ? null : connectedBottom;
  const columns = isolatedColumns(isolated.length, layers.length);
  for (const [i, id] of isolated.entries()) {
    nodes.push({
      id,
      layer: -1,
      order: i,
      x: (i % columns) * (NODE_W + ISOLATED_GAP_X),
      y: connectedBottom + Math.floor(i / columns) * (NODE_H + ISOLATED_GAP_Y),
      isolated: true,
    });
  }
  nodes.sort((a, b) => a.y - b.y || a.x - b.x);
  const width = nodes.length > 0 ? maxOf(nodes.map((n) => n.x + NODE_W)) : 0;
  const height = nodes.length > 0 ? maxOf(nodes.map((n) => n.y + NODE_H)) : 0;
  return { nodes, width, height, isolatedTop };
}
