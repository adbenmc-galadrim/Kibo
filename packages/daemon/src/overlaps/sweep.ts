import { DUPLICATION_LIMITS, type RunView } from "@kibo/schema";
import type { ScheduleTimers } from "../backups/schedule";
import type { SweepResult } from "./detector";

export type SweepSchedulerDeps = {
  detector: { sweep(projectId: string): Promise<SweepResult> };
  projects(): string[];
  timers?: ScheduleTimers;
  now?: () => number;
  log(line: string): void;
};

export type SweepScheduler = {
  start(): void;
  stop(): Promise<void>;
  onSpawned(run: RunView, workspaces: number): void;
  onTurnEnd(run: RunView): void;
};

const SYSTEM_TIMERS: ScheduleTimers = {
  every(fn, ms) {
    const timer = setInterval(fn, ms);
    timer.unref();
    return () => clearInterval(timer);
  },
};

export function createSweepScheduler(deps: SweepSchedulerDeps): SweepScheduler {
  const timers = deps.timers ?? SYSTEM_TIMERS;
  const now = deps.now ?? Date.now;
  const running = new Map<string, Promise<void>>();
  let cancel: (() => void) | null = null;
  let stopped = false;

  const sweep = (projectId: string | null): void => {
    if (stopped || !projectId || running.has(projectId)) return;
    const started = now();
    const done = new Promise<SweepResult>((resolve) => resolve(deps.detector.sweep(projectId)))
      .then(({ compared, partial }) =>
        deps.log(
          `overlaps: sweep of ${projectId} done in ${now() - started} ms, ` +
            `${compared} workspace pairs compared, ${partial ? "partial" : "complete"}`,
        ),
      )
      .catch((e: unknown) => deps.log(`overlaps: sweep of ${projectId} failed: ${String(e)}`))
      .finally(() => running.delete(projectId));
    running.set(projectId, done);
  };

  const sweepAll = (): void => {
    for (const projectId of deps.projects()) sweep(projectId);
  };

  return {
    start() {
      cancel ??= timers.every(sweepAll, DUPLICATION_LIMITS.sweepMs);
    },
    async stop() {
      stopped = true;
      cancel?.();
      cancel = null;
      await Promise.all(running.values());
    },
    onSpawned(run, workspaces) {
      if (workspaces >= 2) sweep(run.projectId);
    },
    onTurnEnd: (run) => sweep(run.projectId),
  };
}
