import { TUTORIAL_STEPS, type TutorialStep } from "@kibo/schema";

export const tutorialComplete = (completed: readonly TutorialStep[]): boolean =>
  TUTORIAL_STEPS.every((step) => completed.includes(step));
