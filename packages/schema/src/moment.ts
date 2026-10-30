import { z } from "zod";

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

export const PartialReason = z.enum(["path-rejected", "unreadable", "unknown-format"]);
export type PartialReason = z.infer<typeof PartialReason>;
