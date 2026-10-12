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
import { type ReminderDeps, withReminders } from "../agents/reminders";
import { runGit } from "../agents/workspace-prep";
import { type AgentsPort, withRunProgress } from "../agents-rpc";
import type { Docs } from "../docs";
import { agentMcpSink } from "../progress/agent-mcp";
import type { TicketToolServices } from "../progress/mcp";
import { createProgressService, type ProgressDocs, type ProgressService } from "../progress/service";
import type { AgentMcpSink } from "../project-agent/types";
import type { RpcExtension } from "../rpc-extensions";
import type { SignalService } from "../signals/service";
import { skillTargetOf } from "../skills/bootstrap";
import { withSkillUses } from "../skills/hook-uses";
import { createSkillReviews, type SkillReviews } from "../skills/reviews";
import { openSkillReviewStore } from "../skills/reviews-store";
import { openRunsDatabase } from "../skills/runs-db";
import type { SkillsService } from "../skills/service";
import { createSkillUses, type SkillUses } from "../skills/uses-store";
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
export type OverlapReminders = Required<Pick<ReminderDeps, "openDeliveredOverlaps">>;
export type VisibilityDocs = Pick<Docs, "emit" | "run" | "project" | "projectIds">;
export type VisibilityAgents = () => Pick<Orchestrator, "state" | "hooks"> | null;
export type VisibilitySkills = () => Pick<SkillsService, "byId"> | null;
export type Visibility = {
  trace: TraceService;
  progress: ProgressService;
  rpc: RpcExtension;
  hooks(sink: HookSink, overlaps: OverlapReminders): HookSink;
  mcp(
    project: AgentMcpSink,
    signals: Pick<SignalService, "record">,
    peek: TicketToolServices["peek"],
  ): AgentMcpSink;
  agents(port: AgentsPort): AgentsPort;
  lifecycle: { onSpawned(run: RunView): Promise<void>; onTurnEnd(run: RunView): Promise<void> };
  peek(projectId: string, runId: string): RunPeek;
  skills: { uses: SkillUses; reviews: SkillReviews };
  close(): void;
};

const METHODS = VISIBILITY_RPC.map((schema) => schema.shape.method.value);

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
  skills: VisibilitySkills = () => null,
): Visibility {
  const env = opts.agentEnv ?? process.env;
  const store = openMomentStore(opts.home);
  const uses = createSkillUses(openRunsDatabase(opts.home, "skill use"));
  const reviews = createSkillReviews({
    store: openSkillReviewStore(opts.home),
    uses,
    skillPath: skillTargetOf(skills),
    emit: (topic) => docs.emit({ topic }),
  });
  const trace = createTraceService({
    store,
    root: opts.transcriptRoot ?? transcriptRootOf(env, opts.userHome ?? homedir()),
    now: Date.now,
    emit: (event: RunMomentsEvent) => docs.emit(event),
    onActions: (runId, actions, at) => uses.record(runId, actions, at),
  });
  const progress = createProgressService({
    docs: progressDocs(docs),
    git: runGit,
    trace,
    runs: () => agents()?.state().runs ?? [],
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
    hooks(sink, overlaps) {
      const reminded = withReminders(sink, {
        ...overlaps,
        run,
        hasPlan: (r) => progress.hasPlan(r),
        hasReport: (r) => progress.hasReport(r),
        usedSkills: (runId) => uses.byRun(runId).length,
        hasSkillReview: (runId) => reviews.hasReview(runId),
        moment: (runId, kind) => trace.note(runId, { kind: "reminder", reminder: kind }),
      });
      forgets.push((runId) => reminded.forget(runId));
      return withTrace(withSkillUses(reminded, uses), { trace, run });
    },
    mcp: (project, signals, peek) =>
      agentMcpSink({
        project,
        peek,
        run,
        progress,
        signals,
        reviews,
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
    skills: { uses, reviews },
    close() {
      store.close();
      uses.close();
      reviews.store.close();
    },
  };
}
