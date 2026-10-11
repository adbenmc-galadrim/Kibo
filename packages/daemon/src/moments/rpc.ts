import {
  isVisibilityRequest,
  KiboError,
  type RpcRequest,
  type RunProgressSummary,
  type RunView,
  type VisibilityRpcRequest,
  type VisibilityRpcResult,
} from "@kibo/schema";
import type { TraceService } from "./trace-service";

export type VisibilityAgents = {
  run(runId: string): RunView | null;
  progress(runId: string): RunProgressSummary | null;
};

function runOf(agents: VisibilityAgents, runId: string): RunView {
  const run = agents.run(runId);
  if (!run) throw new KiboError("NOT_FOUND", `run ${runId} does not exist`);
  return run;
}

const isVisibility = (req: RpcRequest): req is RpcRequest & VisibilityRpcRequest => isVisibilityRequest(req);

export function handleVisibilityRequest(
  trace: Pick<TraceService, "page" | "peek">,
  agents: VisibilityAgents,
  req: RpcRequest,
): VisibilityRpcResult[VisibilityRpcRequest["method"]] {
  if (!isVisibility(req)) throw new KiboError("INTERNAL", `${req.method} is not a visibility method`);
  const run = runOf(agents, req.runId);
  if (req.method === "runMoments") return trace.page(run.id, req.after);
  return trace.peek(run, agents.progress(run.id));
}
