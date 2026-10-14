import {
  isSubagentRequest,
  isTerminal,
  KiboError,
  type RunView,
  SUBAGENT_RPC,
  type SubagentRpcRequest,
  summarizeSubagent,
} from "@kibo/schema";
import type { AgentsPort } from "../agents-rpc";
import type { MomentStore } from "../moments/store";
import type { TraceService } from "../moments/trace-service";
import type { RpcExtension } from "../rpc-extensions";
import { handleSubagentRequest } from "./rpc";
import { createSubagentSources, type SubagentSources } from "./sources";
import { openSubagentStore } from "./store";
import { isAgentId, subagentTracePath } from "./trace";
import { createSubagentTracker, type SubagentTracker } from "./tracker";

export type SubagentsOptions = {
  home: string;
  root: string;
  moments: Pick<MomentStore, "subagentFacts">;
  traces: () => Pick<TraceService, "mark" | "subagentPage"> | null;
  runs: (runId: string) => RunView | null;
  now?: () => number;
  changed?: (runId: string) => void;
};
export type Subagents = {
  port: SubagentSources;
  tracker: SubagentTracker;
  hooks: Pick<SubagentTracker, "onHook">;
  rpc: RpcExtension;
  agents(port: AgentsPort): AgentsPort;
  onRunEnded(runId: string): void;
  close(): void;
};

const METHODS = SUBAGENT_RPC.map((schema) => schema.shape.method.value);

function transcriptOf(run: RunView | null, agentId: string): string | null {
  if (run === null || run.transcriptPath === null) return null;
  if (!isAgentId(agentId) || !isAgentId(run.sessionId)) return null;
  return subagentTracePath({ transcriptPath: run.transcriptPath, sessionId: run.sessionId, agentId });
}

function traceOf(opts: SubagentsOptions): Pick<TraceService, "mark" | "subagentPage"> {
  const trace = opts.traces();
  if (trace === null) throw new KiboError("INTERNAL", "run traces are not started");
  return trace;
}

export function startSubagents(opts: SubagentsOptions): Subagents {
  const now = opts.now ?? Date.now;
  const store = openSubagentStore(opts.home, (runId, id) => opts.moments.subagentFacts(runId, id));
  const tracker = createSubagentTracker({
    store,
    now,
    transcriptOf: (runId, agentId) => transcriptOf(opts.runs(runId), agentId),
    announce: (runId, moment) => traceOf(opts).mark(runId, moment),
    ...(opts.changed === undefined ? {} : { changed: opts.changed }),
  });
  const port = createSubagentSources({ store, tracker, root: opts.root, now });
  const isRequest = (req: { method: string }): req is SubagentRpcRequest => isSubagentRequest(req);
  return {
    port,
    tracker,
    hooks: tracker,
    rpc: {
      methods: METHODS,
      async handle(req) {
        if (!isRequest(req)) throw new KiboError("INTERNAL", `${req.method} is not a subagent method`);
        return handleSubagentRequest({ store, trace: traceOf(opts), run: opts.runs }, req);
      },
    },
    agents: (agents) => ({
      ...agents,
      state() {
        const state = agents.state();
        const active = state.runs.filter((r) => !isTerminal(r.state));
        return { ...state, subagents: active.flatMap((r) => tracker.active(r.id).map(summarizeSubagent)) };
      },
    }),
    onRunEnded(runId) {
      tracker.closeRun(runId);
      port.forget(runId);
    },
    close: () => store.close(),
  };
}
