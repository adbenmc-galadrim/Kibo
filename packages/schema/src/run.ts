import { z } from "zod";
import type { AgentScope } from "./agent";
import type { RunDeliveryStep } from "./delivery";
import type { MachineLock } from "./machine-lock";
import type { RunOverlapCount } from "./overlap";
import type { RunProgressSummary } from "./progress";
import type { RunQuestions } from "./question";
import { type HookEventName, HookPayload } from "./run-hook";
import type { ProjectSignalCount } from "./signal";
import type { RunSubagentSummary } from "./subagent";
import type { HostSettings } from "./workspace-config";

export const RunState = z.enum([
  "queued",
  "starting",
  "running",
  "waiting_input",
  "done",
  "failed",
  "cancelled",
]);
export type RunState = z.infer<typeof RunState>;

export const SLOT_STATES: readonly RunState[] = ["starting", "running"];
export const TERMINAL_STATES: readonly RunState[] = ["done", "failed", "cancelled"];
export const isTerminal = (state: RunState): boolean => TERMINAL_STATES.includes(state);

export const SetupStatus = z.enum(["running", "done", "failed"]);
export type SetupStatus = z.infer<typeof SetupStatus>;
export const SetupStep = z.object({
  command: z.string(),
  status: SetupStatus,
  durationMs: z.number().int().nonnegative().optional(),
});
export type SetupStep = z.infer<typeof SetupStep>;

export const SessionFreshReason = z.enum([
  "no_previous",
  "agent_changed",
  "transcript_missing",
  "workspace_changed",
  "user_reset",
]);
export type SessionFreshReason = z.infer<typeof SessionFreshReason>;

const ResumedSession = z.object({ mode: z.literal("resumed"), from: z.string().min(1) });
const FreshSession = z.object({ mode: z.literal("fresh"), reason: SessionFreshReason });
export const RunSession = z.discriminatedUnion("mode", [ResumedSession, FreshSession]);
export type RunSession = z.infer<typeof RunSession>;

const SessionEvent = z.discriminatedUnion("mode", [
  ResumedSession.extend({ type: z.literal("session") }),
  FreshSession.extend({ type: z.literal("session") }),
]);

const LifecycleEvent = z.discriminatedUnion("type", [
  z.object({ type: z.literal("enqueued"), rank: z.number() }),
  z.object({ type: z.literal("admitted"), lane: z.number().int().positive() }),
  z.object({
    type: z.literal("spawned"),
    pid: z.number().int(),
    resume: z.boolean(),
    workspace: z.string(),
    cwd: z.string().optional(),
    sessionId: z.string().min(1).max(100).optional(),
    guidelines: z.number().int().nonnegative(),
    addDirs: z.array(z.string()).optional(),
  }),
  z.object({ type: z.literal("hook"), payload: HookPayload }),
  z.object({
    type: z.literal("exited"),
    code: z.number().int(),
    isError: z.boolean(),
    result: z.string().nullable(),
    tokens: z.number().int().nonnegative(),
    costUsd: z.number().nonnegative(),
    denied: z.array(z.string()),
    output: z.string().max(1_000_000).optional(),
  }),
  z.object({ type: z.literal("answered"), text: z.string().trim().min(1).max(10_000), rank: z.number() }),
  z.object({ type: z.literal("requeued"), rank: z.number() }),
  z.object({ type: z.literal("cancelled") }),
  z.object({ type: z.literal("failed"), error: z.string() }),
  z.object({ type: z.literal("reranked"), rank: z.number() }),
  z.object({ type: z.literal("prioritized"), priority: z.boolean() }),
  SetupStep.extend({ type: z.literal("setup") }),
]);
export const RunEvent = z.union([LifecycleEvent, SessionEvent]);
export type RunEvent = z.infer<typeof RunEvent>;

export const RunKind = z.enum(["ticket", "project"]);
export type RunKind = z.infer<typeof RunKind>;

export type RunRecord = {
  id: string;
  kind: RunKind;
  seq: number;
  projectId: string | null;
  ticketId: string | null;
  ticketKey: string | null;
  ticketTitle: string;
  profileId: string;
  profileName: string;
  agentScope: AgentScope;
  projectKey: string | null;
  sessionId: string;
  brief: string;
  createdAt: number;
  resumedFrom: string | null;
};

