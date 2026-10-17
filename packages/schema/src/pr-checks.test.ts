import { expect, test } from "bun:test";
import type { CiRun } from "./integrations";
import { type CheckRollupItem, parseReviewDecision, prChecksTone, prCiTone } from "./pr-checks";

const TONES: [CheckRollupItem[], ReturnType<typeof prChecksTone>][] = [
  [[], null],
  [[{ conclusion: "FAILURE" }, { status: "IN_PROGRESS" }], "error"],
  [[{ status: "IN_PROGRESS" }], "running"],
  [[{ status: "QUEUED" }, { conclusion: "SUCCESS" }], "running"],
  [[{ state: "PENDING" }], "running"],
  [[{ state: "EXPECTED" }], "running"],
  [[{ conclusion: "SUCCESS" }, { conclusion: "SKIPPED" }, { state: "SUCCESS" }], "ok"],
  [[{ status: "COMPLETED", conclusion: "NEUTRAL" }], "ok"],
  [[{ state: "FAILURE" }, { conclusion: "SUCCESS" }], "error"],
  [[{ state: "ERROR" }], "error"],
  [[{ status: "COMPLETED", conclusion: "TIMED_OUT" }], "error"],
  [[{ status: "COMPLETED", conclusion: "CANCELLED" }, { state: "PENDING" }], "error"],
];

test.each(TONES)("checks %j give %p", (rollup, tone) => {
  expect(prChecksTone(rollup)).toBe(tone);
});

test("a review decision maps to the closed review states", () => {
  expect(parseReviewDecision("")).toBe("none");
  expect(parseReviewDecision(null)).toBe("none");
  expect(parseReviewDecision("APPROVED")).toBe("approved");
  expect(parseReviewDecision("CHANGES_REQUESTED")).toBe("changes_requested");
  expect(parseReviewDecision("REVIEW_REQUIRED")).toBe("review_required");
  expect(parseReviewDecision("X")).toBe("none");
  expect(parseReviewDecision(3)).toBe("none");
});

const run = (prNumber: number | null, status: string, conclusion: string | null): CiRun => ({
  repo: "acme/emis",
  runId: Math.floor(Math.random() * 1e6),
  prNumber,
  ticketKey: null,
  headSha: "abc1234",
  workflow: `ci-${prNumber}`,
  status,
  conclusion,
  url: "https://github.com/acme/emis/actions/runs/1",
  startedAt: null,
  updatedAt: "2026-10-16T10:00:00Z",
  jobs: [],
});

test("a ci run of the pull request wins over its checks", () => {
  expect(prCiTone({ number: 20, checks: "ok" }, [run(20, "completed", "failure")])).toBe("error");
});

test("without a ci run of the pull request, its checks give the tone", () => {
  expect(prCiTone({ number: 20, checks: "running" }, [run(21, "completed", "failure")])).toBe("running");
  expect(prCiTone({ number: 20, checks: null }, [])).toBeNull();
});
