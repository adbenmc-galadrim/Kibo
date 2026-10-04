import { expect, test } from "bun:test";
import type { GraphEdge } from "./critical-path";
import type { GraphLayout } from "./layout";
import { neighborOf, nodesInRect } from "./neighbors";

const layout: GraphLayout = {
  width: 800,
  height: 300,
  nodes: [
    { id: "a", layer: 0, order: 0, x: 0, y: 0, isolated: false },
    { id: "b", layer: 1, order: 0, x: 272, y: 0, isolated: false },
    { id: "c", layer: 1, order: 1, x: 272, y: 92, isolated: false },
    { id: "d", layer: 2, order: 0, x: 544, y: 0, isolated: false },
  ],
};
const edges: GraphEdge[] = [
  { from: "a", to: "b", type: "blocks" },
  { from: "a", to: "c", type: "blocks" },
  { from: "b", to: "d", type: "blocks" },
  { from: "c", to: "d", type: "relates" },
];

test("right follows the first blocks successor, left the first predecessor, up and down move inside the layer", () => {
  expect(neighborOf(layout, edges, "a", "ArrowRight")).toBe("b");
  expect(neighborOf(layout, edges, "b", "ArrowRight")).toBe("d");
  expect(neighborOf(layout, edges, "c", "ArrowRight")).toBeNull();
  expect(neighborOf(layout, edges, "d", "ArrowLeft")).toBe("b");
  expect(neighborOf(layout, edges, "b", "ArrowDown")).toBe("c");
  expect(neighborOf(layout, edges, "c", "ArrowUp")).toBe("b");
  expect(neighborOf(layout, edges, "a", "ArrowUp")).toBeNull();
  expect(neighborOf(layout, edges, "zz", "ArrowRight")).toBeNull();
});

test("nodesInRect keeps the nodes whose box intersects the rectangle", () => {
  expect(nodesInRect(layout, { left: 0, top: 0, right: 300, bottom: 60 })).toEqual(["a", "b"]);
  expect(nodesInRect(layout, { left: 260, top: 80, right: 500, bottom: 200 })).toEqual(["c"]);
  expect(nodesInRect(layout, { left: 900, top: 0, right: 950, bottom: 10 })).toEqual([]);
});
