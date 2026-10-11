import { compareKeys } from "./blocks-dag";
import type { GraphEdge } from "./critical-path";
import { fr } from "./fr";
import { collapseGroups, type GroupSpec, groupNodeId, groupTickets } from "./groups";
import { GAP_X, GAP_Y, type GraphLayout, NODE_H, NODE_W, type NodePosition } from "./layout";
import { layoutWaves, type WaveTicket } from "./waves";

export const ROW_H = 28;
export const ROW_GAP = 6;
export const FRAME_PAD = 10;
export const FRAME_HEAD = 36;
const COLUMN_W = NODE_W + GAP_X;
const FRAME_W = NODE_W + 2 * FRAME_PAD;

export type FrameBox = {
  id: string;
  value: string;
  label: string;
  count: number;
  x: number;
  y: number;
  width: number;
  height: number;
};
export type GroupNodeInfo = { value: string; label: string };
export type FramedLayout = {
  layout: GraphLayout;
  frames: FrameBox[];
  rows: Set<string>;
  frameOf: Map<string, string>;
  edges: GraphEdge[];
  groupNodes: Map<string, GroupNodeInfo>;
};

type Item = { id: string; rank: number; members: string[] | null; value: string };

const compareItems = (a: Item, b: Item) => a.rank - b.rank || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

const frameHeight = (members: number) => FRAME_HEAD + members * (ROW_H + ROW_GAP) - ROW_GAP + FRAME_PAD;

function columnItems(
  tickets: readonly WaveTicket[],
  base: GraphLayout,
  spec: GroupSpec,
): Map<number, Item[]> {
  const at = new Map(base.nodes.map((n) => [n.id, n]));
  const keyOf = new Map(tickets.map((t) => [t.id, t.key]));
  const items = new Map<number, Item[]>();
  const add = (column: number, item: Item) => items.set(column, [...(items.get(column) ?? []), item]);
  const { groups, ungrouped } = groupTickets(tickets, spec);
  for (const id of ungrouped) {
    const n = at.get(id);
    if (n) add(n.layer, { id, rank: n.order, members: null, value: "" });
  }
  for (const [value, ids] of groups) {
    const placed = ids.flatMap((id) => at.get(id) ?? []);
    if (placed.length === 0) continue;
    const column = Math.min(...placed.map((n) => n.layer));
    const members = [...placed]
      .sort((a, b) => a.layer - b.layer || compareKeys(keyOf.get(a.id) ?? null, keyOf.get(b.id) ?? null))
      .map((n) => n.id);
    const rank = Math.min(...placed.filter((n) => n.layer === column).map((n) => n.order));
    add(column, { id: groupNodeId(spec.prefix, value), rank, members, value });
  }
  return items;
}

function collapsedNodes(tickets: readonly WaveTicket[], spec: GroupSpec): Map<string, GroupNodeInfo> {
  const nodes = new Map<string, GroupNodeInfo>();
  const { nodeLabels } = collapseGroups(tickets, [], spec);
  for (const value of groupTickets(tickets, spec).groups.keys()) {
    const id = groupNodeId(spec.prefix, value);
    const label = nodeLabels.get(id);
    if (label !== undefined) nodes.set(id, { value, label });
  }
  return nodes;
}

export function layoutFramed(
  tickets: readonly WaveTicket[],
  edges: readonly GraphEdge[],
  spec: GroupSpec,
): FramedLayout {
  const collapsed = collapseGroups(tickets, edges, spec);
  const base = layoutWaves(collapsed.tickets, collapsed.edges, { showDone: true });
  const items = columnItems(collapsed.tickets, base, spec);
  const nodes: NodePosition[] = [];
  const frames: FrameBox[] = [];
  const rows = new Set<string>();
  const frameOf = new Map<string, string>();
  for (const [layer, column] of [...items.keys()].sort((a, b) => a - b).entries()) {
    const x = FRAME_PAD + layer * COLUMN_W;
    let y = 0;
    let order = 0;
    for (const item of (items.get(column) ?? []).sort(compareItems)) {
      if (item.members === null) {
        nodes.push({ id: item.id, layer, order: order++, x, y, isolated: false });
        y += NODE_H + GAP_Y;
        continue;
      }
      const height = frameHeight(item.members.length);
      const count = item.members.length;
      const label = fr.groupLabel(item.value, count);
      frames.push({
        id: item.id,
        value: item.value,
        label,
        count,
        x: x - FRAME_PAD,
        y,
        width: FRAME_W,
        height,
      });
      for (const [i, id] of item.members.entries()) {
        nodes.push({
          id,
          layer,
          order: order++,
          x,
          y: y + FRAME_HEAD + i * (ROW_H + ROW_GAP),
          isolated: false,
        });
        rows.add(id);
        frameOf.set(id, item.id);
      }
      y += height + GAP_Y;
    }
  }
  nodes.sort((a, b) => a.y - b.y || a.x - b.x);
  const bottom = (n: NodePosition) => n.y + (rows.has(n.id) ? ROW_H : NODE_H);
  return {
    layout: {
      nodes,
      width: nodes.length === 0 ? 0 : Math.max(...nodes.map((n) => n.x + NODE_W)) + FRAME_PAD,
      height: Math.max(0, ...nodes.map(bottom), ...frames.map((f) => f.y + f.height)),
      isolatedTop: null,
    },
    frames,
    rows,
    frameOf,
    edges: collapsed.edges,
    groupNodes: collapsedNodes(tickets, spec),
  };
}
