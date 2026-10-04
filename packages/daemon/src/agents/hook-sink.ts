import type { GuardDecision } from "@kibo/schema";
import { demoRunGuard } from "./demo-guard";
import type { HookSink } from "./hook-route";
import type { TaskSpec, ToolGuard } from "./orchestrator-types";
import type { LiveRun } from "./run-launch";
import type { RunRegistry } from "./run-registry";
import { sameRunToken } from "./run-token";

export type HookSinkDeps = {
  live: Map<string, LiveRun>;
  tasks: Map<string, TaskSpec>;
  registry: RunRegistry;
};

function decide(runId: string, guard: ToolGuard, call: Parameters<ToolGuard>[0]): GuardDecision | null {
  try {
    return guard(call);
  } catch (e) {
    console.error(`[kibo-daemon] guard of run ${runId} failed, denying`, e);
    return { decision: "deny", reason: "guard error" };
  }
}

export function createHookSink({ live, tasks, registry }: HookSinkDeps): HookSink {
  return {
    verify(runId, token) {
      const entry = live.get(runId);
      return entry !== undefined && sameRunToken(token, entry.hash);
    },
    receive(runId, payload, toolInput) {
      registry.apply(runId, { type: "hook", payload });
      if (payload.event !== "PreToolUse") return null;
      const call = { tool: payload.tool ?? "", input: toolInput ?? null };
      const decisions = [
        tasks.get(runId)?.guard,
        (c: Parameters<ToolGuard>[0]) => demoRunGuard(registry.get(runId))?.(c) ?? null,
      ].flatMap((guard) => (guard ? [decide(runId, guard, call)] : []));
      return decisions.find((d) => d?.decision === "deny") ?? decisions.find((d) => d !== null) ?? null;
    },
  };
}
