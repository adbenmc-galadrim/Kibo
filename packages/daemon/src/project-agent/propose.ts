import {
  type BatchContext,
  registeredText,
  renderProblems,
  validateBatch,
} from "@kibo/core/project-agent/validate";
import { KiboError, ProposeBatchInput, type RunView } from "@kibo/schema";
import { batchNotice } from "../agents/notifier";
import { guarded } from "../agents/orchestrator-support";
import type { AgentContext } from "./context";
import { projectOfRun } from "./sessions";

function batchContext(ctx: AgentContext, run: RunView, projectId: string): BatchContext {
  const notes = ctx.turnNotes.get(run.id);
  if (!notes) throw new KiboError("CONFLICT", `run ${run.id} has no prepared turn`);
  return {
    project: ctx.data.project(projectId),
    runs: ctx.agents().state().runs,
    notes,
    profiles: ctx.data.profiles(),
    demoProject: ctx.data.isDemoProject(projectId),
    viewer: ctx.data.viewer(projectId),
  };
}

export function proposeBatch(ctx: AgentContext, run: RunView, input: unknown): string {
  const projectId = projectOfRun(run);
  const parsed = ProposeBatchInput.safeParse(input);
  if (!parsed.success) throw new KiboError("INVALID_INPUT", parsed.error.message);
  if (ctx.store.openSession(projectId)?.runId !== run.id)
    throw new KiboError("CONFLICT", `run ${run.id} is not the open project agent session`);
  const batchCtx = batchContext(ctx, run, projectId);
  const validation = validateBatch(parsed.data, batchCtx);
  if (!validation.ok) throw new KiboError("INVALID_INPUT", renderProblems(validation.problems));
  const at = ctx.now();
  const previous = ctx.store.pendingBatch(projectId);
  if (previous) ctx.store.appendBatchEvent(previous.id, { type: "superseded" }, at);
  const batch = ctx.store.createBatch({
    id: crypto.randomUUID(),
    projectId,
    runId: run.id,
    sessionId: run.sessionId,
    summary: parsed.data.summary,
    actions: validation.batch.actions,
    expected: validation.batch.expected,
    createdAt: at,
  });
  guarded("batch notification", () => ctx.notify(batchNotice(ctx.data.projectName(projectId), batch)));
  ctx.emit();
  return registeredText(batch, batchCtx.viewer);
}
