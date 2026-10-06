import { expect, test } from "bun:test";
import { agentsFixture } from "./fixtures";
import { queueNeighbours } from "./queue-runs";

const queue = agentsFixture().queue;

test("queueNeighbours gives the previous and next entries of the visible queue", () => {
  expect(queueNeighbours(queue, "q18")).toEqual({ prev: queue[0] ?? null, next: queue[2] ?? null });
  expect(queueNeighbours(queue, "q10")).toEqual({ prev: null, next: queue[1] ?? null });
  expect(queueNeighbours(queue, "q60")).toEqual({ prev: queue[2] ?? null, next: null });
});

test("under a filter the neighbours are the visible ones, not the global ones", () => {
  const visible = queue.filter((q) => q.runId !== "q29");
  expect(queueNeighbours(visible, "q18")).toEqual({ prev: queue[0] ?? null, next: queue[3] ?? null });
  expect(queueNeighbours(visible, "q29")).toEqual({ prev: null, next: null });
});

test("neighbours follow positions, not the order of the list", () => {
  const shuffled = [...queue].reverse();
  expect(queueNeighbours(shuffled, "q29")).toEqual({ prev: queue[1] ?? null, next: queue[3] ?? null });
});
