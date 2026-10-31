import { expect, test } from "bun:test";
import {
  EMPTY_PROGRESS,
  PLAN_MAX,
  Plan,
  REPORTS_MAX,
  RunReport,
  RunReportInput,
  Step,
  TicketProgress,
} from "./progress";

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

test("the reports of a progress are bounded", () => {
  expect(TicketProgress.safeParse({ reports: Array(REPORTS_MAX).fill(report("r")) }).success).toBe(true);
  expect(TicketProgress.safeParse({ reports: Array(REPORTS_MAX + 1).fill(report("r")) }).success).toBe(false);
});

test("an empty progress parses to the default", () => {
  expect(TicketProgress.parse({})).toEqual(EMPTY_PROGRESS);
});
