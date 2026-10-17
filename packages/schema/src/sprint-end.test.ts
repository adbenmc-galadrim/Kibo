import { expect, test } from "bun:test";
import type { FeatureState } from "./feature-state";
import { SPRINT_VIEWS } from "./overview-test-kit";
import { sprintEndDigest } from "./sprint-end";

const S42 = SPRINT_VIEWS[1];
const state = (status: FeatureState["status"], remaining: number): FeatureState => ({
  status,
  steps: { done: 0, total: remaining, mandatoryDone: 0, mandatoryTotal: remaining },
  nextStepId: null,
  remaining,
  started: true,
});
const f4 = {
  shortKey: "F4",
  title: "Saisir un tronçon hors ligne",
  state: state("delivered", 0),
  remainingKeys: [],
};
const f5 = {
  shortKey: "F5",
  title: "Envoyer les photos d'un tronçon",
  state: state("late", 3),
  remainingKeys: ["EMIS-32", "EMIS-34", "EMIS-35"],
};

test("the digest of an ended sprint lists what remains and what was delivered", () => {
  if (S42 === undefined) throw new Error("fixture");
  expect(sprintEndDigest(S42, [f4, f5])).toBe(
    "S42 est terminé : F5 a 3 étapes restantes (EMIS-32, EMIS-34, EMIS-35). F4 est livrée. Propose un report ou un retrait du planning.",
  );
});

test("the digest agrees in number and joins several features", () => {
  if (S42 === undefined) throw new Error("fixture");
  const f3 = { ...f4, shortKey: "F3" };
  const f6 = { ...f5, shortKey: "F6", state: state("blocked", 1), remainingKeys: ["EMIS-51"] };
  expect(sprintEndDigest(S42, [f3, f4, f5, f6])).toBe(
    "S42 est terminé : F5 a 3 étapes restantes (EMIS-32, EMIS-34, EMIS-35) ; F6 a 1 étape restante (EMIS-51). F3 et F4 sont livrées. Propose un report ou un retrait du planning.",
  );
  expect(sprintEndDigest(S42, [f6])).toBe(
    "S42 est terminé : F6 a 1 étape restante (EMIS-51). Propose un report ou un retrait du planning.",
  );
});

test("a sprint without anything left needs no digest", () => {
  if (S42 === undefined) throw new Error("fixture");
  expect(sprintEndDigest(S42, [f4])).toBeNull();
  expect(sprintEndDigest(S42, [])).toBeNull();
});
