import { ASK_TOOLS, type GuardDecision, type HookPayload, type Question, type RunView } from "@kibo/schema";
import { demoRunGuard } from "./demo-guard";
import type { HookSink } from "./hook-route";
import type { AgentDataPort, TaskSpec, ToolGuard } from "./orchestrator-types";
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

export type QuestionHookDeps = {
  runOf(runId: string): RunView | null;
  data: Pick<AgentDataPort, "createQuestion">;
  onQuestion: (run: RunView, question: Question) => void;
};

const ignored = (runId: string, reason: string) =>
  console.warn(`[kibo-daemon] run ${runId} : question ignorée : ${reason}`);

type Recorded = { run: RunView; question: Question };

function recordQuestion(deps: QuestionHookDeps, runId: string, payload: HookPayload): Recorded | null {
  if (payload.ask === null) {
    if (ASK_TOOLS.includes(payload.tool ?? "")) ignored(runId, "entrée invalide");
    return null;
  }
  const run = deps.runOf(runId);
  if (!run?.projectId || !run.ticketId) {
    ignored(runId, "run sans ticket");
    return null;
  }
  const author = { id: run.id, profileName: run.profileName };
  const question = deps.data.createQuestion(run.projectId, run.ticketId, author, payload.ask);
  if (question) return { run, question };
  ignored(runId, "trop de questions ouvertes");
  return null;
}

export function withAgentQuestions(sink: HookSink, deps: QuestionHookDeps): HookSink {
  const notified = new Set<string>();
  const record = (runId: string, payload: HookPayload) => {
    try {
      const recorded = recordQuestion(deps, runId, payload);
      if (!recorded || notified.has(recorded.question.id)) return;
      notified.add(recorded.question.id);
      deps.onQuestion(recorded.run, recorded.question);
    } catch (e) {
      console.error(`[kibo-daemon] question of run ${runId} failed`, e);
    }
  };
  return {
    verify: (runId, token) => sink.verify(runId, token),
    receive(runId, payload, toolInput) {
      const decision = sink.receive(runId, payload, toolInput);
      if (payload.event === "PostToolUse") record(runId, payload);
      return decision;
    },
  };
}
