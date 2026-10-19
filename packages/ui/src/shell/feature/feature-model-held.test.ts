import { expect, test } from "bun:test";
import type { FeatureState } from "@kibo/schema";
import {
  featureBadge,
  nextStartableStep,
  type StepFacts,
  splitHeld,
  sprintFacts,
  stepModels,
} from "./feature-model";
import { NOW, siloHeldProject } from "./fixture";

const project = siloHeldProject();
const facts: StepFacts = { runs: [], ciRuns: [], now: NOW, execution: "hidden" };
const ticket = (id: string) => {
  const t = project.tickets.find((x) => x.id === id);
  if (!t) throw new Error(`fixture without ${id}`);
  return t;
};
const state = (patch: Partial<FeatureState>): FeatureState => ({
  status: "open",
  steps: { done: 0, total: 0, mandatoryDone: 0, mandatoryTotal: 0 },
  nextStepId: null,
  remaining: 0,
  started: false,
  held: 0,
  ...patch,
});

test("the active steps are numbered first, the steps on hold come after them", () => {
  const { active, held } = splitHeld(stepModels(project, "f5", facts));
  expect(active.map((s) => [s.index, s.key])).toEqual([
    [1, "SILO-31"],
    [2, "SILO-32"],
  ]);
  expect(held.map((s) => [s.key, s.onHold?.source])).toEqual([
    ["SILO-33", "own"],
    ["SILO-34", "dependency"],
    ["SILO-35", "dependency"],
  ]);
});

test("the next step is never a step on hold, even one marked startable", () => {
  const { active } = splitHeld(stepModels(project, "f5", facts));
  expect(nextStartableStep(active, project.tickets)).toBeNull();
  const tickets = project.tickets.map((t) =>
    t.id === "e34" ? { ...t, startable: true, startReason: null } : t,
  );
  expect(nextStartableStep(active, tickets)).toBeNull();
});

test("a delivered feature with steps on hold says how many wait", () => {
  expect(featureBadge(state({ status: "delivered", held: 1 }))).toBe("deliveredHeld");
  expect(featureBadge(state({ status: "delivered" }))).toBe("delivered");
  expect(featureBadge(ticket("f4").feature)).toBe("deliveredHeld");
});

test("the steps on hold do not make a feature at risk on the last day of its sprint", () => {
  const f5 = ticket("f5");
  const steps = stepModels(project, "f5", facts);
  expect(f5.feature?.remaining).toBe(1);
  expect(sprintFacts(project, f5, { today: "2026-10-16", steps }).warning).toBeNull();
  const late = { ...f5, feature: f5.feature && { ...f5.feature, status: "late" as const } };
  expect(sprintFacts(project, late, { today: "2026-10-17", steps }).warning).toEqual({
    kind: "over",
    remaining: 1,
  });
});
