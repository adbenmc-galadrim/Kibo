import { expect, test } from "bun:test";
import type { FeatureState } from "./feature-state";
import { SPRINT_VIEWS } from "./overview-test-kit";
import { endedSprint, sprintEndDigest, sprintRecap } from "./sprint-end";

const S42 = SPRINT_VIEWS[1];
const state = (status: FeatureState["status"], remaining: number): FeatureState => ({
  status,
  steps: { done: 0, total: remaining, mandatoryDone: 0, mandatoryTotal: remaining },
  nextStepId: null,
  remaining,
  started: true,
  held: 0,
});
const f4 = {
  shortKey: "F4",
  title: "Saisir un constat hors ligne",
  state: state("delivered", 0),
  remainingKeys: [],
};
const f5 = {
  shortKey: "F5",
  title: "Envoyer les photos d'un constat",
  state: state("late", 3),
  remainingKeys: ["SILO-32", "SILO-34", "SILO-35"],
};

test("the digest of an ended sprint lists what remains and what was delivered", () => {
  if (S42 === undefined) throw new Error("fixture");
  expect(sprintEndDigest(S42, [f4, f5])).toBe(
    "S42 est terminé : F5 a 3 étapes restantes (SILO-32, SILO-34, SILO-35). F4 est livrée. Propose un report ou un retrait du planning.",
  );
});

test("the digest agrees in number and joins several features", () => {
  if (S42 === undefined) throw new Error("fixture");
  const f3 = { ...f4, shortKey: "F3" };
  const f6 = { ...f5, shortKey: "F6", state: state("blocked", 1), remainingKeys: ["SILO-51"] };
  expect(sprintEndDigest(S42, [f3, f4, f5, f6])).toBe(
    "S42 est terminé : F5 a 3 étapes restantes (SILO-32, SILO-34, SILO-35) ; F6 a 1 étape restante (SILO-51). F3 et F4 sont livrées. Propose un report ou un retrait du planning.",
  );
  expect(sprintEndDigest(S42, [f6])).toBe(
    "S42 est terminé : F6 a 1 étape restante (SILO-51). Propose un report ou un retrait du planning.",
  );
});

test("a sprint without anything left needs no digest", () => {
  if (S42 === undefined) throw new Error("fixture");
  expect(sprintEndDigest(S42, [f4])).toBeNull();
  expect(sprintEndDigest(S42, [])).toBeNull();
});

const withSteps = (f: typeof f5, done: number, total: number) => ({
  ...f,
  state: { ...f.state, steps: { ...f.state.steps, done, total } },
});
const S43 = SPRINT_VIEWS[2];

test("sprintRecap lists delivered features, merged/planned steps, capacity, slipped features and the next sprint", () => {
  if (S42 === undefined || S43 === undefined) throw new Error("sprints");
  const next = { sprint: S43, features: [withSteps(f5, 0, 3), withSteps(f5, 0, 5)] };
  expect(sprintRecap(S42, [withSteps(f4, 4, 4), withSteps(f5, 1, 4)], next)).toEqual({
    code: S42.code,
    name: S42.name,
    start: S42.start,
    end: S42.end,
    delivered: [{ label: "F4", title: "Saisir un constat hors ligne" }],
    mergedSteps: 5,
    plannedSteps: 8,
    capacity: 5,
    slipped: [{ label: "F5", remaining: 3, keys: ["SILO-32", "SILO-34", "SILO-35"], to: S43.code }],
    next: { code: S43.code, start: S43.start, end: S43.end, plannedSteps: 8 },
  });
});

test("a sprint without a next one slips nowhere and an empty sprint has no recap", () => {
  if (S42 === undefined) throw new Error("S42");
  expect(sprintRecap(S42, [f5], null)?.slipped[0]?.to).toBeNull();
  expect(sprintRecap(S42, [f5], null)?.next).toBeNull();
  expect(sprintRecap(S42, [], null)).toBeNull();
});

test("endedSprint takes the latest sprint over, and nothing before the day after its end", () => {
  if (S42 === undefined || S43 === undefined) throw new Error("sprints");
  expect(endedSprint([S42, S43], S42.end)).toBeNull();
  expect(endedSprint([S42, S43], "2026-10-17")?.code).toBe(S42.code);
  expect(endedSprint([], "2026-10-17")).toBeNull();
});
