import type { RunView } from "@kibo/schema";
import type { AgentMcpSink } from "../project-agent/types";
import type { SignalService } from "../signals/service";
import { handleTicketTool } from "./mcp";
import type { ProgressService } from "./service";

export type AgentMcpDeps = {
  project: AgentMcpSink;
  live(runId: string, token: string): boolean;
  run(runId: string): RunView | null;
  progress: Pick<ProgressService, "record">;
  signals: Pick<SignalService, "record">;
};

export function agentMcpSink(deps: AgentMcpDeps): AgentMcpSink {
  const services = { progress: deps.progress, signals: deps.signals };
  return {
    verify(runId, token) {
      const run = deps.run(runId);
      if (run === null) return false;
      return run.kind === "ticket" ? deps.live(runId, token) : deps.project.verify(runId, token);
    },
    run: (runId) => deps.run(runId),
    call: (run, tool, input) =>
      run.kind === "ticket"
        ? handleTicketTool(services, run, tool, input)
        : deps.project.call(run, tool, input),
  };
}
