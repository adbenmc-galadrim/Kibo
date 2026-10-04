import {
  type Phase7Event,
  TUTORIAL_NEVER,
  TUTORIAL_STEPS,
  type TutorialSeed,
  TutorialState,
  type TutorialStep,
} from "@kibo/schema";
import type { LocalSettings } from "../settings";
import { evaluateTutorial, type TutorialSnapshot } from "./tutorial-eval";

export type TutorialService = {
  get(): TutorialState;
  start(): Promise<TutorialState>;
  pause(): TutorialState;
  skip(): TutorialState;
  reset(): TutorialState;
  skipStep(step: TutorialStep): TutorialState;
  markSeen(view: "graph"): TutorialState;
  refresh(): void;
};

export type TutorialServiceDeps = {
  settings: LocalSettings;
  createDemo(): Promise<{ projectId: string; seed: TutorialSeed }>;
  snapshot(projectId: string): TutorialSnapshot | null;
  emit(event: Phase7Event): void;
  now?: () => number;
};

const KEY = "tutorial";
const inProgress = (s: TutorialState) => s.status === "active" || s.status === "paused";
const startsOver = (s: TutorialState) => s.status === "never" || s.status === "done";

export function createTutorialService(deps: TutorialServiceDeps): TutorialService {
  const now = deps.now ?? Date.now;
  const get = () => deps.settings.get(KEY, TutorialState, TUTORIAL_NEVER);
  const save = (next: TutorialState): TutorialState => {
    deps.settings.set(KEY, next);
    deps.emit({ type: "tutorial.changed" });
    return next;
  };
  const demoExists = (s: TutorialState) =>
    s.projectId !== null && s.seed !== null && deps.snapshot(s.projectId) !== null;

  const begin = async (): Promise<TutorialState> => {
    const current = get();
    if (current.status === "active" && demoExists(current)) return current;
    if (!startsOver(current) && demoExists(current)) return save({ ...current, status: "active" });
    const { projectId, seed } = await deps.createDemo();
    const kept = startsOver(current) ? { completed: [], seenViews: [], startedAt: now() } : current;
    return save({
      status: "active",
      completed: kept.completed,
      seenViews: kept.seenViews,
      startedAt: kept.startedAt ?? now(),
      projectId,
      seed,
    });
  };

  let starting: Promise<TutorialState> | null = null;
  const start = (): Promise<TutorialState> => {
    if (!starting)
      starting = begin().finally(() => {
        starting = null;
      });
    return starting;
  };

  const withCompleted = (s: TutorialState, completed: TutorialStep[]): TutorialState => ({
    ...s,
    completed,
    status: completed.length === TUTORIAL_STEPS.length ? "done" : s.status,
  });

  return {
    get,
    start,
    pause() {
      const s = get();
      return s.status === "active" ? save({ ...s, status: "paused" }) : s;
    },
    skip() {
      const s = get();
      return s.status === "skipped" ? s : save({ ...s, status: "skipped" });
    },
    reset: () => save(TUTORIAL_NEVER),
    skipStep(step) {
      const s = get();
      if (!inProgress(s) || s.completed.includes(step)) return s;
      return save(
        withCompleted(
          s,
          TUTORIAL_STEPS.filter((x) => x === step || s.completed.includes(x)),
        ),
      );
    },
    markSeen(view) {
      const s = get();
      if (!inProgress(s) || s.seenViews.includes(view)) return s;
      const seen = { ...s, seenViews: [...s.seenViews, view] };
      const snap = seen.projectId === null ? null : deps.snapshot(seen.projectId);
      return save(snap === null ? seen : evaluateTutorial(seen, snap));
    },
    refresh() {
      const s = get();
      if (s.status !== "active" || s.projectId === null) return;
      const snap = deps.snapshot(s.projectId);
      if (snap === null) return;
      const next = evaluateTutorial(s, snap);
      if (next !== s) save(next);
    },
  };
}
