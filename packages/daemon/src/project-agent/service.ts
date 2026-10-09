import {
  type AgentMcpRequest,
  type Batch,
  isTerminal,
  KiboError,
  MEMORY_NOTE_PATH,
  type ProjectAgentSummary,
  type ProjectAgentView,
  type ProjectFingerprint,
  type RunView,
} from "@kibo/schema";
import type { ProjectTurnPort } from "../agents/orchestrator-types";
import type { RpcExtension } from "../rpc-extensions";
import type { AgentContext, ProjectAgentDeps } from "./context";
import { type DecideInput, decideBatch } from "./decide";
import { proposeBatch } from "./propose";
import { projectAgentRpc } from "./rpc";
import { currentRun, pastSessions, projectOfRun, summaryOf } from "./sessions";
import { createTurnPort } from "./turns";
import type { AgentMcpSink } from "./types";

export type { ProjectAgentAgents, ProjectAgentDeps } from "./context";

export type ProjectAgentService = {
  view(projectId: string, runId?: string): ProjectAgentView;
  send(projectId: string, text: string): RunView;
  decide(input: DecideInput): Promise<Batch>;
  reset(projectId: string): ProjectAgentView;
  summaries(): ProjectAgentSummary[];
  baseline(runId: string): ProjectFingerprint | null;
  propose(run: RunView, input: unknown): string;
  turns: ProjectTurnPort;
  mcp: AgentMcpSink;
  rpc: RpcExtension;
};
export type ProjectAgentCore = Omit<ProjectAgentService, "rpc">;

function view(ctx: AgentContext, projectId: string, runId?: string): ProjectAgentView {
  ctx.data.assertWritable(projectId);
  const sessions = ctx.store.sessions(projectId);
  const session =
    runId === undefined ? ctx.store.openSession(projectId) : sessions.find((s) => s.runId === runId);
  if (session === undefined) throw new KiboError("NOT_FOUND", `project agent session ${runId} not found`);
  return {
    session,
    run: currentRun(session, ctx.agents().state().runs),
    batches: session ? ctx.store.batches(session.runId) : [],
    past: pastSessions(sessions),
    memoryPath: MEMORY_NOTE_PATH,
  };
}

function send(ctx: AgentContext, projectId: string, text: string): RunView {
  ctx.data.assertWritable(projectId);
  const open = ctx.store.openSession(projectId);
  if (open) {
    const answered = ctx.agents().answer(open.runId, text);
    ctx.emit();
    return answered;
  }
  const run = ctx.agents().startProjectRun({ projectId, projectName: ctx.data.projectName(projectId), text });
  ctx.store.startSession({ projectId, runId: run.id, sessionId: run.sessionId, startedAt: ctx.now() });
  ctx.emit();
  return run;
}

function reset(ctx: AgentContext, projectId: string): ProjectAgentView {
  ctx.data.assertWritable(projectId);
  const open = ctx.store.openSession(projectId);
  if (open) {
    const at = ctx.now();
    const pending = ctx.store.pendingBatch(projectId);
    if (pending) ctx.store.appendBatchEvent(pending.id, { type: "abandoned" }, at);
    const run = currentRun(open, ctx.agents().state().runs);
    if (run && !isTerminal(run.state)) ctx.agents().cancel(run.id);
    ctx.store.closeSession(open.runId, at);
    ctx.turnNotes.delete(open.runId);
    ctx.baselines.delete(open.runId);
    ctx.emit();
  }
  return view(ctx, projectId);
}

function summaries(ctx: AgentContext): ProjectAgentSummary[] {
  const open = ctx.store.openSessions();
  if (open.length === 0) return [];
  const { runs } = ctx.agents().state();
  return open.flatMap((s) => summaryOf(s, runs, ctx.store.pendingBatch(s.projectId)?.id ?? null) ?? []);
}

function projectRun(ctx: AgentContext, runId: string): RunView {
  const run = ctx
    .agents()
    .state()
    .runs.find((r) => r.id === runId);
  if (!run) throw new KiboError("NOT_FOUND", `run ${runId} not found`);
  projectOfRun(run);
  return run;
}

function mcpSink(ctx: AgentContext): AgentMcpSink {
  return {
    verify(runId, token) {
      if (!ctx.agents().hooks.verify(runId, token)) return false;
      projectRun(ctx, runId);
      return true;
    },
    call: async (runId, req: AgentMcpRequest) => ctx.ops.tool(projectRun(ctx, runId), req.tool, req.input),
  };
}

export function createProjectAgentService(deps: ProjectAgentDeps): ProjectAgentService {
  const ctx: AgentContext = {
    ...deps,
    now: deps.now ?? Date.now,
    turnNotes: new Map(),
    baselines: new Map(),
  };
  const core: ProjectAgentCore = {
    view: (projectId, runId) => view(ctx, projectId, runId),
    send: (projectId, text) => send(ctx, projectId, text),
    decide: (input) => decideBatch(ctx, input, (projectId, text) => send(ctx, projectId, text)),
    reset: (projectId) => reset(ctx, projectId),
    summaries: () => summaries(ctx),
    baseline: (runId) => ctx.baselines.get(runId) ?? ctx.store.fingerprint(runId),
    propose: (run, input) => proposeBatch(ctx, run, input),
    turns: createTurnPort(ctx),
    mcp: mcpSink(ctx),
  };
  return { ...core, rpc: projectAgentRpc(core) };
}
