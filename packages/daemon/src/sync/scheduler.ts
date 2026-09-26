import type { EventLog } from "../integrations/events";
import type { SyncEngine } from "./engine";

export function startSyncScheduler(engine: SyncEngine, events: EventLog, intervalMs = 60_000) {
  const timers = new Map<string, ReturnType<typeof setTimeout>>();
  const report = (e: unknown) =>
    events.log("github-issues", "error", e instanceof Error ? e.message : String(e));
  const tick = () => {
    for (const { projectId, bindingId } of engine.runnable())
      engine.cycle(projectId, bindingId).catch(() => undefined);
  };
  const interval = setInterval(tick, intervalMs);
  return {
    kick(projectId: string, bindingId: string) {
      clearTimeout(timers.get(bindingId));
      timers.set(
        bindingId,
        setTimeout(() => {
          timers.delete(bindingId);
          engine.flush(projectId, bindingId).catch(report);
        }, 1_000),
      );
    },
    stop() {
      clearInterval(interval);
      for (const t of timers.values()) clearTimeout(t);
    },
  };
}
