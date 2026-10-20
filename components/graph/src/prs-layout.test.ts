import { expect, test } from "bun:test";
import type { PrNode, PrStack, PrStacksModel } from "./pr-stacks";
import { GAP_X, layoutStacks, NODE_H, NODE_W, PAD, RAIL_BOTTOM, STEM } from "./prs-layout";

const node = (number: number, children: PrNode[] = []): PrNode => ({
  id: `pr-${number}`,
  number,
  ticketId: `t${number}`,
  key: `SILO-${number}`,
  title: `Ticket ${number}`,
  feature: null,
  review: "waiting",
  checks: null,
  head: `feat/${number}`,
  base: "dev",
  late: false,
  session: false,
  children,
});

const count = (n: PrNode): number => 1 + n.children.reduce((s, c) => s + count(c), 0);
const depth = (n: PrNode): number => 1 + Math.max(0, ...n.children.map(depth));

const stack = (root: PrNode): PrStack => ({
  root,
  size: count(root),
  depth: depth(root),
  numbers: { min: root.number, max: root.number },
  feature: null,
  onRail: true,
});

const model = (roots: PrNode[]): PrStacksModel => ({
  stacks: roots.map(stack),
  rail: "dev",
  counts: { open: roots.reduce((s, r) => s + count(r), 0), stacks: roots.length, waiting: 0, changes: 0 },
});

const chain = (numbers: number[]): PrNode =>
  numbers.reduceRight<PrNode | null>((child, n) => node(n, child === null ? [] : [child]), null) ?? node(0);

const P5C = { width: 1199, height: 904 };

test("a chain of three stands on the rail, each PR 136 px above the one it is based on", () => {
  const layout = layoutStacks(model([chain([22, 24, 25])]), P5C);
  expect(layout.railY).toBe(904 - RAIL_BOTTOM);
  const [column] = layout.columns;
  const nodes = column?.nodes ?? [];
  expect(nodes.map((p) => p.node.number)).toEqual([22, 24, 25]);
  expect(nodes.map((p) => p.y)).toEqual([668, 532, 396]);
  expect(nodes[0]?.y).toBe(layout.railY - STEM - NODE_H);
  expect(new Set(nodes.map((p) => p.x + NODE_W / 2))).toEqual(new Set([column?.center ?? -1]));
  expect(nodes[0]?.parent).toBeNull();
  expect(nodes[1]?.parent).toEqual({ x: column?.center ?? 0, y: 668 });
});

test("a parent with two children is centered under a 752 px wide tree", () => {
  const layout = layoutStacks(model([node(10, [node(11), node(12)])]), P5C);
  const nodes = layout.columns[0]?.nodes ?? [];
  const [parent, left, right] = nodes;
  expect(nodes.map((p) => p.node.number)).toEqual([10, 11, 12]);
  expect((right?.x ?? 0) + NODE_W - (left?.x ?? 0)).toBe(752);
  expect((right?.x ?? 0) - (left?.x ?? 0)).toBe(NODE_W + GAP_X);
  expect((parent?.x ?? 0) + NODE_W / 2).toBe(((left?.x ?? 0) + (right?.x ?? 0) + NODE_W) / 2);
  expect(left?.y).toBe(right?.y ?? 0);
  expect(left?.parent).toEqual({ x: (parent?.x ?? 0) + NODE_W / 2, y: parent?.y ?? 0 });
});

test("three stacks on 1 199 px share 389 px columns, as on P5c", () => {
  const layout = layoutStacks(model([chain([22, 24, 25]), node(20), node(23)]), P5C);
  expect(layout.columns.map((c) => c.width)).toEqual([389, 389, 389]);
  expect(layout.columns.map((c) => c.x)).toEqual([16, 405, 794]);
  expect(layout.columns.map((c) => c.nodes[0]?.x)).toEqual([29, 418, 807]);
  expect(layout.columns.map((c) => c.center)).toEqual([211, 600, 989]);
  expect(layout.width).toBe(1199);
  expect(layout.height).toBe(904);
});

test("five stacks on 1 199 px keep 388 px columns and scroll sideways", () => {
  const layout = layoutStacks(model([1, 2, 3, 4, 5].map((n) => node(n))), P5C);
  expect(layout.columns.map((c) => c.width)).toEqual([388, 388, 388, 388, 388]);
  expect(layout.width).toBe(2 * PAD + 5 * 388);
  expect(layout.width).toBe(1972);
});

test("a stack of seven is taller than 908 px and scrolls, the rail 118 px above the bottom", () => {
  const layout = layoutStacks(model([chain([1, 2, 3, 4, 5, 6, 7])]), { width: 1199, height: 908 });
  expect(layout.height).toBeGreaterThan(908);
  expect(layout.railY).toBe(layout.height - RAIL_BOTTOM);
  const top = layout.columns[0]?.nodes.at(-1);
  expect(top?.y ?? 0).toBeGreaterThanOrEqual(62);
});

test("a tree wider than its share widens its column", () => {
  const layout = layoutStacks(model([node(10, [node(11), node(12)]), node(20)]), P5C);
  expect(layout.columns.map((c) => c.width)).toEqual([776, 583]);
  expect(layout.columns[1]?.x).toBe(16 + 776);
});
