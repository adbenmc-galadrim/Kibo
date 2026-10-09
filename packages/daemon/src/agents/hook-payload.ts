import {
  ASK_QUESTION_TOOL,
  ASK_TOOL,
  type AskInput,
  askInputFromTool,
  HookInput,
  type HookPayload,
  type HookPost,
  KiboError,
  mcpToolName,
  PROJECT_AGENT_TOOLS,
  type ProjectAgentTool,
} from "@kibo/schema";

const text = (value: unknown): string | null =>
  typeof value === "string" && value.length > 0 ? value : null;
const clip = (value: string | null | undefined, max: number): string | null =>
  value ? value.slice(0, max) : null;

type ToolInput = Record<string, unknown>;

const filters =
  (...keys: string[]) =>
  (input: ToolInput): string | null => {
    const parts = keys.flatMap((k) => {
      const v = text(input[k]);
      return v ? [`${k}=${v}`] : [];
    });
    return parts.length > 0 ? parts.join(" ") : null;
  };

const MCP_DETAILS: Record<ProjectAgentTool, (input: ToolInput) => string | null> = {
  project_overview: () => null,
  list_tickets: filters("status", "label"),
  get_ticket: (input) => text(input.key),
  list_questions: filters("state", "ticketKey"),
  list_runs: filters("state"),
  list_notes: () => null,
  read_note: (input) => text(input.path),
  list_profiles: () => null,
  project_changes: () => null,
  propose_batch: (input) => `${Array.isArray(input.actions) ? input.actions.length : 0} actions`,
};

const projectToolOf = (name: string | null | undefined): ProjectAgentTool | null =>
  PROJECT_AGENT_TOOLS.find((tool) => mcpToolName(tool) === name) ?? null;

function toolDetail(h: HookInput): string | null {
  const input = h.tool_input ?? {};
  const projectTool = projectToolOf(h.tool_name);
  if (projectTool) return MCP_DETAILS[projectTool](input);
  return (
    text(input.file_path) ?? text(input.path) ?? text(input.command) ?? text(input.pattern) ?? text(input.url)
  );
}

function detailOf(h: HookInput): string | null {
  switch (h.hook_event_name) {
    case "PreToolUse":
    case "PostToolUse":
      return toolDetail(h);
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

function askOf(h: HookInput): AskInput | null {
  if (h.hook_event_name !== "PostToolUse") return null;
  if (h.tool_name !== ASK_TOOL && h.tool_name !== ASK_QUESTION_TOOL) return null;
  return askInputFromTool(h.tool_input ?? null, h.tool_name === ASK_TOOL);
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
    ask: askOf(h),
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
