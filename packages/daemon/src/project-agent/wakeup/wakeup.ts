import { planWakeup, type WakePlan, wakeupMessage } from "@kibo/core/project-agent/wakeup";
import { type AnsweredLine, WAKE_WINDOW_MS } from "@kibo/schema";
import type { WakeupStore } from "./store";

export const ANSWER_WAKE_GRACE_MS = 30_000;

export type WakeupDeps = {
  store: Omit<WakeupStore, "close">;
  send(projectId: string, text: string): void;
  writable(projectId: string): boolean;
  answered(projectId: string, questionIds: readonly string[]): AnsweredLine[];
  now?: () => number;
  setTimeout?: (fn: () => void, ms: number) => unknown;
  clearTimeout?: (handle: unknown) => void;
  window?: number;
  grace?: number;
};

type WakeupScheduler = {
  requestAnswer(projectId: string, questionId: string): WakePlan;
  start(): void;
  stop(): void;
};

const systemSetTimeout = (fn: () => void, ms: number): (() => void) => {
  const handle = setTimeout(fn, ms);
  return () => clearTimeout(handle);
};
const systemClearTimeout = (handle: unknown): void => {
  if (typeof handle === "function") handle();
};

export function createWakeupScheduler(deps: WakeupDeps): WakeupScheduler {
  const now = deps.now ?? Date.now;
  const arm = deps.setTimeout ?? systemSetTimeout;
  const disarm = deps.clearTimeout ?? systemClearTimeout;
  const window = deps.window ?? WAKE_WINDOW_MS;
  const grace = deps.grace ?? ANSWER_WAKE_GRACE_MS;
  const timers = new Map<string, unknown>();

  function clear(projectId: string): void {
    const handle = timers.get(projectId);
    if (handle === undefined) return;
    timers.delete(projectId);
    disarm(handle);
  }

  function send(projectId: string, text: string): void {
    try {
      deps.send(projectId, text);
    } catch (e) {
      console.error(`[kibo-daemon] waking the project agent of ${projectId} failed`, e);
    }
  }

  function guarded(projectId: string, what: string, action: () => void): void {
    try {
      action();
    } catch (e) {
      console.error(`[kibo-daemon] ${what} of ${projectId} failed`, e);
    }
  }

  function wake(projectId: string): void {
    const current = deps.store.wakeup(projectId);
    const queued = deps.store.queuedAnswers(projectId);
    deps.store.dropAnswers(projectId);
    if (!deps.writable(projectId)) {
      deps.store.saveWakeup({ ...current, dueAt: null });
      return;
    }
    const answers = queued.length === 0 ? [] : deps.answered(projectId, queued);
    if (answers.length === 0) {
      deps.store.saveWakeup({ ...current, dueAt: null });
      return;
    }
    const at = now();
    send(projectId, wakeupMessage(answers));
    deps.store.saveWakeup({ projectId, lastAt: at, dueAt: null });
  }

  function fire(projectId: string): void {
    clear(projectId);
    guarded(projectId, "the project agent wake-up", () => wake(projectId));
  }

  function schedule(projectId: string, at: number): void {
    clear(projectId);
    timers.set(
      projectId,
      arm(() => fire(projectId), Math.max(0, at - now())),
    );
  }

  function apply(projectId: string, plan: WakePlan): WakePlan {
    if (plan.kind === "now") fire(projectId);
    if (plan.kind === "scheduled") {
      deps.store.saveWakeup({ ...deps.store.wakeup(projectId), dueAt: plan.at });
      schedule(projectId, plan.at);
    }
    return plan;
  }

  return {
    requestAnswer(projectId, questionId) {
      deps.store.queueAnswer(projectId, questionId, now());
      const current = deps.store.wakeup(projectId);
      const plan = planWakeup({ ...current, now: now(), window });
      if (plan.kind === "now" && grace > 0) return apply(projectId, { kind: "scheduled", at: now() + grace });
      return apply(projectId, plan);
    },
    start() {
      for (const wakeup of deps.store.due()) {
        const { projectId, dueAt } = wakeup;
        if (dueAt === null) continue;
        guarded(projectId, "replaying the wake-up", () => {
          if (dueAt <= now()) fire(projectId);
          else schedule(projectId, dueAt);
        });
      }
    },
    stop() {
      for (const projectId of [...timers.keys()]) clear(projectId);
    },
  };
}
