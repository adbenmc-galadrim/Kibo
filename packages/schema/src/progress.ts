import { z } from "zod";

export { TodoItem } from "./todo-item";

const StepStatus = z.enum(["todo", "doing", "done", "blocked"]);

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
