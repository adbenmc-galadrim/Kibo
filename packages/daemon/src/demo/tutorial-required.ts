import { TUTORIAL_STEPS, type TutorialStep } from "@kibo/schema";

const REQUIRED_STEPS = TUTORIAL_STEPS.filter((step) => step !== "agent");

export const tutorialComplete = (completed: readonly TutorialStep[]): boolean =>
  REQUIRED_STEPS.every((step) => completed.includes(step));
