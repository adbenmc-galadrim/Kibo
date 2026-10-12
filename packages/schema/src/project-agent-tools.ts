import { z } from "zod";
import type { AgentScope } from "./agent";
import type { KiboErrorCode } from "./errors";
import { TicketKey } from "./ids";
import { LabelName } from "./label";
import { NotePath } from "./note";
import { TICKET_TOOL_NAMES } from "./progress";
import { ProposeBatchInput } from "./project-agent";
import { RunState } from "./run";
import { PROJECT_SIGNAL_TOOLS } from "./signal";
import { SHARED_TOOL_NAMES, SKILL_REVIEW_TOOL } from "./skill";
import { StatusId } from "./status";

export const PROJECT_AGENT_TOOLS = [
  "project_overview",
  "list_tickets",
  "get_ticket",
  "list_questions",
  "list_runs",
  "list_notes",
  "read_note",
  "list_profiles",
  "project_changes",
  "propose_batch",
  ...PROJECT_SIGNAL_TOOLS,
] as const;
export type ProjectAgentTool = (typeof PROJECT_AGENT_TOOLS)[number];

export const mcpToolName = (tool: string): string => `mcp__kibo__${tool}`;
export const PROJECT_AGENT_MCP_TOOLS: readonly string[] = [
  ...PROJECT_AGENT_TOOLS.map(mcpToolName),
  SKILL_REVIEW_TOOL,
];
export const PROJECT_AGENT_READ_TOOLS: readonly string[] = ["Read", "Grep", "Glob"];
export const PROJECT_AGENT_DENY: readonly string[] = [
  "Bash",
  "Edit",
  "Write",
  "NotebookEdit",
  "WebFetch",
  "WebSearch",
];

export const PAGE_SIZE = 50;
export const LIST_QUERY_MAX = 200;

export const CursorInput = z.object({ cursor: z.string().regex(/^\d+$/).optional() });
export const ListTicketsInput = CursorInput.extend({
  status: StatusId.optional(),
  label: LabelName.optional(),
  query: z.string().max(LIST_QUERY_MAX).optional(),
});
export type ListTicketsInput = z.infer<typeof ListTicketsInput>;
export const GetTicketInput = z.object({ key: TicketKey });
export const ListQuestionsInput = z.object({
  state: z.enum(["open", "answered", "all"]).default("open"),
  ticketKey: TicketKey.optional(),
});
export type ListQuestionsInput = z.infer<typeof ListQuestionsInput>;
export const ListSignalsInput = CursorInput.extend({
  state: z.enum(["open", "closed", "all"]).default("open"),
});
export type ListSignalsInput = z.infer<typeof ListSignalsInput>;
export const ListRunsInput = z.object({ state: RunState.optional() });
export const ReadNoteInput = z.object({ path: NotePath });
const NoInput = z.object({});

export const TOOL_INPUTS: Record<ProjectAgentTool, z.ZodTypeAny> = {
  project_overview: NoInput,
  list_tickets: ListTicketsInput,
  get_ticket: GetTicketInput,
  list_questions: ListQuestionsInput,
  list_runs: ListRunsInput,
  list_notes: CursorInput,
  read_note: ReadNoteInput,
  list_profiles: NoInput,
  project_changes: NoInput,
  propose_batch: ProposeBatchInput,
  list_signals: ListSignalsInput,
};

export const AgentMcpRequest = z.object({
  tool: z.enum([...PROJECT_AGENT_TOOLS, ...TICKET_TOOL_NAMES, ...SHARED_TOOL_NAMES]),
  input: z.record(z.string(), z.unknown()).default({}),
});
export type AgentMcpRequest = z.infer<typeof AgentMcpRequest>;
export type AgentMcpReply =
  | { ok: true; text: string }
  | { ok: false; error: { code: KiboErrorCode; message: string } };

export type AssignableAgent = {
  id: string;
  name: string;
  scope: AgentScope;
  description: string;
  model: string;
};

export type ToolPage<T> = { items: T[]; nextCursor: string | null; total: number };

export type TicketCard = {
  key: string;
  title: string;
  statusId: string;
  labels: string[];
  assignee: string | null;
  parent: string | null;
  openQuestions: number;
  startable: boolean;
  branch: string | null;
  pr: string | null;
};

export type TicketSheet = TicketCard & {
  description: string;
  blockedReason: string | null;
  blocks: string[];
  blockedBy: string[];
  relates: string[];
  questions: { id: string; title: string; state: "open" | "answered"; answer: string | null }[];
  runs: { id: string; label: string; state: RunState; turns: number }[];
};

export type ProjectOverview = {
  name: string;
  key: string;
  statuses: { id: string; name: string; count: number }[];
  active: TicketCard[];
  runs: { id: string; label: string; state: RunState; subject: string; position: number | null }[];
  openQuestions: { id: string; ticket: string; title: string; blocking: boolean }[];
  notes: { path: string; title: string }[];
  profiles: AssignableAgent[];
  memory: string;
  openSignals: number;
};
