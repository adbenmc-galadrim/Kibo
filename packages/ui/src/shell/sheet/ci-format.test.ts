import { expect, test } from "bun:test";
import type { CiRun } from "@kibo/schema";
import { conclusionLabel, formatDuration, latestPerWorkflow, runDuration, runTone } from "./ci-format";

test("durations read like the mockup", () => {
  expect(formatDuration(45_000)).toBe("45 s");
  expect(formatDuration(192_000)).toBe("3 min 12 s");
  expect(formatDuration(3_720_000)).toBe("1 h 02 min");
});

test("tone follows status then conclusion", () => {
  expect(runTone({ status: "in_progress", conclusion: null })).toBe("running");
  expect(runTone({ status: "queued", conclusion: null })).toBe("running");
  expect(runTone({ status: "completed", conclusion: "success" })).toBe("ok");
  expect(runTone({ status: "completed", conclusion: "failure" })).toBe("error");
  expect(runTone({ status: "completed", conclusion: "timed_out" })).toBe("error");
  expect(runTone({ status: "completed", conclusion: "skipped" })).toBe("neutral");
});

test("keeps the latest run of each workflow", () => {
  const run = (runId: number, workflow: string, updatedAt: string): CiRun => ({
    repo: "adam/kibo",
    runId,
    prNumber: 12,
    ticketKey: "KIB-1",
    headSha: "abc",
    workflow,
    status: "completed",
    conclusion: "success",
    url: `https://github.com/adam/kibo/actions/runs/${runId}`,
    startedAt: null,
    updatedAt,
    jobs: [],
  });
  const out = latestPerWorkflow([
    run(1, "CI", "2026-09-26T10:00:00Z"),
    run(2, "CI", "2026-09-26T11:00:00Z"),
    run(3, "Lint", "2026-09-26T09:00:00Z"),
  ]);
  expect(out.map((r) => r.runId)).toEqual([2, 3]);
});

test("labels and durations of a run", () => {
  expect(conclusionLabel({ status: "queued", conclusion: null })).toBe("En file");
  expect(conclusionLabel({ status: "in_progress", conclusion: null })).toBe("En cours");
  expect(conclusionLabel({ status: "completed", conclusion: "failure" })).toBe("Échec");
  expect(conclusionLabel({ status: "completed", conclusion: "stale" })).toBe("stale");
  const job = (completedAt: string | null) => ({
    jobId: 1,
    name: "build",
    status: "completed",
    conclusion: "success",
    startedAt: "2026-09-26T10:00:00Z",
    completedAt,
  });
  const run: CiRun = {
    repo: "adam/kibo",
    runId: 1,
    prNumber: 12,
    ticketKey: "KIB-1",
    headSha: "abc",
    workflow: "CI",
    status: "completed",
    conclusion: "success",
    url: "https://github.com/adam/kibo/actions/runs/1",
    startedAt: "2026-09-26T10:00:00Z",
    updatedAt: "2026-09-26T10:03:12Z",
    jobs: [job("2026-09-26T10:01:00Z"), job("2026-09-26T10:03:12Z"), job(null)],
  };
  expect(runDuration(run)).toBe("3 min 12 s");
  expect(runDuration({ ...run, status: "in_progress" })).toBeNull();
});
