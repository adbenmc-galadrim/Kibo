import { expect, test } from "bun:test";
import { currentStep, TUTORIAL_NEVER, TUTORIAL_STEPS, TutorialState } from "./tutorial";

test("six steps in the roadmap order", () => {
  expect([...TUTORIAL_STEPS]).toEqual(["kanban", "links", "note", "dashboard", "agent", "component"]);
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
    completed: ["kanban", "links"],
  };
  expect(currentStep(active)).toBe("note");
  expect(currentStep({ ...active, completed: [...TUTORIAL_STEPS] })).toBeNull();
});

test("completed steps are unique and known", () => {
  expect(TutorialState.safeParse({ ...TUTORIAL_NEVER, completed: ["kanban", "kanban"] }).success).toBe(false);
  expect(TutorialState.safeParse({ ...TUTORIAL_NEVER, completed: ["fly"] }).success).toBe(false);
});
