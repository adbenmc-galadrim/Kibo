import { expect, test } from "bun:test";
import fc from "fast-check";
import { type AtRiskFeature, type AtRiskStep, atRisk, workingDaysLeft } from "./at-risk";
import { PrReview, PrState } from "./external-ref";
import { addDays } from "./iso-date";
import { sprintPhase } from "./sprint-phase";
import { StatusId } from "./status";

const S42 = { start: "2026-10-12", end: "2026-10-16" };
const step = (statusId: StatusId, optional = false, review: AtRiskStep["pr"] = null): AtRiskStep => ({
  statusId,
  optional,
  pr: review,
});
const todo = (n: number) => Array.from({ length: n }, () => step("todo"));
const feature = (steps: AtRiskStep[], sprint: AtRiskFeature["sprint"] = S42): AtRiskFeature => ({
  sprint,
  steps,
});

test("working days left count today and skip the weekend", () => {
  expect(workingDaysLeft(S42, "2026-10-12")).toBe(5);
  expect(workingDaysLeft(S42, "2026-10-14")).toBe(3);
  expect(workingDaysLeft(S42, "2026-10-16")).toBe(1);
  expect(workingDaysLeft(S42, "2026-10-17")).toBe(0);
  expect(workingDaysLeft({ start: "2026-10-12", end: "2026-10-25" }, "2026-10-16")).toBe(6);
  expect(workingDaysLeft({ start: "2026-10-12", end: "2026-10-18" }, "2026-10-17")).toBe(0);
  expect(workingDaysLeft(S42, "2026-10-01")).toBe(5);
});

test("a feature is at risk when its mandatory steps left exceed the working days left", () => {
  expect(atRisk(feature([step("done"), ...todo(3)]), "2026-10-14")).toBe(false);
  expect(atRisk(feature([step("done"), ...todo(4)]), "2026-10-14")).toBe(true);
  expect(atRisk(feature([...todo(3), step("todo", true), step("todo", true)]), "2026-10-14")).toBe(false);
  expect(atRisk(feature([step("in_review"), step("todo")]), "2026-10-16")).toBe(true);
  expect(atRisk(feature([step("done"), step("in_review")]), "2026-10-16")).toBe(false);
});

test("changes requested on the last day put a feature at risk", () => {
  const changes = [step("done"), step("in_review", false, { state: "open", review: "changes_requested" })];
  expect(atRisk(feature(changes), "2026-10-16")).toBe(true);
  expect(atRisk(feature(changes), "2026-10-15")).toBe(false);
  const approved = [step("done"), step("in_review", false, { state: "open", review: "approved" })];
  expect(atRisk(feature(approved), "2026-10-16")).toBe(false);
  const merged = [step("done", false, { state: "open", review: "changes_requested" }), step("in_review")];
  expect(atRisk(feature(merged), "2026-10-16")).toBe(false);
});

test("changes requested on a merged PR do not put a feature at risk", () => {
  const merged = [step("done"), step("in_review", false, { state: "merged", review: "changes_requested" })];
  expect(atRisk(feature(merged), "2026-10-16")).toBe(false);
  const open = [step("done"), step("in_review", false, { state: "open", review: "changes_requested" })];
  expect(atRisk(feature(open), "2026-10-16")).toBe(true);
});

test("only a feature of the running sprint can be at risk", () => {
  const heavy = todo(9);
  expect(atRisk(feature(heavy), "2026-10-11")).toBe(false);
  expect(atRisk(feature(heavy), "2026-10-17")).toBe(false);
  expect(atRisk(feature(heavy, null), "2026-10-14")).toBe(false);
  expect(atRisk(feature([step("done"), step("done")]), "2026-10-16")).toBe(false);
});

const dateArb = fc.integer({ min: 0, max: 2000 }).map((n) => addDays("2025-01-05", n));
const sprintArb = fc
  .tuple(dateArb, fc.integer({ min: 0, max: 20 }))
  .map(([start, length]) => ({ start, end: addDays(start, length) }));
const stepArb = fc.record({
  statusId: fc.constantFrom(...StatusId.options),
  optional: fc.boolean(),
  pr: fc.option(
    fc.record({
      state: fc.constantFrom(...PrState.options),
      review: fc.constantFrom(...PrReview.options),
    }),
  ),
});

test("at risk only while the sprint runs, with mandatory steps left", () => {
  fc.assert(
    fc.property(sprintArb, dateArb, fc.array(stepArb, { maxLength: 8 }), (sprint, today, steps) => {
      const days = workingDaysLeft(sprint, today);
      expect(days).toBeGreaterThanOrEqual(0);
      expect(days).toBeLessThanOrEqual(21);
      if (!atRisk({ sprint, steps }, today)) return;
      expect(["current", "ends-today"]).toContain(sprintPhase(sprint, today));
      expect(steps.some((s) => !s.optional && s.statusId !== "done") || sprint.end === today).toBe(true);
    }),
  );
});
