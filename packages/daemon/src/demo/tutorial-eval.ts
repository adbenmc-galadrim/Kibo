import {
  type Ticket,
  TUTORIAL_STEPS,
  type TutorialSeed,
  type TutorialState,
  type TutorialStep,
} from "@kibo/schema";
import { tutorialComplete } from "./tutorial-required";

export type TutorialSnapshot = {
  tickets: Pick<Ticket, "id" | "statusId" | "parentId" | "shortKey">[];
  questions: { id: string; answered: boolean }[];
};

type Check = (seed: TutorialSeed, state: TutorialState, snap: TutorialSnapshot) => boolean;

const CHECKS: Record<TutorialStep, Check> = {
  overview: (_seed, state) => state.seenViews.includes("overview"),
  feature: (seed, _state, snap) =>
    snap.tickets.some((t) => t.parentId === null && t.shortKey !== null && !seed.featureIds.includes(t.id)),
  review: (seed, _state, snap) =>
    snap.tickets.some((t) => t.id === seed.reviewTicketId && t.statusId === "in_review"),
  question: (seed, _state, snap) => snap.questions.some((q) => q.id === seed.questionId && q.answered),
  copy: (_seed, state) => state.seenViews.includes("copy"),
};

export function evaluateTutorial(state: TutorialState, snap: TutorialSnapshot): TutorialState {
  const seed = state.seed;
  if (state.status !== "active" || seed === null) return state;
  const completed = TUTORIAL_STEPS.filter(
    (step) => state.completed.includes(step) || CHECKS[step](seed, state, snap),
  );
  if (completed.length === state.completed.length) return state;
  return { ...state, completed, status: tutorialComplete(completed) ? "done" : "active" };
}
