import { expect, test } from "bun:test";
import { EMPTY_PROGRESS, latestReport, type RunReport, type TicketProgress } from "@kibo/schema";
import { lastReport } from "./use-run-view";

const report = (runId: string, at: number): RunReport => ({
  runId,
  at,
  done: runId,
  decisions: [],
  toCheck: [],
  files: [],
  next: "",
  check: null,
});

const progress = (reports: RunReport[]): TicketProgress => ({ ...EMPTY_PROGRESS, reports });

test("the last report is the schema's latest report, ties included", () => {
  const cases = [
    [],
    [report("a", 1)],
    [report("a", 2), report("b", 1)],
    [report("a", 1), report("b", 2)],
    [report("a", 5), report("b", 5)],
    [report("a", 5), report("b", 3), report("c", 5)],
  ];
  for (const reports of cases) expect(lastReport(progress(reports))).toBe(latestReport(progress(reports)));
  expect(lastReport(progress([report("a", 5), report("b", 5)]))?.runId).toBe("b");
});
