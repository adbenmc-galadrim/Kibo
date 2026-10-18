import {
  currentStep,
  type TabTarget,
  TUTORIAL_STEPS,
  type TutorialSeed,
  type TutorialState,
  type TutorialStep,
} from "@kibo/schema";
import { frTutorial } from "../i18n/fr-tutorial";

export type StepView = {
  step: TutorialStep;
  title: string;
  instruction: string;
  where: TabTarget | null;
  done: boolean;
  current: boolean;
};

type PageOfSeed = "overviewPageId" | "planningPageId" | "kanbanPageId" | "questionsPageId";

const DESTINATIONS: Record<TutorialStep, PageOfSeed> = {
  overview: "overviewPageId",
  feature: "planningPageId",
  review: "kanbanPageId",
  question: "questionsPageId",
  copy: "kanbanPageId",
};

const whereOf = (seed: TutorialSeed | null, projectId: string, step: TutorialStep): TabTarget | null =>
  seed ? { kind: "page", projectId, pageId: seed[DESTINATIONS[step]] } : null;

export function stepViews(state: TutorialState, projectId: string): StepView[] {
  const current = currentStep(state);
  return TUTORIAL_STEPS.map((step) => ({
    step,
    ...frTutorial.steps[step],
    where: whereOf(state.seed, projectId, step),
    done: state.completed.includes(step),
    current: step === current,
  }));
}
