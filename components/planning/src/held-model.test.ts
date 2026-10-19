import { expect, test } from "bun:test";
import type { ProjectCommand } from "@kibo/schema";
import { createMockSdk } from "@kibo/sdk/mock";
import { heldGroups } from "./held-model";
import { manifest } from "./index";
import { addHeldStep, HOLD_RULE, HOLD_SERVER, seedPlanning, seedPlanningHeld, TODAY } from "./test-seed";

type Seeded = ReturnType<typeof seedPlanning>;
type Run = (cmd: ProjectCommand) => unknown;

function build(seedWith: (run: Run) => Seeded, more: (run: Run, seeded: Seeded) => void = () => {}) {
  const m = createMockSdk(manifest, {
    today: TODAY,
    seed: (run) => more(run, seedWith(run)),
  });
  const s = m.snapshot();
  return heldGroups(s.tickets, s.sprints, TODAY);
}

const codes = (targets: readonly { code: string }[]) => targets.map((t) => t.code);

test("held steps are grouped by reason, in the order of heldByReason, with their dependents", () => {
  const groups = build(seedPlanningHeld);
  expect(groups.map((g) => g.reason)).toEqual([HOLD_RULE, HOLD_SERVER]);
  expect(groups.map((g) => g.steps.map((s) => s.key))).toEqual([["KIB-16"], ["KIB-21", "KIB-31"]]);
  expect(groups.map((g) => g.dependents)).toEqual([0, 2]);
  const [rule] = groups[0]?.steps ?? [];
  expect(rule).toMatchObject({
    key: "KIB-16",
    title: "Saisir un constat hors ligne · étape 4",
    featureKey: "F4",
    reason: HOLD_RULE,
    since: TODAY,
  });
  expect(groups[1]?.steps.map((s) => s.featureKey)).toEqual(["F5", "F7"]);
});

test("a step whose feature sprint still runs cannot be resumed in another sprint", () => {
  const [rule, server] = build(seedPlanningHeld);
  expect(rule?.steps[0]?.resumeTargets).toEqual([]);
  expect(server?.steps[0]?.resumeTargets).toEqual([]);
});

test("a step of a feature in an ended sprint, or without sprint, is resumed in an unfinished sprint", () => {
  const groups = build(seedPlanning, (run, seeded) => {
    addHeldStep(run, seeded.features.f2.root, HOLD_RULE);
    addHeldStep(run, seeded.features.f9.root, HOLD_SERVER);
  });
  const [inS41, unplanned] = groups.map((g) => g.steps[0]);
  expect(inS41?.featureKey).toBe("F2");
  expect(codes(inS41?.resumeTargets ?? [])).toEqual(["S42", "S43", "S44"]);
  expect(inS41?.resumeTargets[1]).toMatchObject({ code: "S43", name: "Import et contrats" });
  expect(unplanned?.featureKey).toBe("F9");
  expect(codes(unplanned?.resumeTargets ?? [])).toEqual(["S42", "S43", "S44"]);
});

test("no group without a step on hold of its own", () => {
  expect(build(seedPlanning)).toEqual([]);
});
