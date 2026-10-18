import {
  KiboError,
  type Phase7Event,
  TUTORIAL_NEVER,
  TUTORIAL_STEPS,
  type TutorialSeed,
  TutorialState,
  type TutorialStep,
  type TutorialView,
} from "@kibo/schema";
import { z } from "zod";
import type { LocalSettings } from "../settings";
import { evaluateTutorial, type TutorialSnapshot } from "./tutorial-eval";
import { tutorialComplete } from "./tutorial-required";

export type TutorialService = {
  get(): TutorialState;
  start(): Promise<TutorialState>;
  pause(): TutorialState;
  skip(): TutorialState;
  reset(): TutorialState;
  close(): TutorialState;
  skipStep(step: TutorialStep): TutorialState;
  markSeen(view: TutorialView): TutorialState;
  simulateReview(projectId: string): TutorialState;
  refresh(): void;
};

export type TutorialServiceDeps = {
  settings: LocalSettings;
  createDemo(): Promise<DemoProject>;
  findDemo(): DemoProject | null;
  snapshot(projectId: string): TutorialSnapshot | null;
  emit(event: Phase7Event): void;
  simulateReview(projectId: string): void;
  now?: () => number;
};

type DemoProject = { projectId: string; seed: TutorialSeed };

const KEY = "tutorial";
const Stored = z.object({ status: z.string() }).passthrough();
const inProgress = (s: TutorialState) => s.status === "active" || s.status === "paused";
const startsOver = (s: TutorialState) => s.status === "never" || s.status === "done" || s.status === "closed";

function fromOlderKibo(status: string): TutorialState {
  if (status === "done") return { ...TUTORIAL_NEVER, status: "closed" };
  if (status === "skipped") return { ...TUTORIAL_NEVER, status: "skipped" };
  return TUTORIAL_NEVER;
}

export function createTutorialService(deps: TutorialServiceDeps): TutorialService {
  const now = deps.now ?? Date.now;
  const get = (): TutorialState => {
    const raw = deps.settings.get(KEY, Stored.nullable(), null);
    if (raw === null) return TUTORIAL_NEVER;
    const parsed = TutorialState.safeParse(raw);
    return parsed.success ? parsed.data : fromOlderKibo(raw.status);
  };
  const save = (next: TutorialState): TutorialState => {
    deps.settings.set(KEY, next);
    deps.emit({ type: "tutorial.changed" });
    return next;
  };
  const demoExists = (s: TutorialState) =>
    s.projectId !== null && s.seed !== null && deps.snapshot(s.projectId) !== null;
  const evaluated = (s: TutorialState): TutorialState => {
    const snap = s.projectId === null ? null : deps.snapshot(s.projectId);
    return snap === null ? s : evaluateTutorial(s, snap);
  };

  const begin = async (): Promise<TutorialState> => {
    const current = get();
    if (current.status === "active" && demoExists(current)) return current;
    if (!startsOver(current) && demoExists(current)) return save({ ...current, status: "active" });
    const { projectId, seed } = deps.findDemo() ?? (await deps.createDemo());
    const kept = startsOver(current) ? { completed: [], seenViews: [], startedAt: now() } : current;
    return save(
      evaluated({
        status: "active",
        completed: kept.completed,
        seenViews: kept.seenViews,
        startedAt: kept.startedAt ?? now(),
        projectId,
        seed,
      }),
    );
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
    status: tutorialComplete(completed) ? "done" : s.status,
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
    close() {
      const s = get();
      return s.status === "done" ? save({ ...s, status: "closed" }) : s;
    },
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
      return save(evaluated({ ...s, seenViews: [...s.seenViews, view] }));
    },
    simulateReview(projectId) {
      const s = get();
      if (s.status !== "active" || s.projectId !== projectId)
        throw new KiboError(
          "INVALID_INPUT",
          "only the demo project of a running tutorial simulates a review",
        );
      deps.simulateReview(projectId);
      const next = evaluated(get());
      return next === s ? s : save(next);
    },
    refresh() {
      const s = get();
      if (s.status !== "active" || s.projectId === null) return;
      const next = evaluated(s);
      if (next !== s) save(next);
    },
  };
}
