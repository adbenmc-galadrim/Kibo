import { expect, test } from "bun:test";
import type { GithubPrRef, PrReview } from "./external-ref";
import { nextDeliverableStep } from "./next-step";
import type { StatusId } from "./status";

const pr = (review: PrReview): GithubPrRef => ({
  kind: "github_pr",
  url: "https://github.com/acme/silo/pull/20",
  number: 20,
  state: "open",
  base: "dev",
  head: null,
  review,
  checks: null,
});
const step = (ticketId: string, statusId: StatusId, review?: PrReview) => ({
  ticketId,
  statusId,
  optional: false,
  pr: review === undefined ? null : pr(review),
  onHold: null,
});

test("a step back from review with changes requested is the next to deliver", () => {
  const f4 = [
    step("SILO-41", "done"),
    step("SILO-42", "done"),
    step("SILO-43", "done"),
    step("SILO-45", "in_review", "changes_requested"),
    step("SILO-46", "todo"),
  ];
  expect(nextDeliverableStep(f4)).toBe("SILO-45");
});

test("a step in review without requested changes or already in progress is skipped", () => {
  const f5 = [
    step("SILO-31", "done"),
    step("SILO-32", "in_review", "none"),
    step("SILO-33", "in_progress"),
    step("SILO-34", "todo"),
    step("SILO-35", "todo"),
  ];
  expect(nextDeliverableStep(f5)).toBe("SILO-34");
  expect(nextDeliverableStep([step("a", "in_review", "approved"), step("b", "in_review")])).toBeNull();
  expect(nextDeliverableStep([step("a", "blocked"), step("b", "backlog")])).toBe("b");
});

test("a delivered feature has no next step", () => {
  expect(nextDeliverableStep([step("a", "done"), step("b", "done")])).toBeNull();
  expect(nextDeliverableStep([])).toBeNull();
});

test("a step on hold is skipped", () => {
  const onHold = { source: "own" as const, key: "SILO-33", reason: "R", since: "2026-10-16" };
  const f5 = [step("SILO-31", "done"), { ...step("SILO-33", "todo"), onHold }, step("SILO-34", "todo")];
  expect(nextDeliverableStep(f5)).toBe("SILO-34");
  expect(nextDeliverableStep([{ ...step("SILO-33", "todo"), onHold }])).toBeNull();
});
