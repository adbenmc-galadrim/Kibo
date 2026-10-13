import type { RunView } from "@kibo/schema";
import type { LiveRun } from "./run-launch";
import { notifyLifecycle, type RunLifecycle } from "./run-lifecycle";
import type { RunRegistry } from "./run-registry";

const IDLE_STATES: ReadonlySet<string> = new Set(["queued", "waiting_input"]);

export type CancelDeps = {
  registry: Pick<RunRegistry, "get" | "apply">;
  live: ReadonlyMap<string, Pick<LiveRun, "proc">>;
  tick(): void;
  onEndedWithoutTurn?: RunLifecycle;
};

export function cancelRun(deps: CancelDeps, runId: string): RunView {
  const { registry } = deps;
  const idle = IDLE_STATES.has(registry.get(runId).state);
  const cancelled = registry.apply(runId, { type: "cancelled" });
  deps.live.get(runId)?.proc.kill();
  deps.tick();
  if (idle) notifyLifecycle("no turn end hook", deps.onEndedWithoutTurn, cancelled);
  return registry.get(runId);
}
