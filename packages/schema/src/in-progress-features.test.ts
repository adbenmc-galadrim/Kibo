import { expect, test } from "bun:test";
import fc from "fast-check";
import type { FeatureState, FeatureStatus } from "./feature-state";
import { inProgressFeatures, isInProgressFeature } from "./in-progress-features";

const stateOf = (status: FeatureStatus, started: boolean): FeatureState => ({
  status,
  steps: { done: 0, total: 3, mandatoryDone: 0, mandatoryTotal: 3 },
  nextStepId: null,
  remaining: status === "delivered" ? 0 : 3,
  started,
  held: 0,
});
const feature = (id: string, status: FeatureStatus, started: boolean) => ({
  id,
  state: stateOf(status, started),
});

const F3 = feature("F3", "delivered", true);
const F4 = feature("F4", "open", true);
const F5 = feature("F5", "late", true);
const F6 = feature("F6", "blocked", false);
const F7 = feature("F7", "todo", false);

test("a feature is in progress once started and until delivered", () => {
  expect(isInProgressFeature(F4.state)).toBe(true);
  expect(isInProgressFeature(F5.state)).toBe(true);
  expect(isInProgressFeature(feature("x", "blocked", true).state)).toBe(true);
  expect(isInProgressFeature(F3.state)).toBe(false);
  expect(isInProgressFeature(F6.state)).toBe(false);
  expect(isInProgressFeature(F7.state)).toBe(false);
});

test("in progress counts against the limit and names the blocked features", () => {
  const result = inProgressFeatures([F3, F4, F5, F6, F7], 2);
  expect(result.inProgress.map((f) => f.id)).toEqual(["F4", "F5"]);
  expect(result.count).toBe(2);
  expect(result.limit).toBe(2);
  expect(result.level).toBe("reached");
  expect(result.blocked.map((f) => f.id)).toEqual(["F6"]);
});

test("the level is under, reached or over the limit", () => {
  expect(inProgressFeatures([F4], 2).level).toBe("under");
  expect(inProgressFeatures([F4, F5], 2).level).toBe("reached");
  expect(inProgressFeatures([F4, F5], 1).level).toBe("over");
  expect(inProgressFeatures([], 2)).toEqual({
    inProgress: [],
    count: 0,
    limit: 2,
    level: "under",
    blocked: [],
  });
});

const statusArb = fc.constantFrom<FeatureStatus>("todo", "open", "blocked", "late", "delivered");

test("in progress and level follow the definition for any list", () => {
  fc.assert(
    fc.property(
      fc.array(fc.tuple(statusArb, fc.boolean()), { maxLength: 12 }),
      fc.integer({ min: 1, max: 10 }),
      (drawn, limit) => {
        const features = drawn.map(([status, started], i) => feature(`F${i}`, status, started));
        const result = inProgressFeatures(features, limit);
        const expected = features.filter((f) => f.state.started && f.state.status !== "delivered");
        expect(result.inProgress).toEqual(expected);
        const level = expected.length < limit ? "under" : expected.length === limit ? "reached" : "over";
        expect(result.level).toBe(level);
        expect(result.blocked.every((f) => f.state.status === "blocked")).toBe(true);
      },
    ),
  );
});
