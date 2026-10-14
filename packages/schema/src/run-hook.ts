import { z } from "zod";
import { AskInput } from "./question";
import { TodoItem } from "./todo-item";

export const ASK_TOOL = "mcp__kibo__ask_user";
export const ASK_QUESTION_TOOL = "mcp__kibo__ask_question";
export const ASK_TOOLS: readonly string[] = [ASK_TOOL, ASK_QUESTION_TOOL];

export const HookEventName = z.enum([
  "SessionStart",
  "PreToolUse",
  "PostToolUse",
  "Notification",
  "Stop",
  "SubagentStart",
  "SubagentStop",
  "StopFailure",
  "SessionEnd",
]);
export type HookEventName = z.infer<typeof HookEventName>;

export const HookInput = z.object({
  hook_event_name: HookEventName,
  session_id: z.string(),
  transcript_path: z.string().nullish(),
  tool_name: z.string().nullish(),
  tool_input: z.record(z.string(), z.unknown()).nullish(),
  message: z.string().nullish(),
  last_assistant_message: z.string().nullish(),
  source: z.string().nullish(),
  reason: z.string().nullish(),
  error: z.string().nullish(),
  agent_id: z.string().nullish(),
  agent_type: z.string().nullish(),
  tool_use_id: z.string().nullish(),
  stop_hook_active: z.boolean().nullish(),
});
export type HookInput = z.infer<typeof HookInput>;

export const HookPayload = z.object({
  event: HookEventName,
  sessionId: z.string().max(100),
  transcriptPath: z.string().max(1000).nullable(),
  tool: z.string().max(200).nullable(),
  detail: z.string().max(2000).nullable(),
  question: z.string().max(4000).nullable(),
  agentId: z.string().max(200).nullable(),
  toolUseId: z.string().max(200).nullable().default(null),
  ask: AskInput.nullable().default(null),
  todos: z.array(TodoItem).max(100).nullable().default(null),
  stopHookActive: z.boolean().default(false),
});
export type HookPayload = z.infer<typeof HookPayload>;

export const HookPost = z.object({
  payload: HookPayload,
  toolInput: z.record(z.string(), z.unknown()).nullable(),
});
export type HookPost = z.infer<typeof HookPost>;
export type GuardDecision = { decision: "allow" | "deny"; reason: string };
export type HookReply =
  | { kind: "permission"; decision: "allow" | "deny"; reason: string; additionalContext: string | null }
  | { kind: "stop"; reason: string };
export const permissionReply = (d: GuardDecision, additionalContext: string | null = null): HookReply => ({
  kind: "permission",
  decision: d.decision,
  reason: d.reason,
  additionalContext,
});
