import { z } from "zod";
import type { Step } from "./progress";
import type { RunState } from "./run";
import { SIGNAL_TITLE_MAX, SignalKind, SignalRef } from "./signal";

export const MOMENT_MESSAGE_MAX = 8_000;
export const MOMENT_DETAIL_MAX = 4_000;
export const MOMENT_RAW_MAX = 2_000;
export const TRANSCRIPT_PASS_MAX_BYTES = 4 * 1024 * 1024;
export const MOMENT_ACTIONS_MAX = 200;

export const ACTION_KINDS = [
  "read",
  "edit",
  "create",
  "search",
  "test",
  "install",
  "git",
  "command",
  "question",
  "progress",
  "todo",
  "mcp",
  "subagent",
  "signal",
  "other",
] as const;
export const ActionKind = z.enum(ACTION_KINDS);
export type ActionKind = z.infer<typeof ActionKind>;

export const RunActionOutcome = z.enum(["ok", "error", "denied"]);
export type RunActionOutcome = z.infer<typeof RunActionOutcome>;

const Count = z.number().int().nonnegative();

export const RunAction = z.object({
  tool: z.string().max(100),
  kind: ActionKind,
  label: z.string().max(200),
  target: z.string().max(500).nullable(),
  outcome: RunActionOutcome,
  detail: z.string().max(MOMENT_DETAIL_MAX).nullable(),
  patch: z.object({ added: Count, removed: Count }).nullable(),
  tests: z.object({ passed: Count, failed: Count }).nullable(),
});
export type RunAction = z.infer<typeof RunAction>;

export const PartialReason = z.enum(["path-rejected", "unreadable", "unknown-format"]);
export type PartialReason = z.infer<typeof PartialReason>;

export const MomentData = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("message"), text: z.string().max(MOMENT_MESSAGE_MAX) }),
  z.object({
    kind: z.literal("actions"),
    actions: z.array(RunAction).min(1).max(MOMENT_ACTIONS_MAX),
    summary: z.string().max(300),
    failed: z.boolean(),
  }),
  z.object({ kind: z.literal("reasoning"), text: z.string().max(MOMENT_MESSAGE_MAX) }),
  z.object({ kind: z.literal("reminder"), reminder: z.enum(["plan", "report"]) }),
  z.object({
    kind: z.literal("signal"),
    signalId: z.string().min(1),
    ref: SignalRef,
    signalKind: SignalKind,
    title: z.string().max(SIGNAL_TITLE_MAX),
  }),
  z.object({
    kind: z.literal("raw"),
    text: z.string().max(MOMENT_RAW_MAX),
    partial: PartialReason.nullable(),
  }),
]);
export type MomentData = z.infer<typeof MomentData>;
export type MomentKind = MomentData["kind"];

export const RunMoment = z.object({
  id: z.number().int(),
  runId: z.string().min(1),
  seq: z.number().int().nonnegative(),
  at: z.number().int(),
  stepId: z.string().max(40).nullable(),
  data: MomentData,
});
export type RunMoment = z.infer<typeof RunMoment>;

export type RunMomentsEvent = { type: "run.moments"; runId: string; moments: RunMoment[] };
export type RunMomentsPage = {
  moments: RunMoment[];
  internalPlan: Step[] | null;
  partial: PartialReason | null;
  source: "pending" | "transcript" | "hooks";
};
export type RunPeek = {
  runId: string;
  label: string;
  profileName: string;
  state: RunState;
  ticketKey: string | null;
  ticketTitle: string;
  step: { index: number; total: number; title: string } | null;
  lastMessage: string | null;
  waiting: boolean;
};
