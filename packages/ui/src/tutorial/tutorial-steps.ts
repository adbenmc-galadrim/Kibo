import {
  currentStep,
  type Page,
  type TabTarget,
  TUTORIAL_STEPS,
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

type Destination = { seed: "dashboardPageId" | "graphPageId" } | { title: string };

const KANBAN: Destination = { title: "Kanban" };
const DASHBOARD: Destination = { seed: "dashboardPageId" };

const DESTINATIONS: Record<TutorialStep, Destination> = {
  kanban: KANBAN,
  links: { seed: "graphPageId" },
  note: { title: "Notes" },
  dashboard: DASHBOARD,
  agent: KANBAN,
  component: DASHBOARD,
};

function pageOf(state: TutorialState, pages: readonly Page[], to: Destination): Page | null {
  if ("title" in to) return pages.find((p) => p.title === to.title) ?? null;
  const id = state.seed?.[to.seed];
  return pages.find((p) => p.id === id) ?? null;
}

export function stepViews(state: TutorialState, projectId: string, pages: readonly Page[]): StepView[] {
  const current = currentStep(state);
  return TUTORIAL_STEPS.map((step) => {
    const page = pageOf(state, pages, DESTINATIONS[step]);
    return {
      step,
      ...frTutorial.steps[step],
      where: page ? { kind: "page", projectId, pageId: page.id } : null,
      done: state.completed.includes(step),
      current: step === current,
    };
  });
}
