import { ASK_TOOL, HookInput, type HookPayload, type HookPost, KiboError } from "@kibo/schema";

const text = (value: unknown): string | null =>
  typeof value === "string" && value.length > 0 ? value : null;
const clip = (value: string | null | undefined, max: number): string | null =>
  value ? value.slice(0, max) : null;

function detailOf(h: HookInput): string | null {
  const input = h.tool_input ?? {};
  switch (h.hook_event_name) {
    case "PreToolUse":
    case "PostToolUse":
      return (
        text(input.file_path) ??
        text(input.path) ??
        text(input.command) ??
        text(input.pattern) ??
        text(input.url)
      );
    case "Notification":
      return text(h.message);
    case "Stop":
    case "SubagentStop":
      return text(h.last_assistant_message);
    case "StopFailure":
      return text(h.error) ?? text(h.last_assistant_message);
    case "SessionStart":
      return text(h.source);
    case "SessionEnd":
      return text(h.reason);
    case "SubagentStart":
      return null;
  }
}

function parseHookInput(raw: unknown): HookInput {
  const parsed = HookInput.safeParse(raw);
  if (!parsed.success) throw new KiboError("INVALID_INPUT", `hook input: ${parsed.error.message}`);
  return parsed.data;
}

function reduce(h: HookInput): HookPayload {
  const subagent = h.hook_event_name === "SubagentStart" || h.hook_event_name === "SubagentStop";
  const tool = subagent ? text(h.agent_type) : text(h.tool_name);
  const asked = h.hook_event_name === "PostToolUse" && h.tool_name === ASK_TOOL;
  return {
    event: h.hook_event_name,
    sessionId: h.session_id.slice(0, 100),
    transcriptPath: clip(h.transcript_path, 1000),
    tool: clip(tool, 200),
    detail: clip(detailOf(h), 2000),
    question: clip(asked ? text(h.tool_input?.question) : null, 4000),
    agentId: clip(h.agent_id, 200),
  };
}

export function reduceHookInput(raw: unknown): HookPayload {
  return reduce(parseHookInput(raw));
}

export const MAX_TEXT = 2000;
export const MAX_INPUT_KEYS = 20;

function clipValue(value: unknown, depth: number): unknown {
  if (typeof value === "string") return value.slice(0, MAX_TEXT);
  if (typeof value === "number" || typeof value === "boolean" || value === null) return value;
  if (depth >= 2 || typeof value !== "object") return null;
  if (Array.isArray(value)) return value.slice(0, MAX_INPUT_KEYS).map((v) => clipValue(v, depth + 1));
  return Object.fromEntries(
    Object.entries(value)
      .slice(0, MAX_INPUT_KEYS)
      .map(([k, v]) => [k, clipValue(v, depth + 1)]),
  );
}

export function clipToolInput(
  input: Record<string, unknown> | null | undefined,
): Record<string, unknown> | null {
  if (!input) return null;
  return Object.fromEntries(
    Object.entries(input)
      .slice(0, MAX_INPUT_KEYS)
      .map(([k, v]) => [k, clipValue(v, 1)]),
  );
}

export function reduceHookPost(raw: unknown): HookPost {
  const h = parseHookInput(raw);
  const payload = reduce(h);
  return { payload, toolInput: payload.event === "PreToolUse" ? clipToolInput(h.tool_input) : null };
}
