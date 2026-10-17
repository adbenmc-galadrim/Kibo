import { expect, test } from "bun:test";
import type { GithubPrRef, PrReview } from "./external-ref";
import { nextDeliverableStep } from "./next-step";
import type { StatusId } from "./status";

const pr = (review: PrReview): GithubPrRef => ({
  kind: "github_pr",
  url: "https://github.com/acme/emis/pull/20",
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
});

test("a step back from review with changes requested is the next to deliver", () => {
  const f4 = [
    step("EMIS-41", "done"),
    step("EMIS-42", "done"),
    step("EMIS-43", "done"),
    step("EMIS-45", "in_review", "changes_requested"),
    step("EMIS-46", "todo"),
  ];
  expect(nextDeliverableStep(f4)).toBe("EMIS-45");
});

test("a step in review without requested changes or already in progress is skipped", () => {
  const f5 = [
    step("EMIS-31", "done"),
    step("EMIS-32", "in_review", "none"),
    step("EMIS-33", "in_progress"),
    step("EMIS-34", "todo"),
    step("EMIS-35", "todo"),
  ];
  expect(nextDeliverableStep(f5)).toBe("EMIS-34");
  expect(nextDeliverableStep([step("a", "in_review", "approved"), step("b", "in_review")])).toBeNull();
  expect(nextDeliverableStep([step("a", "blocked"), step("b", "backlog")])).toBe("b");
});

test("a delivered feature has no next step", () => {
  expect(nextDeliverableStep([step("a", "done"), step("b", "done")])).toBeNull();
  expect(nextDeliverableStep([])).toBeNull();
});
