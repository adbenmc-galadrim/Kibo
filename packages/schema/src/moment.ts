import { z } from "zod";
import type { RunState } from "./run";

const MOMENT_MESSAGE_MAX = 8_000;
const MOMENT_DETAIL_MAX = 4_000;
const MOMENT_RAW_MAX = 2_000;
const MOMENT_ACTIONS_MAX = 200;

const ACTION_KINDS = [
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
  "skill",
  "other",
] as const;
export const ActionKind = z.enum(ACTION_KINDS);
export type ActionKind = z.infer<typeof ActionKind>;

export const RunActionOutcome = z.enum(["ok", "error", "denied"]);
export type RunActionOutcome = z.infer<typeof RunActionOutcome>;

const Count = z.number().int().nonnegative();

const RunAction = z.object({
  tool: z.string().max(100),
  kind: ActionKind,
  label: z.string().max(200),
  target: z.string().max(500).nullable(),
  outcome: RunActionOutcome,
  detail: z.string().max(MOMENT_DETAIL_MAX).nullable(),
  patch: z.object({ added: Count, removed: Count }).nullable(),
  tests: z.object({ passed: Count, failed: Count }).nullable(),
  callId: z.string().max(64).optional(),
  command: z.string().max(500).optional(),
});

const REMINDER_KINDS = ["plan", "report", "skills", "report_skills", "overlap"] as const;

export const PartialReason = z.enum(["path-rejected", "unreadable", "unknown-format"]);
export type PartialReason = z.infer<typeof PartialReason>;

const MomentData = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("message"), text: z.string().max(MOMENT_MESSAGE_MAX) }),
  z.object({
    kind: z.literal("actions"),
    actions: z.array(RunAction).min(1).max(MOMENT_ACTIONS_MAX),
    summary: z.string().max(300),
    failed: z.boolean(),
  }),
  z.object({ kind: z.literal("reasoning"), text: z.string().max(MOMENT_MESSAGE_MAX) }),
  z.object({ kind: z.literal("reminder"), reminder: z.enum(REMINDER_KINDS) }),
  z.object({
    kind: z.literal("raw"),
    text: z.string().max(MOMENT_RAW_MAX),
    partial: PartialReason.nullable(),
  }),
]);

const RunMoment = z.object({
  id: z.number().int(),
  runId: z.string().min(1),
  seq: z.number().int().nonnegative(),
  at: z.number().int(),
  stepId: z.string().max(40).nullable(),
  subagentId: z.string().min(1).max(200).optional(),
  data: MomentData,
});
type RunMoment = z.infer<typeof RunMoment>;

export type RunMomentsEvent = { type: "run.moments"; runId: string; moments: RunMoment[] };
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
