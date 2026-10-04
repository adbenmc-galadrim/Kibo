import { expect, test } from "bun:test";
import { stepAccumulator } from "./accumulator";

test("a fixed step accumulator never runs more than five steps", () => {
  expect(stepAccumulator(0, 1 / 60)).toEqual({ steps: 1, rest: 0 });
  expect(stepAccumulator(0, 0.01)).toEqual({ steps: 0, rest: 0.01 });
  const { steps, rest } = stepAccumulator(0.005, 0.03);
  expect(steps).toBe(2);
  expect(rest).toBeCloseTo(0.035 - 2 / 60);
  expect(stepAccumulator(0, 1)).toEqual({ steps: 5, rest: 0 });
});
