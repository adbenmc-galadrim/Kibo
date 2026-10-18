import { expect, test } from "bun:test";
import fc from "fast-check";
import { dateOf, dayNumber } from "./iso-date";
import type { ProjectSetup } from "./project-setup";
import { sprintPlan, sprintPlanEnd } from "./sprint-plan";

const setup: fc.Arbitrary<ProjectSetup> = fc.record({
  sprintStart: fc.integer({ min: dayNumber("1990-01-01"), max: dayNumber("2100-01-01") }).map(dateOf),
  sprintCount: fc.integer({ min: 1, max: 52 }),
  sprintWeeks: fc.constantFrom(1 as const, 2 as const),
});

test("n sprints with unique codes S1 to Sn", () => {
  fc.assert(
    fc.property(setup, (s) => {
      const plan = sprintPlan(s);
      expect(plan).toHaveLength(s.sprintCount);
      expect(plan.map((p) => p.code)).toEqual(plan.map((_, i) => `S${i + 1}`));
      expect(new Set(plan.map((p) => p.code)).size).toBe(s.sprintCount);
    }),
  );
});

test("each sprint starts a cycle later and lasts 7w - 3 days", () => {
  fc.assert(
    fc.property(setup, (s) => {
      const start = dayNumber(s.sprintStart);
      sprintPlan(s).forEach((p, i) => {
        expect(dayNumber(p.start)).toBe(start + i * 7 * s.sprintWeeks);
        expect(dayNumber(p.end) - dayNumber(p.start)).toBe(7 * s.sprintWeeks - 3);
      });
    }),
  );
});

test("sprints are disjoint and increasing, the plan ends with the last one", () => {
  fc.assert(
    fc.property(setup, (s) => {
      const plan = sprintPlan(s);
      for (let i = 1; i < plan.length; i++) {
        const previous = plan[i - 1];
        const current = plan[i];
        if (previous === undefined || current === undefined) continue;
        expect(previous.end < current.start).toBe(true);
      }
      expect(sprintPlanEnd(s)).toBe(plan.at(-1)?.end ?? "");
    }),
  );
});
