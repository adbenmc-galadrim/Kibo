import { DUPLICATION_LIMITS, type RunView } from "@kibo/schema";
import type { ScheduleTimers } from "../backups/schedule";

export type SweepSchedulerDeps = {
  detector: { sweep(projectId: string): Promise<unknown> };
  projects(): string[];
  timers?: ScheduleTimers;
  log(line: string): void;
};

export type SweepScheduler = {
  start(): void;
  stop(): void;
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
  const running = new Set<string>();
  let cancel: (() => void) | null = null;

  const sweep = (projectId: string | null): void => {
    if (!projectId || running.has(projectId)) return;
    running.add(projectId);
    new Promise((resolve) => resolve(deps.detector.sweep(projectId)))
      .catch((e: unknown) => deps.log(`overlaps: sweep of ${projectId} failed: ${String(e)}`))
      .finally(() => running.delete(projectId));
  };

  const sweepAll = (): void => {
    for (const projectId of deps.projects()) sweep(projectId);
  };

  return {
    start() {
      cancel ??= timers.every(sweepAll, DUPLICATION_LIMITS.sweepMs);
    },
    stop() {
      cancel?.();
      cancel = null;
    },
    onSpawned(run, workspaces) {
      if (workspaces >= 2) sweep(run.projectId);
    },
    onTurnEnd: (run) => sweep(run.projectId),
  };
}
