import type { PrNode, PrStack, PrStacksModel } from "./pr-stacks";

export const NODE_W = 364;
export const NODE_H = 92;
export const GAP_Y = 44;
export const GAP_X = 24;
export const COL_MIN = 388;
export const PAD = 16;
export const RAIL_BOTTOM = 118;
export const HEAD_H = 62;
export const STEM = 26;
export const RAIL_LINE = 4;

export type PlacedPr = { node: PrNode; x: number; y: number; parent: { x: number; y: number } | null };
export type PlacedStack = { stack: PrStack; x: number; width: number; center: number; nodes: PlacedPr[] };
export type PrsLayout = { columns: PlacedStack[]; width: number; height: number; railY: number };

const LEVEL = NODE_H + GAP_Y;

function treeWidth(node: PrNode): number {
  const children = node.children.map(treeWidth);
  const span = children.reduce((s, w) => s + w, 0) + GAP_X * Math.max(0, children.length - 1);
  return Math.max(NODE_W, span);
}

type Place = { left: number; depth: number; parent: { x: number; y: number } | null; rootY: number };

function placeTree(node: PrNode, at: Place, out: PlacedPr[]): void {
  const width = treeWidth(node);
  const x = at.left + Math.round((width - NODE_W) / 2);
  const y = at.rootY - at.depth * LEVEL;
  out.push({ node, x, y, parent: at.parent });
  const widths = node.children.map(treeWidth);
  const span = widths.reduce((s, w) => s + w, 0) + GAP_X * Math.max(0, widths.length - 1);
  let left = at.left + Math.round((width - span) / 2);
  node.children.forEach((child, i) => {
    placeTree(child, { left, depth: at.depth + 1, parent: { x: x + NODE_W / 2, y }, rootY: at.rootY }, out);
    left += (widths[i] ?? 0) + GAP_X;
  });
}

export function layoutStacks(model: PrStacksModel, viewport: { width: number; height: number }): PrsLayout {
  const n = Math.max(1, model.stacks.length);
  const share = Math.max(COL_MIN, Math.floor((viewport.width - 2 * PAD) / n));
  const deepest = Math.max(0, ...model.stacks.map((s) => s.depth));
  const height = Math.max(viewport.height, HEAD_H + deepest * LEVEL + RAIL_BOTTOM + 12);
  const railY = height - RAIL_BOTTOM;
  const rootY = railY - STEM - NODE_H;
  let x = PAD;
  const columns = model.stacks.map((stack) => {
    const tree = treeWidth(stack.root);
    const width = Math.max(share, tree + GAP_X);
    const nodes: PlacedPr[] = [];
    placeTree(stack.root, { left: x + Math.round((width - tree) / 2), depth: 0, parent: null, rootY }, nodes);
    const root = nodes[0];
    const column = { stack, x, width, center: (root?.x ?? x) + NODE_W / 2, nodes };
    x += width;
    return column;
  });
  return { columns, width: Math.max(viewport.width, x + PAD), height, railY };
}
