import {
  maskSecretsWithin,
  type RunMomentsPage,
  type RunPeek,
  type RunProgressSummary,
  type RunView,
} from "@kibo/schema";
import type { MomentStore } from "./store";

const PEEK_MESSAGE_MAX = 200;

export function pageOf(store: MomentStore, runId: string, after?: number): RunMomentsPage {
  const trace = store.trace(runId);
  return {
    moments: store.list(runId, after),
    internalPlan: store.internalPlan(runId),
    partial: trace?.partial ?? null,
    source: trace?.source ?? "pending",
  };
}

export function peekOf(store: MomentStore, run: RunView, progress: RunProgressSummary | null): RunPeek {
  const last = store.lastOfKind(run.id, "message")?.data;
  return {
    runId: run.id,
    label: run.label,
    profileName: run.profileName,
    state: run.state,
    ticketKey: run.ticketKey,
    ticketTitle: run.ticketTitle,
    step: progress?.step ?? null,
    lastMessage: last?.kind === "message" ? maskSecretsWithin(last.text, PEEK_MESSAGE_MAX) : null,
    waiting: run.state === "waiting_input",
  };
}