export const isProjectRun = (run: Pick<RunRecord, "kind">): boolean => run.kind === "project";

export type RunActivity = { at: number; event: HookEventName; tool: string | null; detail: string | null };
export type ActiveSubagent = { id: string; type: string; since: number };

export type RunView = RunRecord & {
  label: string;
  agentName: string;
  state: RunState;
  lane: number | null;
  priority: boolean;
  rank: number;
  question: string | null;
  pendingAnswer: string | null;
  lastActivity: RunActivity | null;
  subagents: ActiveSubagent[];
  workspace: string | null;
  cwd: string | null;
  guidelines: number;
  transcriptPath: string | null;
  tokens: number;
  costUsd: number;
  denied: string[];
  error: string | null;
  output: string | null;
  stateSince: number;
  startedAt: number | null;
  endedAt: number | null;
  turns: number;
  activeMs: number;
  turnStartedAt: number | null;
  session: RunSession | null;
};

export type HostLoad = { cpu: number; ram: number };
export type HostInfo = { cores: number; ramGb: number };

export type WaitReason =
  | { kind: "paused" }
  | { kind: "cpu"; value: number; threshold: number }
  | { kind: "ram"; value: number; threshold: number }
  | { kind: "host"; used: number; total: number }
  | { kind: "agent"; agentName: string; used: number; total: number }
  | { kind: "agent_missing" }
  | { kind: "ticket_busy" }
  | { kind: "parent_ticket"; children: number };

export type QueueEntry = { runId: string; position: number; reason: WaitReason | null };

export type HostView = HostSettings & {
  autoSlots: number;
  slotsFixed: boolean;
  cores: number;
  ramGb: number;
  used: number;
  cpu: number;
  ram: number;
};

export type ProjectAgentSummary = {
  projectId: string;
  runId: string;
  state: RunState;
  pendingBatchId: string | null;
};

export type AgentsState = {
  runs: RunView[];
  queue: QueueEntry[];
  host: HostView;
  tokensToday: number;
  resumable: string[];
  questions: RunQuestions[];
  projectAgents: ProjectAgentSummary[];
  progress: RunProgressSummary[];
  signals: ProjectSignalCount[];
  overlaps?: RunOverlapCount[];
  overlapTotal?: number;
  locks?: MachineLock[];
  delivery?: RunDeliveryStep[];
  subagents?: RunSubagentSummary[];
};

export const runOverlapCounts = (state: Pick<AgentsState, "overlaps">): RunOverlapCount[] =>
  state.overlaps ?? [];
export const runSubagents = (state: Pick<AgentsState, "subagents">): RunSubagentSummary[] =>
  state.subagents ?? [];
export const openOverlapTotal = (state: Pick<AgentsState, "overlapTotal">): number => state.overlapTotal ?? 0;
export type SessionPreview = {
  runId: string;
  label: string;
  turns: number;
  tokens: number;
  resumable: boolean;
  reason: SessionFreshReason | null;
};
export type AssignPreview = {
  position: number | null;
  reason: WaitReason | null;
  guidelines: number;
  session: SessionPreview | null;
  model?: string;
  inherited?: boolean;
};
export type RunLogEntry = { id: number; at: number; event: RunEvent };
export const TicketRun = z.object({
  ticketId: z.string().min(1),
  runId: z.string().min(1),
  label: z.string().min(1),
  state: RunState,
  position: z.number().int().positive().nullable(),
});
export type TicketRun = z.infer<typeof TicketRun>;
export type RunChanged = { type: "run.changed"; runId: string; state: RunState };

export function runSubject(
  run: Pick<RunRecord, "ticketKey" | "ticketTitle">,
  text = run.ticketTitle,
): string {
  return run.ticketKey ? `${run.ticketKey} · ${text}` : text;
}

export const keyBesideLabel = (label: string, key: string | null): string | null =>
  key !== null && !label.split(" · ").includes(key) ? key : null;

export function runSubjectBeside(
  run: Pick<RunRecord, "ticketKey" | "ticketTitle"> & { label: string },
): string {
  return keyBesideLabel(run.label, run.ticketKey) === null ? run.ticketTitle : runSubject(run);
}
