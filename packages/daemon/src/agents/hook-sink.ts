import type { HookSink } from "./hook-route";
import type { TaskSpec } from "./orchestrator-types";
import type { LiveRun } from "./run-launch";
import type { RunRegistry } from "./run-registry";
import { sameRunToken } from "./run-token";

export type HookSinkDeps = {
  live: Map<string, LiveRun>;
  tasks: Map<string, TaskSpec>;
  registry: RunRegistry;
};

export function createHookSink({ live, tasks, registry }: HookSinkDeps): HookSink {
  return {
    verify(runId, token) {
      const entry = live.get(runId);
      return entry !== undefined && sameRunToken(token, entry.hash);
    },
    receive(runId, payload, toolInput) {
      registry.apply(runId, { type: "hook", payload });
      const guard = tasks.get(runId)?.guard;
      if (!guard || payload.event !== "PreToolUse") return null;
      try {
        return guard({ tool: payload.tool ?? "", input: toolInput ?? null });
      } catch (e) {
        console.error(`[kibo-daemon] guard of run ${runId} failed, denying`, e);
        return { decision: "deny", reason: "guard error" };
      }
    },
  };
}
