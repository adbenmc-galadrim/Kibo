import { expect, test } from "bun:test";
import { KiboError, SPRINT_COUNT_MAX } from "@kibo/schema";
import fc from "fast-check";
import { featureSprints, planSprints, type StepInput } from "./plan-sprints";

const acyclic: fc.Arbitrary<StepInput[]> = fc
  .array(
    fc.record({ feature: fc.integer({ min: 1, max: 6 }), blockers: fc.array(fc.nat(), { maxLength: 3 }) }),
    { minLength: 1, maxLength: 60 },
  )
  .chain((rows) =>
    fc.shuffledSubarray(
      rows.map((row, i) => ({
        key: `S${i}`,
        feature: `F${row.feature}`,
        order: i,
        blockedBy: i === 0 ? [] : [...new Set(row.blockers.map((b) => `S${b % i}`))],
      })),
      { minLength: rows.length, maxLength: rows.length },
    ),
  );
const capacity = fc.integer({ min: 1, max: 8 });

function attempt(steps: readonly StepInput[], v: number) {
  try {
    return planSprints(steps, v);
  } catch (e) {
    if (e instanceof KiboError && e.detail.startsWith("plan trop long")) return null;
    throw e;
  }
}

test("every step is placed once, after its blockers, with nothing forced", () => {
  fc.assert(
    fc.property(acyclic, capacity, (steps, v) => {
      const plan = attempt(steps, v);
      if (plan === null) return;
      expect(plan.forced).toEqual([]);
      expect(plan.slots.map((s) => s.key).sort()).toEqual(steps.map((s) => s.key).sort());
      const at = new Map(plan.slots.map((s, i) => [s.key, { index: i, sprint: s.sprint }]));
      for (const s of steps)
        for (const b of s.blockedBy) {
          expect(at.get(b)?.index ?? -1).toBeLessThan(at.get(s.key)?.index ?? -1);
          expect(at.get(b)?.sprint ?? 0).toBeLessThanOrEqual(at.get(s.key)?.sprint ?? 0);
        }
    }),
  );
});

test("each sprint holds at most v steps and only the last one is partial", () => {
  fc.assert(
    fc.property(acyclic, capacity, (steps, v) => {
      const plan = attempt(steps, v);
      if (plan === null) return;
      const loads = new Map<number, number>();
      for (const s of plan.slots) loads.set(s.sprint, (loads.get(s.sprint) ?? 0) + 1);
      const count = Math.ceil(steps.length / v);
      for (let sprint = 1; sprint <= count; sprint += 1)
        expect(loads.get(sprint)).toBe(sprint < count ? v : steps.length - (count - 1) * v);
    }),
  );
});

test("without blockers steps follow the plan order", () => {
  fc.assert(
    fc.property(acyclic, capacity, (steps, v) => {
      const free = steps.map((s) => ({ ...s, blockedBy: [] }));
      const plan = attempt(free, v);
      if (plan === null) return;
      expect(plan.slots.map((s) => s.key)).toEqual(
        [...free].sort((a, b) => a.order - b.order).map((s) => s.key),
      );
    }),
  );
});

test("a feature ends in the sprint of its last placed step", () => {
  fc.assert(
    fc.property(acyclic, capacity, (steps, v) => {
      const plan = attempt(steps, v);
      if (plan === null) return;
      for (const f of featureSprints(plan.slots, ["F1", "F2", "F3", "F4", "F5", "F6"]))
        expect(f.sprint).toBe(Math.max(...plan.slots.filter((s) => s.feature === f.id).map((s) => s.sprint)));
    }),
  );
});

test("never more than 52 sprints: a longer plan is an explicit error", () => {
  fc.assert(
    fc.property(fc.integer({ min: 1, max: 500 }), capacity, (n, v) => {
      const steps = Array.from({ length: n }, (_, i) => ({
        key: `S${i}`,
        feature: "F1",
        order: i,
        blockedBy: [],
      }));
      const plan = attempt(steps, v);
      if (n > SPRINT_COUNT_MAX * v) expect(plan).toBeNull();
      else
        expect(Math.max(...(plan?.slots ?? []).map((s) => s.sprint))).toBeLessThanOrEqual(SPRINT_COUNT_MAX);
    }),
  );
});
