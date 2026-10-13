import { guidelineChain } from "@kibo/core/context";
import {
  type Agent,
  branchRefOf,
  KiboError,
  type RunView,
  type SetupStep,
  undeliveredAnswers,
} from "@kibo/schema";
import type { OrchestratorOptions, TaskSpec } from "./orchestrator-types";
import { PROJECT_WORKSPACE_LABEL } from "./project-run";
import type { createTurnPreparer, PreparedTurn } from "./run-prepare";
import { prepareWorkspace } from "./workspace-prep";

export type Prepared = {
  turn: PreparedTurn;
  cwd: string;
  label: string;
  guidelines: number;
  answers: string[];
  mentions: (text: string) => string;
};

type RunTurnsDeps = {
  opts: OrchestratorOptions;
  preparer: ReturnType<typeof createTurnPreparer>;
  journalSetup: (runId: string, step: SetupStep) => void;
};

export function createRunTurns(deps: RunTurnsDeps) {
  async function ticket(run: RunView, agent: Agent, runDir: string): Promise<Prepared> {
    if (!run.projectId || !run.ticketId) throw new KiboError("INVALID_INPUT", `run ${run.id} has no ticket`);
    const ctx = deps.opts.data.ticketContext(run.projectId, run.ticketId);
    if (ctx.ticket.key === null)
      throw new KiboError("INVALID_INPUT", `ticket ${ctx.ticket.id} has no key yet`);
    const workspace = await prepareWorkspace({
      strategy: agent.settings.workspace,
      projectFolder: ctx.project.meta.folder,
      ticketKey: ctx.ticket.key,
      runDir,
      worktree: ctx.project.meta.worktree,
      branchRef: branchRefOf(ctx.ticket.externalRefs),
      onSetup: (step) => deps.journalSetup(run.id, step),
    });
    const chain = guidelineChain(deps.opts.data.guidelines(run.projectId), {
      projectId: run.projectId,
      domainId: ctx.ticket.domainId,
    });
    const mentions = deps.preparer.skillMentions(run.projectId);
    const work = run.turns === 0 ? ((await deps.opts.turnPrefix?.briefSection(run)) ?? null) : null;
    const turn = deps.preparer.prepare(run, runDir, {
      kind: "ticket",
      brief: { ...ctx, note: mentions(run.brief), commits: workspace.commits, work },
      chain,
      recipients: ctx.project.questionRecipients,
    });
    return {
      turn,
      cwd: workspace.cwd,
      label: workspace.label,
      guidelines: chain.length,
      answers: undeliveredAnswers(ctx.project.questions, ctx.ticket.id).map((q) => q.id),
      mentions,
    };
  }

  function task(run: RunView, task: TaskSpec, runDir: string): Prepared {
    const turn = deps.preparer.prepare(run, runDir, { kind: "task", brief: run.brief });
    const mentions = deps.preparer.skillMentions(run.projectId);
    return { turn, cwd: task.cwd, label: task.cwd, guidelines: 0, answers: [], mentions };
  }

  async function project(run: RunView, runDir: string): Promise<Prepared> {
    const mentions = deps.preparer.skillMentions(run.projectId);
    const pendingAnswer = run.pendingAnswer === null ? null : mentions(run.pendingAnswer);
    const project = await deps.opts.projectTurns.prepare({ ...run, pendingAnswer }, runDir);
    const turn = deps.preparer.prepare(run, runDir, {
      kind: "project",
      systemPrompt: project.systemPrompt,
      brief: project.prompt,
    });
    return { turn, cwd: project.cwd, label: PROJECT_WORKSPACE_LABEL, guidelines: 0, answers: [], mentions };
  }

  return { ticket, task, project };
}
