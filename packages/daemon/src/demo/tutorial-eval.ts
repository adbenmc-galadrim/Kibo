import {
  type Instance,
  type Link,
  type RunView,
  type Ticket,
  TUTORIAL_STEPS,
  type TutorialSeed,
  type TutorialState,
  type TutorialStep,
} from "@kibo/schema";
import { DEMO_AGENT_PROFILE, linkKeyOf } from "./demo-project";

export type TutorialRun = Pick<RunView, "profileId" | "projectId" | "state">;
export type TutorialSnapshot = {
  tickets: Pick<Ticket, "id" | "statusId">[];
  links: Link[];
  instances: Instance[];
  noteHash: string | null;
  runs: TutorialRun[];
  aiComponentIds: string[];
};

type Check = (seed: TutorialSeed, state: TutorialState, snap: TutorialSnapshot) => boolean;

const componentIdOf = (ref: string): string => ref.slice(0, ref.lastIndexOf("@"));

const layoutChanged = (seed: TutorialSeed, i: Instance): boolean => {
  const was = seed.layouts[i.id];
  if (was === undefined) return false;
  return was.x !== i.layout.x || was.y !== i.layout.y || was.w !== i.layout.w || was.h !== i.layout.h;
};

const CHECKS: Record<TutorialStep, Check> = {
  kanban: (seed, _state, snap) =>
    snap.tickets.some(
      (t) => !seed.ticketIds.includes(t.id) && t.statusId !== "todo" && t.statusId !== "backlog",
    ),
  links: (seed, state, snap) =>
    state.seenViews.includes("graph") && snap.links.some((l) => !seed.linkKeys.includes(linkKeyOf(l))),
  note: (seed, _state, snap) => snap.noteHash !== null && snap.noteHash !== seed.noteHash,
  dashboard: (seed, _state, snap) => snap.instances.some((i) => layoutChanged(seed, i)),
  agent: (_seed, state, snap) =>
    snap.runs.some(
      (r) => r.profileId === DEMO_AGENT_PROFILE && r.projectId === state.projectId && r.state === "done",
    ),
  component: (_seed, _state, snap) =>
    snap.instances.some((i) => snap.aiComponentIds.includes(componentIdOf(i.component))),
};

export function evaluateTutorial(state: TutorialState, snap: TutorialSnapshot): TutorialState {
  const seed = state.seed;
  if (state.status !== "active" || seed === null) return state;
  const completed = TUTORIAL_STEPS.filter(
    (step) => state.completed.includes(step) || CHECKS[step](seed, state, snap),
  );
  if (completed.length === state.completed.length) return state;
  return { ...state, completed, status: completed.length === TUTORIAL_STEPS.length ? "done" : "active" };
}
