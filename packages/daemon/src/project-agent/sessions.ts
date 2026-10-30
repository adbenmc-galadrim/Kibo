import { truncate } from "@kibo/core/project-agent/ticket-facts";
import {
  ASK_TOOL,
  isWakeupMessage,
  KiboError,
  type ProjectAgentSession,
  type ProjectAgentSessionView,
  type ProjectAgentSummary,
  type RunEvent,
  type RunLogEntry,
  type RunView,
} from "@kibo/schema";
import type { ProjectAgentAgentsPort } from "./types";

const SESSION_TITLE_MAX = 120;

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

type SessionDigest = Pick<ProjectAgentSessionView, "title" | "messages">;

function counts(event: RunEvent): boolean {
  if (event.type === "answered") return !isWakeupMessage(event.text);
  if (event.type === "exited") return event.code === 0 && !event.isError && Boolean(event.result);
  if (event.type === "hook") return event.payload.tool === ASK_TOOL && Boolean(event.payload.question);
  return false;
}

function titleOf(event: RunEvent): string | null {
  return event.type === "answered" && !isWakeupMessage(event.text)
    ? truncate(event.text.trim(), SESSION_TITLE_MAX)
    : null;
}

export function sessionDigest(log: readonly RunLogEntry[]): SessionDigest {
  let title: string | null = null;
  let messages = 0;
  for (const { event } of log) {
    if (counts(event)) messages += 1;
    title ??= titleOf(event);
  }
  return { title, messages };
}

export const withDigest = (
  session: ProjectAgentSession,
  log: readonly RunLogEntry[],
): ProjectAgentSessionView => ({
  ...session,
  ...sessionDigest(log),
});

export function safeLog(agents: Pick<ProjectAgentAgentsPort, "log">, runId: string): RunLogEntry[] {
  try {
    return agents.log(runId);
  } catch (e) {
    if (e instanceof KiboError && e.code === "NOT_FOUND") return [];
    throw e;
  }
}
