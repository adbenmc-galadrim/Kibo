import { expect, test } from "bun:test";
import { ciTone, latestCiRunPerWorkflow, worstCiTone } from "./ci-state";
import type { CiRun } from "./integrations";

const run = (o: Partial<CiRun>): CiRun => ({
  repo: "adam/kibo",
  runId: 1,
  prNumber: 12,
  ticketKey: "KIB-7",
  headSha: "abc",
  workflow: "CI",
  status: "completed",
  conclusion: "success",
  url: "https://github.com/adam/kibo/actions/runs/1",
  startedAt: null,
  updatedAt: "2026-09-26T10:00:00Z",
  jobs: [],
  ...o,
});

test("ciTone reads the status first, then the conclusion", () => {
  expect(ciTone(run({ status: "queued", conclusion: null }))).toBe("running");
  expect(ciTone(run({ conclusion: "success" }))).toBe("ok");
  expect(ciTone(run({ conclusion: "timed_out" }))).toBe("error");
  expect(ciTone(run({ conclusion: "cancelled" }))).toBe("neutral");
});

test("latestCiRunPerWorkflow keeps the most recent run of each workflow", () => {
  const runs = [
    run({ runId: 1, workflow: "Lint", updatedAt: "2026-09-26T09:00:00Z" }),
    run({ runId: 2, workflow: "CI", updatedAt: "2026-09-26T09:00:00Z" }),
    run({ runId: 3, workflow: "Lint", updatedAt: "2026-09-26T10:00:00Z" }),
  ];
  expect(latestCiRunPerWorkflow(runs).map((r) => r.runId)).toEqual([2, 3]);
});

test("worstCiTone ranks failure over running over success", () => {
  const pr12 = [
    run({ runId: 1, workflow: "CI", conclusion: "failure", updatedAt: "2026-09-26T10:00:00Z" }),
    run({
      runId: 2,
      workflow: "E2E",
      status: "in_progress",
      conclusion: null,
      updatedAt: "2026-09-26T10:01:00Z",
    }),
    run({ runId: 3, workflow: "Lint", conclusion: "success", updatedAt: "2026-09-26T10:02:00Z" }),
  ];
  expect(worstCiTone(pr12)).toBe("error");
  expect(worstCiTone(pr12.slice(1))).toBe("running");
  expect(worstCiTone(pr12.slice(2))).toBe("ok");
});

test("worstCiTone only judges the latest run of each workflow", () => {
  const fixed = [
    run({ runId: 1, conclusion: "failure", updatedAt: "2026-09-26T09:00:00Z" }),
    run({ runId: 2, conclusion: "success", updatedAt: "2026-09-26T10:00:00Z" }),
  ];
  expect(worstCiTone(fixed)).toBe("ok");
});

test("a run without verdict never hides a success, and no run gives no tone", () => {
  expect(worstCiTone([run({ workflow: "A" }), run({ workflow: "B", conclusion: "skipped" })])).toBe("ok");
  expect(worstCiTone([run({ conclusion: "cancelled" })])).toBe("neutral");
  expect(worstCiTone([])).toBeNull();
});
