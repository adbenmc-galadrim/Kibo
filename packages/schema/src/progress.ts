import { z } from "zod";
import { ASK_TOOLS } from "./run";
import type { TodoItem } from "./todo-item";

export { TodoItem } from "./todo-item";

export const StepStatus = z.enum(["todo", "doing", "done", "blocked"]);
export type StepStatus = z.infer<typeof StepStatus>;

export const Step = z.object({
  id: z.string().trim().min(1).max(40),
  title: z.string().trim().min(1).max(160),
  status: StepStatus,
  note: z.string().max(300).nullable().default(null),
});
export type Step = z.infer<typeof Step>;

export const PLAN_MAX = 30;
export const REPORTS_MAX = 20;

export const Plan = z
  .array(Step)
  .max(PLAN_MAX)
  .superRefine((steps, ctx) => {
    const ids = steps.map((s) => s.id);
    if (new Set(ids).size !== ids.length) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "step ids must be unique" });
    }
  });

const Lines = z.array(z.string().max(300)).max(10).default([]);

export const RunReportInput = z.object({
  done: z.string().max(1_000),
  decisions: Lines,
  toCheck: Lines,
  files: z.array(z.string().max(500)).max(100).default([]),
  next: z.string().max(300).default(""),
});
export type RunReportInput = z.infer<typeof RunReportInput>;

const Paths = z.array(z.string().max(500)).max(100);
export const FileCheck = z.object({ undeclared: Paths, unchanged: Paths });
export type FileCheck = z.infer<typeof FileCheck>;

export const RunReport = RunReportInput.extend({
  runId: z.string().min(1),
  at: z.number().int(),
  check: FileCheck.nullable().default(null),
});
export type RunReport = z.infer<typeof RunReport>;

export const TicketProgress = z.object({
  plan: Plan.default([]),
  planRunId: z.string().nullable().default(null),
  planAt: z.number().int().nullable().default(null),
  reports: z.array(RunReport).max(REPORTS_MAX).default([]),
});
export type TicketProgress = z.infer<typeof TicketProgress>;

export const EMPTY_PROGRESS: TicketProgress = { plan: [], planRunId: null, planAt: null, reports: [] };

export const ProgressInput = z
  .object({ plan: Plan.optional(), report: RunReportInput.optional() })
  .refine((i) => i.plan !== undefined || i.report !== undefined, "plan or report required");
export type ProgressInput = z.infer<typeof ProgressInput>;

export const PROGRESS_TOOL_NAME = "ticket_progress";
export const PROGRESS_TOOL = `mcp__kibo__${PROGRESS_TOOL_NAME}`;
export const TICKET_MCP_TOOLS: readonly string[] = [...ASK_TOOLS, PROGRESS_TOOL];

export type McpInputSchema = { type: "object"; properties: Record<string, unknown>; required: string[] };
export type McpToolSpec = { name: string; description: string; inputSchema: McpInputSchema };

const lines = (description: string, maxItems: number, maxLength: number) => ({
  type: "array",
  description,
  maxItems,
  items: { type: "string", maxLength },
});

const STEP_SCHEMA = {
  type: "object",
  properties: {
    id: { type: "string", maxLength: 40, description: "Stable id of the step, kept across updates." },
    title: { type: "string", maxLength: 160, description: "What the step does, for a human reader." },
    status: { type: "string", enum: StepStatus.options },
    note: { type: "string", maxLength: 300, description: "Optional short note." },
  },
  required: ["id", "title", "status"],
};

const REPORT_SCHEMA = {
  type: "object",
  properties: {
    done: { type: "string", maxLength: 1_000, description: "What was done, in plain words." },
    decisions: lines("Decisions taken on the way.", 10, 300),
    toCheck: lines("Points a human should check.", 10, 300),
    files: lines("Files created or modified, relative to the repository.", 100, 500),
    next: { type: "string", maxLength: 300, description: "What should come next." },
  },
  required: ["done"],
};

export const TICKET_PROGRESS_SPEC: McpToolSpec = {
  name: PROGRESS_TOOL_NAME,
  description:
    "Share your progress on this ticket with Kibo. Send `plan` (the whole list of steps, replacing the previous one) before modifying files and whenever a step changes; send `report` once before you finish. One call may carry both.",
  inputSchema: {
    type: "object",
    properties: {
      plan: { type: "array", maxItems: PLAN_MAX, items: STEP_SCHEMA, description: "The whole plan." },
      report: REPORT_SCHEMA,
    },
    required: [],
  },
};

const TODO_STATUS: Record<TodoItem["status"], StepStatus> = {
  pending: "todo",
  in_progress: "doing",
  completed: "done",
};

export function todosToPlan(todos: readonly TodoItem[]): Step[] {
  return todos
    .map((t, i) => ({
      id: `todo-${i + 1}`,
      title: t.content.trim(),
      status: TODO_STATUS[t.status],
      note: null,
    }))
    .filter((s) => s.title.length > 0);
}

export const doingStep = (plan: readonly Step[]): Step | null =>
  plan.find((s) => s.status === "doing") ?? null;

export function progressReply(input: ProgressInput): string {
  return [
    ...(input.plan !== undefined ? ["Plan enregistré."] : []),
    ...(input.report !== undefined ? ["Compte rendu enregistré."] : []),
  ].join(" ");
}

export function latestReport(p: TicketProgress): RunReport | null {
  return p.reports.reduce<RunReport | null>((last, r) => (last === null || r.at >= last.at ? r : last), null);
}

export function reportOfRun(p: TicketProgress, runId: string): RunReport | null {
  return p.reports.find((r) => r.runId === runId) ?? null;
}

export type RunProgressSummary = {
  runId: string;
  step: { index: number; total: number; title: string } | null;
  report: { toCheck: number; undeclared: number } | null;
};

export function progressSummary(runId: string, p: TicketProgress): RunProgressSummary {
  const doing = doingStep(p.plan);
  const report = reportOfRun(p, runId);
  return {
    runId,
    step: doing && { index: p.plan.indexOf(doing) + 1, total: p.plan.length, title: doing.title },
    report: report && { toCheck: report.toCheck.length, undeclared: report.check?.undeclared.length ?? 0 },
  };
}
