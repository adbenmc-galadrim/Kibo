import type { RunView } from "@kibo/schema";

export const IDLE_STATES: ReadonlySet<string> = new Set(["queued", "waiting_input"]);

export type RunLifecycle = (run: RunView) => Promise<void>;

export function notifyLifecycle(what: string, hook: RunLifecycle | undefined, run: RunView): void {
  if (!hook) return;
  Promise.resolve()
    .then(() => hook(run))
    .catch((e: unknown) => console.error(`[kibo-daemon] ${what} of run ${run.id} failed`, e));
}
