import { expect, test } from "bun:test";
import { sprintPlan, sprintPlanEnd } from "./sprint-plan";

test("six one-week sprints run Monday to Friday", () => {
  const plan = sprintPlan({ sprintStart: "2026-10-19", sprintCount: 6, sprintWeeks: 1 });
  expect(plan).toEqual([
    { code: "S1", name: "Sprint 1", start: "2026-10-19", end: "2026-10-23" },
    { code: "S2", name: "Sprint 2", start: "2026-10-26", end: "2026-10-30" },
    { code: "S3", name: "Sprint 3", start: "2026-11-02", end: "2026-11-06" },
    { code: "S4", name: "Sprint 4", start: "2026-11-09", end: "2026-11-13" },
    { code: "S5", name: "Sprint 5", start: "2026-11-16", end: "2026-11-20" },
    { code: "S6", name: "Sprint 6", start: "2026-11-23", end: "2026-11-27" },
  ]);
  expect(sprintPlanEnd({ sprintStart: "2026-10-19", sprintCount: 6, sprintWeeks: 1 })).toBe("2026-11-27");
});

test("two-week sprints last eleven days", () => {
  const plan = sprintPlan({ sprintStart: "2026-10-19", sprintCount: 2, sprintWeeks: 2 });
  expect(plan).toEqual([
    { code: "S1", name: "Sprint 1", start: "2026-10-19", end: "2026-10-30" },
    { code: "S2", name: "Sprint 2", start: "2026-11-02", end: "2026-11-13" },
  ]);
  expect(sprintPlanEnd({ sprintStart: "2026-10-19", sprintCount: 2, sprintWeeks: 2 })).toBe("2026-11-13");
});

test("the plan crosses leap days and years", () => {
  const plan = sprintPlan({ sprintStart: "2028-02-28", sprintCount: 1, sprintWeeks: 1 });
  expect(plan[0]).toEqual({ code: "S1", name: "Sprint 1", start: "2028-02-28", end: "2028-03-03" });
  expect(sprintPlanEnd({ sprintStart: "2026-12-21", sprintCount: 2, sprintWeeks: 1 })).toBe("2027-01-01");
});
