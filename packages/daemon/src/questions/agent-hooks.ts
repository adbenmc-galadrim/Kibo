import type { AgentsState } from "@kibo/schema";
import type { HookSink } from "../agents/hook-route";
import { type QuestionHookDeps, withAgentQuestions } from "../agents/hook-sink";
import { type Notice, questionNotice } from "../agents/notifier";

type AgentHooks = { hooks: HookSink; state(): Pick<AgentsState, "runs"> };

export function agentQuestionHooks(
  agents: () => AgentHooks | null,
  data: QuestionHookDeps["data"],
  notify: (notice: Notice) => void,
): HookSink {
  return withAgentQuestions(
    {
      verify: (runId, token) => agents()?.hooks.verify(runId, token) ?? false,
      receive: (runId, payload, toolInput) => agents()?.hooks.receive(runId, payload, toolInput) ?? null,
    },
    {
      runOf: (runId) =>
        agents()
          ?.state()
          .runs.find((r) => r.id === runId) ?? null,
      data,
      onQuestion(run, question) {
        const notice = questionNotice(run, question);
        if (notice) notify(notice);
      },
    },
  );
}
