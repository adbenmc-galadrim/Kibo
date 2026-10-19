import { expect, test } from "bun:test";
import { type FeatureState, featureState, isOpenFeature, nextFeature, openFeatures } from "./feature-state";
import type { StatusId } from "./status";

const steps = (...statuses: StatusId[]) =>
  statuses.map((statusId, i) => ({ ticketId: `e${i}`, statusId, optional: false, onHold: null }));
const S42 = { end: "2026-10-16" };
const base = { blockingQuestions: new Set<string>(), sprint: S42, today: "2026-10-15" };

test("F3 with all its steps done is delivered", () => {
  const state = featureState({ ...base, steps: steps("done", "done", "done", "done") });
  expect(state).toEqual({
    status: "delivered",
    steps: { done: 4, total: 4, mandatoryDone: 4, mandatoryTotal: 4 },
    nextStepId: null,
    remaining: 0,
    started: true,
    held: 0,
  });
});

test("F4 with a step in review and one to do is open", () => {
  const state = featureState({ ...base, steps: steps("done", "done", "done", "in_review", "todo") });
  expect(state.status).toBe("open");
  expect(state.nextStepId).toBe("e3");
  expect(state.remaining).toBe(2);
  expect(state.steps).toEqual({ done: 3, total: 5, mandatoryDone: 3, mandatoryTotal: 5 });
});

test("F5 is not late on the last day of its sprint, only from the day after", () => {
  const input = { ...base, steps: steps("done", "in_progress", "todo", "todo") };
  expect(featureState({ ...input, today: "2026-10-15" }).status).toBe("open");
  expect(featureState({ ...input, today: "2026-10-16" }).status).toBe("open");
  expect(featureState({ ...input, today: "2026-10-17" }).status).toBe("late");
  expect(featureState({ ...input, sprint: null, today: "2027-01-01" }).status).toBe("open");
});

test("on the last day, steps not started or in review keep the feature on time; the day after: late", () => {
  const input = { ...base, steps: steps("done", "in_review", "in_progress") };
  expect(featureState({ ...input, today: "2026-10-16" }).status).toBe("open");
  expect(featureState({ ...input, today: "2026-10-17" }).status).toBe("late");
  const backlog = { ...base, steps: steps("in_review", "backlog") };
  expect(featureState({ ...backlog, today: "2026-10-16" }).status).toBe("open");
  const untouched = { ...base, steps: steps("todo", "todo") };
  expect(featureState({ ...untouched, today: "2026-10-16" }).status).toBe("todo");
});

test("on the last day, an optional step to do does not make a feature late", () => {
  const input = [
    ...steps("done", "done", "done", "in_review"),
    { ticketId: "demo", statusId: "todo" as const, optional: true, onHold: null },
  ];
  const state = featureState({ ...base, steps: input, today: "2026-10-16" });
  expect(state).toMatchObject({ status: "open", remaining: 1, steps: { done: 3, total: 5 } });
});

test("F6 whose next step carries a blocking question is blocked", () => {
  const input = { ...base, steps: steps("done", "todo", "todo") };
  expect(featureState({ ...input, blockingQuestions: new Set(["e1"]) }).status).toBe("blocked");
  expect(featureState({ ...input, blockingQuestions: new Set(["e2"]) }).status).toBe("open");
  expect(featureState({ ...base, steps: steps("done", "blocked", "todo") }).status).toBe("blocked");
});

test("F7 without a started step is to do", () => {
  const state = featureState({ ...base, steps: steps("todo", "backlog", "todo") });
  expect(state.status).toBe("todo");
  expect(state.nextStepId).toBe("e0");
});

test("a feature whose only remaining steps are optional is delivered", () => {
  const input = [
    ...steps("done", "done", "done", "done"),
    { ticketId: "demo", statusId: "todo" as const, optional: true, onHold: null },
  ];
  const state = featureState({ ...base, steps: input, today: "2026-12-01" });
  expect(state.status).toBe("delivered");
  expect(state.remaining).toBe(0);
  expect(state.steps).toEqual({ done: 4, total: 5, mandatoryDone: 4, mandatoryTotal: 4 });
  expect(state.nextStepId).toBe("demo");
});

const stateOf = (
  status: FeatureState["status"],
  done: number,
  total: number,
  remaining: number,
  started = status !== "todo",
): FeatureState => ({
  status,
  steps: { done, total, mandatoryDone: done, mandatoryTotal: total },
  nextStepId: null,
  remaining,
  started,
  held: 0,
});

test("open, blocked and late features are open; to do and delivered are not", () => {
  expect(isOpenFeature(stateOf("open", 1, 3, 2))).toBe(true);
  expect(isOpenFeature(stateOf("blocked", 1, 3, 2))).toBe(true);
  expect(isOpenFeature(stateOf("late", 1, 3, 2))).toBe(true);
  expect(isOpenFeature(stateOf("todo", 0, 3, 3))).toBe(false);
  expect(isOpenFeature(stateOf("delivered", 3, 3, 0))).toBe(false);
  expect(isOpenFeature(stateOf("late", 0, 3, 3, false))).toBe(false);
});

