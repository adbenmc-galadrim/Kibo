import { homedir } from "node:os";
import { readProject } from "@kibo/core";
import {
  isTerminal,
  KiboError,
  type RunMomentsEvent,
  type RunPeek,
  type RunView,
  VISIBILITY_RPC,
} from "@kibo/schema";
import type { HookSink } from "../agents/hook-route";
import type { Orchestrator } from "../agents/orchestrator-types";
import { withReminders } from "../agents/reminders";
import { runGit } from "../agents/workspace-prep";
import { type AgentsPort, withRunProgress } from "../agents-rpc";
import type { Docs } from "../docs";
import { agentMcpSink } from "../progress/agent-mcp";
import { createProgressService, type ProgressDocs, type ProgressService } from "../progress/service";
import type { AgentMcpSink } from "../project-agent/types";
import type { RpcExtension } from "../rpc-extensions";
import type { SignalService } from "../signals/service";
import { withTrace } from "./hooks";
import { handleVisibilityRequest } from "./rpc";
import { openMomentStore } from "./store";
import { createTraceService, type TraceService } from "./trace-service";
import { transcriptRootOf } from "./transcript-path";

export type VisibilityOptions = {
  home: string;
  transcriptRoot?: string;
  agentEnv?: Record<string, string | undefined>;
  userHome?: string;
};
export type VisibilityDocs = Pick<Docs, "emit" | "run" | "project" | "projectIds">;
export type VisibilityAgents = () => Pick<Orchestrator, "state" | "hooks"> | null;
export type Visibility = {
  trace: TraceService;
  progress: ProgressService;
  rpc: RpcExtension;
  hooks(sink: HookSink): HookSink;
  mcp(project: AgentMcpSink, signals?: SignalRecorder): AgentMcpSink;
  agents(port: AgentsPort): AgentsPort;
  lifecycle: { onSpawned(run: RunView): Promise<void>; onTurnEnd(run: RunView): Promise<void> };
  peek(projectId: string, runId: string): RunPeek;
  close(): void;
};

const METHODS = VISIBILITY_RPC.map((schema) => schema.shape.method.value);

type SignalRecorder = Pick<SignalService, "record">;
const UNWIRED_SIGNALS: SignalRecorder = {
  record: () => Promise.reject(new KiboError("INTERNAL", "signals are not wired")),
};

function progressDocs(docs: VisibilityDocs): ProgressDocs {
  return {
    snapshot: (projectId) =>
      docs.projectIds().includes(projectId) ? readProject(docs.project(projectId)) : { tickets: [] },
    run: (projectId, cmd, meta) => docs.run(projectId, cmd, meta),
  };
}

export function startVisibility(
  opts: VisibilityOptions,
  docs: VisibilityDocs,
  agents: VisibilityAgents,
): Visibility {
  const env = opts.agentEnv ?? process.env;
  const store = openMomentStore(opts.home);
  const trace = createTraceService({
    store,
    root: opts.transcriptRoot ?? transcriptRootOf(env, opts.userHome ?? homedir()),
    now: Date.now,
    emit: (event: RunMomentsEvent) => docs.emit(event),
  });
  const progress = createProgressService({
    docs: progressDocs(docs),
    git: runGit,
    trace,
    now: Date.now,
    changed: () => docs.emit({ topic: "agents" }),
  });
  const run = (runId: string): RunView | null =>
    agents()
      ?.state()
      .runs.find((r) => r.id === runId) ?? null;
  const forgets: ((runId: string) => void)[] = [];
  const summary = (runId: string) => {
    const found = run(runId);
    return found && progress.summary(found);
  };
  return {
    trace,
    progress,
    rpc: {
      methods: METHODS,
      handle: async (req) => handleVisibilityRequest(trace, { run, progress: summary }, req),
    },
    hooks(sink) {
      const reminded = withReminders(sink, {
        run,
        hasPlan: (r) => progress.hasPlan(r),
        hasReport: (r) => progress.hasReport(r),
        moment: (runId, kind) => trace.note(runId, { kind: "reminder", reminder: kind }),
      });
      forgets.push((runId) => reminded.forget(runId));
      return withTrace(reminded, { trace, run });
    },
    mcp: (project, signals = UNWIRED_SIGNALS) =>
      agentMcpSink({
        project,
        run,
        progress,
        signals,
        live: (runId, token) => agents()?.hooks.verify(runId, token) ?? false,
      }),
    agents: (port) => withRunProgress(port, progress),
    lifecycle: {
      onSpawned: (r) => progress.onSpawned(r),
      async onTurnEnd(r) {
        try {
          await progress.onTurnEnd(r);
        } finally {
          await trace.onTurnEnd(r);
          if (isTerminal(r.state)) for (const forget of forgets) forget(r.id);
        }
      },
    },
    peek(projectId, runId) {
      const found = run(runId);
      if (found?.projectId !== projectId) throw new KiboError("NOT_FOUND", `run ${runId} not found`);
      return trace.peek(found, progress.summary(found));
    },
    close: () => store.close(),
  };
}
