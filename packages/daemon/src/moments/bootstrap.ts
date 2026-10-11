import { homedir } from "node:os";
import { type RunMomentsEvent, type RunView, VISIBILITY_RPC } from "@kibo/schema";
import type { HookSink } from "../agents/hook-route";
import type { RpcExtension } from "../rpc-extensions";
import { withTrace } from "./hooks";
import { handleVisibilityRequest } from "./rpc";
import { openMomentStore } from "./store";
import { createTraceService, type TraceService } from "./trace-service";
import { transcriptRootOf } from "./transcript-path";

export type RunTraceDeps = {
  home: string;
  root: string;
  emit(event: RunMomentsEvent): void;
  runs(): readonly RunView[];
};
export type RunTraceWiring = {
  trace: TraceService;
  rpc: RpcExtension;
  hooks(sink: HookSink): HookSink;
  close(): void;
};

const METHODS = VISIBILITY_RPC.map((schema) => schema.shape.method.value);

export function startRunTrace(deps: RunTraceDeps): RunTraceWiring {
  const store = openMomentStore(deps.home);
  const trace = createTraceService({ store, root: deps.root, now: Date.now, emit: deps.emit });
  const run = (runId: string): RunView | null => deps.runs().find((r) => r.id === runId) ?? null;
  return {
    trace,
    rpc: {
      methods: METHODS,
      handle: async (req) => handleVisibilityRequest(trace, { run, progress: () => null }, req),
    },
    hooks: (sink) => withTrace(sink, { trace, run }),
    close: () => store.close(),
  };
}

export type RunTraceOptions = {
  home: string;
  transcriptRoot?: string;
  agentEnv?: Record<string, string | undefined>;
  userHome?: string;
};

export function startRunTraceFor(
  opts: RunTraceOptions,
  docs: { emit(event: RunMomentsEvent): void },
  agents: () => { state(): { runs: readonly RunView[] } } | null,
): RunTraceWiring {
  const env = opts.agentEnv ?? process.env;
  return startRunTrace({
    home: opts.home,
    root: opts.transcriptRoot ?? transcriptRootOf(env, opts.userHome ?? homedir()),
    emit: (event) => docs.emit(event),
    runs: () => agents()?.state().runs ?? [],
  });
}
