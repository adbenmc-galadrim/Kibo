import { expect, test } from "bun:test";
import { RpcRequest } from "./rpc";
import { currentStep, TUTORIAL_NEVER, TUTORIAL_STEPS, TutorialState } from "./tutorial";

test("five tracking steps in the tour order", () => {
  expect([...TUTORIAL_STEPS]).toEqual(["overview", "feature", "review", "question", "copy"]);
});

test("the never state parses and has no current step until started", () => {
  expect(TutorialState.parse(TUTORIAL_NEVER)).toEqual(TUTORIAL_NEVER);
  expect(currentStep(TUTORIAL_NEVER)).toBeNull();
});

test("currentStep is the first step not completed", () => {
  const active: TutorialState = {
    ...TUTORIAL_NEVER,
    status: "active",
    startedAt: 1,
    completed: ["overview", "feature"],
  };
  expect(currentStep(active)).toBe("review");
  expect(currentStep({ ...active, completed: [...TUTORIAL_STEPS] })).toBeNull();
});

test("completed steps are unique and known, the agent steps are gone", () => {
  expect(TutorialState.safeParse({ ...TUTORIAL_NEVER, completed: ["overview", "overview"] }).success).toBe(
    false,
  );
  expect(TutorialState.safeParse({ ...TUTORIAL_NEVER, completed: ["agent"] }).success).toBe(false);
});

test("a closed tour has no current step and stays parsable", () => {
  const closed: TutorialState = { ...TUTORIAL_NEVER, status: "closed", completed: [...TUTORIAL_STEPS] };
  expect(TutorialState.parse(closed)).toEqual(closed);
  expect(currentStep(closed)).toBeNull();
});

test("the tutorial requests: seen views, close, simulated review", () => {
  const ok = (req: unknown) => RpcRequest.safeParse(req).success;
  expect(ok({ method: "markTutorialSeen", view: "overview" })).toBe(true);
  expect(ok({ method: "markTutorialSeen", view: "copy" })).toBe(true);
  expect(ok({ method: "markTutorialSeen", view: "graph" })).toBe(false);
  expect(ok({ method: "skipTutorialStep", step: "question" })).toBe(true);
  expect(ok({ method: "closeTutorial" })).toBe(true);
  expect(ok({ method: "simulateTutorialReview", projectId: "p1" })).toBe(true);
  expect(ok({ method: "simulateTutorialReview", projectId: "" })).toBe(false);
});
