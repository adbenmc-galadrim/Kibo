import { KiboError, type RunMomentsPage, type RunSubagent, type SubagentRpcRequest } from "@kibo/schema";
import type { TraceService } from "../moments/trace-service";
import type { SubagentStore } from "./store";

export type SubagentRpcDeps = {
  store: Pick<SubagentStore, "list" | "find">;
  trace: Pick<TraceService, "subagentPage">;
  run(runId: string): { id: string } | null;
};

function knownRun(deps: SubagentRpcDeps, runId: string): string {
  const run = deps.run(runId);
  if (run === null) throw new KiboError("NOT_FOUND", `run ${runId} does not exist`);
  return run.id;
}

export function handleSubagentRequest(
  deps: SubagentRpcDeps,
  req: SubagentRpcRequest,
): RunSubagent[] | RunMomentsPage {
  const runId = knownRun(deps, req.runId);
  if (req.method === "runs.subagents") return deps.store.list(runId);
  const subagent = deps.store.find(req.subagentId);
  if (subagent?.runId !== runId)
    throw new KiboError("NOT_FOUND", `subagent ${req.subagentId} of run ${runId} does not exist`);
  return deps.trace.subagentPage(runId, subagent.id, req.after);
}
