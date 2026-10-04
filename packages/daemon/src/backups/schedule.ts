import { BACKUP_EVERY_MS } from "@kibo/schema";
import type { BackupsService } from "./service";

export type ScheduleTimers = { every(fn: () => void, ms: number): () => void };

const SYSTEM_TIMERS: ScheduleTimers = {
  every(fn, ms) {
    const timer = setInterval(fn, ms);
    timer.unref();
    return () => clearInterval(timer);
  },
};

export function isBackupDue(last: number | null, now: number, every: number = BACKUP_EVERY_MS): boolean {
  return last === null || now - last >= every;
}

export function startBackupSchedule(
  service: Pick<BackupsService, "tick">,
  opts: { intervalMs: number; log(message: string, error: unknown): void; timers?: ScheduleTimers },
): () => Promise<void> {
  const timers = opts.timers ?? SYSTEM_TIMERS;
  let pending: Promise<void> | null = null;
  const run = () => {
    if (pending) return;
    pending = service
      .tick()
      .catch((e: unknown) => opts.log("backups: scheduled backup failed", e))
      .finally(() => {
        pending = null;
      });
  };
  run();
  const cancel = timers.every(run, opts.intervalMs);
  return async () => {
    cancel();
    if (pending) await pending;
  };
}
