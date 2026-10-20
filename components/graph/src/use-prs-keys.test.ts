import { expect, test } from "bun:test";
import type { PrNode, PrStacksModel } from "./pr-stacks";
import { layoutStacks } from "./prs-layout";
import { nextPr } from "./use-prs-keys";

const node = (number: number, children: PrNode[] = []): PrNode => ({
  id: `pr-${number}`,
  number,
  ticketId: `t${number}`,
  key: `SILO-${number}`,
  title: `Ticket ${number}`,
  feature: null,
  review: "waiting",
  checks: null,
  head: null,
  base: "dev",
  late: false,
  session: false,
  children,
});

const stack = (root: PrNode) => ({
  root,
  size: 1,
  depth: 1,
  numbers: { min: root.number, max: root.number },
  feature: null,
  onRail: true,
});

const roots = [node(10, [node(11, [node(13)]), node(12)]), node(20), node(30)];
const model: PrStacksModel = {
  stacks: roots.map(stack),
  rail: "dev",
  counts: { open: 6, stacks: 3, waiting: 6, changes: 0 },
};
const layout = layoutStacks(model, { width: 1199, height: 904 });
const go = (id: number, key: string) => nextPr(layout, `pr-${id}`, key);

test("up climbs to the first child, down goes back to the parent", () => {
  expect(go(10, "ArrowUp")).toBe("pr-11");
  expect(go(11, "ArrowUp")).toBe("pr-13");
  expect(go(13, "ArrowUp")).toBeNull();
  expect(go(12, "ArrowDown")).toBe("pr-10");
  expect(go(10, "ArrowDown")).toBeNull();
});

test("left and right jump to the root of the next stack, from any level", () => {
  expect(go(13, "ArrowRight")).toBe("pr-20");
  expect(go(20, "ArrowRight")).toBe("pr-30");
  expect(go(30, "ArrowRight")).toBeNull();
  expect(go(30, "ArrowLeft")).toBe("pr-20");
  expect(go(20, "ArrowLeft")).toBe("pr-10");
  expect(go(10, "ArrowLeft")).toBeNull();
});

test("other keys and unknown cards move nothing", () => {
  expect(go(10, "Enter")).toBeNull();
  expect(nextPr(layout, "nope", "ArrowUp")).toBeNull();
});
