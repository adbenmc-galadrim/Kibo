import { KiboError, type ProjectAgentSession, type ProjectAgentSummary, type RunView } from "@kibo/schema";

export const currentRun = (session: ProjectAgentSession | null, runs: readonly RunView[]): RunView | null =>
  session ? (runs.find((r) => r.id === session.runId) ?? null) : null;

export const memoryText = (content: string | null): string => content ?? "";

export const pastSessions = (sessions: readonly ProjectAgentSession[]): ProjectAgentSession[] =>
  sessions.filter((s) => s.closedAt !== null);

export const rejectionMessage = (seq: number, comment: string): string => `Lot ${seq} refusé : ${comment}`;

export function summaryOf(
  session: ProjectAgentSession,
  runs: readonly RunView[],
  pendingBatchId: string | null,
): ProjectAgentSummary | null {
  const run = currentRun(session, runs);
  return run ? { projectId: session.projectId, runId: run.id, state: run.state, pendingBatchId } : null;
}

export function projectOfRun(run: RunView): string {
  if (run.kind !== "project") throw new KiboError("FORBIDDEN", "not a project run");
  if (run.projectId === null) throw new KiboError("INVALID_INPUT", `run ${run.id} has no project`);
  return run.projectId;
}