test("a feature is open only once one of its steps has started", () => {
  const after = { ...base, today: "2026-10-17" };
  expect(isOpenFeature(featureState({ ...after, steps: steps("todo", "todo", "todo") }))).toBe(false);
  const questioned = { ...base, blockingQuestions: new Set(["e0"]), steps: steps("todo", "todo") };
  expect(featureState(questioned).status).toBe("blocked");
  expect(isOpenFeature(featureState(questioned))).toBe(false);
  const late = featureState({ ...after, steps: steps("in_progress", "todo") });
  expect(late.status).toBe("late");
  expect(isOpenFeature(late)).toBe(true);
  const blocked = featureState({ ...base, steps: steps("blocked", "todo") });
  expect(blocked.status).toBe("blocked");
  expect(isOpenFeature(blocked)).toBe(true);
});

test("the next feature to finish is the most advanced open one, then the fewest remaining, then the rank", () => {
  expect(
    nextFeature([
      { id: "f4", rank: 0, state: stateOf("open", 3, 5, 2) },
      { id: "f5", rank: 1, state: stateOf("late", 1, 4, 3) },
      { id: "f3", rank: 2, state: stateOf("delivered", 4, 4, 0) },
      { id: "f7", rank: 3, state: stateOf("todo", 0, 2, 2) },
    ]),
  ).toBe("f4");
  expect(
    nextFeature([
      { id: "a", rank: 0, state: stateOf("open", 2, 4, 2) },
      { id: "b", rank: 1, state: stateOf("open", 1, 2, 1) },
    ]),
  ).toBe("b");
  expect(
    nextFeature([
      { id: "a", rank: 1, state: stateOf("open", 1, 2, 1) },
      { id: "b", rank: 0, state: stateOf("blocked", 1, 2, 1) },
    ]),
  ).toBe("b");
  expect(nextFeature([{ id: "f7", rank: 0, state: stateOf("todo", 0, 2, 2) }])).toBeNull();
  expect(nextFeature([])).toBeNull();
});

test("the open features count goes through the open predicate, ignoring tickets that are not features", () => {
  const views = [
    { feature: stateOf("open", 1, 3, 2) },
    { feature: stateOf("late", 1, 3, 2) },
    { feature: stateOf("blocked", 1, 3, 2) },
    { feature: stateOf("blocked", 0, 3, 3, false) },
    { feature: stateOf("todo", 0, 3, 3) },
    { feature: stateOf("delivered", 3, 3, 0) },
    { feature: null },
  ];
  expect(openFeatures(views)).toBe(3);
  expect(openFeatures([])).toBe(0);
});

test("a blocking question on the feature blocks it while its next step is not started", () => {
  const held = { ...base, featureId: "f2", blockingQuestions: new Set(["f2"]) };
  expect(featureState({ ...held, steps: steps("done", "todo", "todo") }).status).toBe("blocked");
  expect(featureState({ ...held, steps: steps("done", "in_progress", "todo") }).status).toBe("open");
  expect(featureState({ ...held, steps: steps("done", "done") }).status).toBe("delivered");
  expect(featureState({ ...base, featureId: "f2", steps: steps("done", "todo") }).status).toBe("open");
});

const HOLD = { source: "own" as const, key: "SILO-45", reason: "Règle de fusion", since: "2026-10-16" };
const step = (ticketId: string, statusId: StatusId, over: { optional?: boolean; held?: boolean } = {}) => ({
  ticketId,
  statusId,
  optional: over.optional ?? false,
  onHold: over.held === true ? HOLD : null,
});

test("F4 with its step in review on hold is delivered with one step on hold", () => {
  const f4 = [
    step("41", "done"),
    step("42", "done"),
    step("43", "done"),
    step("45", "in_review", { held: true }),
    step("46", "todo", { optional: true }),
  ];
  expect(featureState({ ...base, steps: f4 })).toMatchObject({
    status: "delivered",
    held: 1,
    steps: { done: 3, total: 4, mandatoryDone: 3, mandatoryTotal: 3 },
    remaining: 0,
  });
});

test("F5 goes on without its steps on hold", () => {
  const f5 = [
    step("31", "done"),
    step("32", "in_review"),
    step("33", "in_progress", { held: true }),
    step("34", "todo", { held: true }),
    step("35", "todo", { held: true }),
  ];
  expect(featureState({ ...base, steps: f5 })).toMatchObject({
    status: "open",
    held: 3,
    steps: { done: 1, total: 2 },
    nextStepId: "32",
    remaining: 1,
  });
});

test("a feature whose steps are all on hold is to do, never delivered", () => {
  const all = [step("33", "in_progress", { held: true }), step("34", "todo", { held: true })];
  expect(featureState({ ...base, steps: all })).toMatchObject({
    status: "todo",
    held: 2,
    started: false,
    remaining: 0,
    nextStepId: null,
  });
});

test("a step in progress put on hold no longer starts its feature", () => {
  const state = featureState({
    ...base,
    steps: [step("33", "in_progress", { held: true }), step("34", "todo")],
  });
  expect(state).toMatchObject({ status: "todo", started: false, nextStepId: "34" });
});

test("resuming the step on hold of a delivered feature reopens it", () => {
  const steps = (held: boolean) => [step("41", "done"), step("45", "in_review", { held })];
  expect(featureState({ ...base, steps: steps(true) }).status).toBe("delivered");
  expect(featureState({ ...base, steps: steps(false) }).status).toBe("open");
  expect(featureState({ ...base, steps: steps(false), today: "2026-10-17" }).status).toBe("late");
});
