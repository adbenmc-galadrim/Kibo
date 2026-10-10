import { expect, test } from "bun:test";
import {
  doingStep,
  EMPTY_PROGRESS,
  latestReport,
  PLAN_MAX,
  Plan,
  PROGRESS_TOOL,
  ProgressInput,
  progressReply,
  progressSummary,
  REPORTS_MAX,
  RunReport,
  RunReportInput,
  reportOfRun,
  Step,
  TICKET_MCP_TOOLS,
  TICKET_PROGRESS_SPEC,
  TicketProgress,
  todosToPlan,
} from "./progress";
import { ASK_TOOLS } from "./run";

const step = (id: string, status: Step["status"] = "todo"): Step => ({
  id,
  title: `Étape ${id}`,
  status,
  note: null,
});

const report = (runId: string, over: Partial<RunReport> = {}): RunReport =>
  RunReport.parse({ runId, at: 1, done: "Fait.", ...over });

test("a plan is bounded and its ids are unique", () => {
  expect(Plan.safeParse(Array.from({ length: PLAN_MAX }, (_, i) => step(`s${i}`))).success).toBe(true);
  expect(Plan.safeParse(Array.from({ length: PLAN_MAX + 1 }, (_, i) => step(`s${i}`))).success).toBe(false);
  expect(Plan.safeParse([step("a"), step("a")]).success).toBe(false);
  expect(Step.safeParse({ ...step("a"), title: "x".repeat(161) }).success).toBe(false);
  expect(Step.parse({ id: "a", title: "Lire", status: "doing" }).note).toBeNull();
});

test("a report fills its defaults", () => {
  expect(RunReportInput.parse({ done: "Fait." })).toEqual({
    done: "Fait.",
    decisions: [],
    toCheck: [],
    files: [],
    next: "",
  });
  expect(RunReportInput.safeParse({ done: "", decisions: Array(11).fill("d") }).success).toBe(false);
  expect(RunReportInput.safeParse({ done: "", files: Array(101).fill("f") }).success).toBe(false);
  expect(report("r1").check).toBeNull();
});

test("a progress call carries a plan or a report", () => {
  expect(ProgressInput.safeParse({}).success).toBe(false);
  expect(ProgressInput.safeParse({ plan: [step("a")] }).success).toBe(true);
  expect(progressReply({ plan: [step("a")] })).toBe("Plan enregistré.");
  expect(progressReply({ report: RunReportInput.parse({ done: "x" }) })).toBe("Compte rendu enregistré.");
  expect(progressReply({ plan: [], report: RunReportInput.parse({ done: "x" }) })).toBe(
    "Plan enregistré. Compte rendu enregistré.",
  );
});

test("a todo list becomes an internal plan", () => {
  expect(
    todosToPlan([
      { content: "Lire", status: "completed" },
      { content: "Corriger", status: "in_progress", activeForm: "Correction" },
      { content: "Tester", status: "pending" },
    ]),
  ).toEqual([
    { id: "todo-1", title: "Lire", status: "done", note: null },
    { id: "todo-2", title: "Corriger", status: "doing", note: null },
    { id: "todo-3", title: "Tester", status: "todo", note: null },
  ]);
  expect(todosToPlan([{ content: "  ", status: "pending" }])).toEqual([]);
});

test("the step in progress and the run summary", () => {
  const plan = [step("a", "done"), step("b", "doing"), step("c"), step("d"), step("e")];
  expect(doingStep(plan)?.id).toBe("b");
  expect(doingStep([step("a")])).toBeNull();
  const progress = TicketProgress.parse({
    plan,
    planRunId: "r1",
    planAt: 1,
    reports: [report("r1", { toCheck: ["a", "b"], check: { undeclared: ["x.ts"], unchanged: [] } })],
  });
  expect(progressSummary("r1", progress)).toEqual({
    runId: "r1",
    step: { index: 2, total: 5, title: "Étape b" },
    report: { toCheck: 2, undeclared: 1 },
  });
  expect(progressSummary("r2", progress)).toEqual({
    runId: "r2",
    step: { index: 2, total: 5, title: "Étape b" },
    report: null,
  });
  expect(progressSummary("r1", EMPTY_PROGRESS)).toEqual({ runId: "r1", step: null, report: null });
});

test("reports are found by run and by date", () => {
  const progress = TicketProgress.parse({ reports: [report("r1", { at: 5 }), report("r2", { at: 9 })] });
  expect(latestReport(progress)?.runId).toBe("r2");
  expect(reportOfRun(progress, "r1")?.at).toBe(5);
  expect(reportOfRun(progress, "r3")).toBeNull();
  expect(latestReport(EMPTY_PROGRESS)).toBeNull();
  expect(TicketProgress.safeParse({ reports: Array(REPORTS_MAX + 1).fill(report("r")) }).success).toBe(false);
});

test("an empty progress parses to the default", () => {
  expect(TicketProgress.parse({})).toEqual(EMPTY_PROGRESS);
});

test("the ticket tool is described for the agent", () => {
  expect(TICKET_PROGRESS_SPEC.name).toBe("ticket_progress");
  expect(Object.keys(TICKET_PROGRESS_SPEC.inputSchema.properties ?? {})).toEqual(["plan", "report"]);
  expect(TICKET_MCP_TOOLS).toEqual([...ASK_TOOLS, PROGRESS_TOOL]);
});
