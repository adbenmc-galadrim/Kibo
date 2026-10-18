import { expect, test } from "bun:test";
import { KiboError, SPRINT_COUNT_MAX } from "@kibo/schema";
import fc from "fast-check";
import { type PlanInput, planSprints } from "./plan-sprints";

const acyclic: fc.Arbitrary<PlanInput[]> = fc
  .array(
    fc.record({ remaining: fc.integer({ min: 0, max: 12 }), blockers: fc.array(fc.nat(), { maxLength: 3 }) }),
    {
      minLength: 1,
      maxLength: 15,
    },
  )
  .chain((rows) =>
    fc.shuffledSubarray(
      rows.map((row, i) => ({
        id: `F${i + 1}`,
        order: i,
        remaining: row.remaining,
        blockedBy: i === 0 ? [] : [...new Set(row.blockers.map((b) => `F${(b % i) + 1}`))],
      })),
      { minLength: rows.length, maxLength: rows.length },
    ),
  );
const capacity = fc.integer({ min: 1, max: 8 });

function attempt(features: readonly PlanInput[], v: number) {
  try {
    return planSprints(features, v);
  } catch (e) {
    if (e instanceof KiboError && e.detail.startsWith("plan trop long")) return null;
    throw e;
  }
}

test("a blocker is planned before what it blocks and never in a later sprint", () => {
  fc.assert(
    fc.property(acyclic, capacity, (features, v) => {
      const plan = attempt(features, v);
      if (plan === null) return;
      const at = new Map(plan.map((p, i) => [p.id, { index: i, sprint: p.sprint }]));
      for (const f of features)
        for (const b of f.blockedBy) {
          const mine = at.get(f.id);
          const theirs = at.get(b);
          if (mine && theirs) {
            expect(theirs.index).toBeLessThan(mine.index);
            expect(theirs.sprint).toBeLessThanOrEqual(mine.sprint);
          }
        }
    }),
  );
});

test("without blockers the plan follows the plan order", () => {
  fc.assert(
    fc.property(acyclic, capacity, (features, v) => {
      const free = features.map((f) => ({ ...f, blockedBy: [] }));
      const plan = attempt(free, v);
      if (plan === null) return;
      const expected = [...free].filter((f) => f.remaining > 0).sort((a, b) => a.order - b.order);
      expect(plan.map((p) => p.id)).toEqual(expected.map((f) => f.id));
    }),
  );
});

test("each sprint holds at most v steps, a feature only overflowing into the next sprints", () => {
  fc.assert(
    fc.property(acyclic, capacity, (features, v) => {
      const plan = attempt(features, v);
      if (plan === null) return;
      const remaining = new Map(features.map((f) => [f.id, f.remaining]));
      let used = 0;
      for (const p of plan) {
        used += remaining.get(p.id) ?? 0;
        expect(used).toBeLessThanOrEqual(p.sprint * v);
        expect(used).toBeGreaterThan((p.sprint - 1) * v);
      }
      expect(plan.every((p) => (remaining.get(p.id) ?? 0) > 0)).toBe(true);
    }),
  );
});

test("never more than 52 sprints: a longer plan is an explicit error", () => {
  fc.assert(
    fc.property(
      fc.array(fc.integer({ min: 0, max: 40 }), { minLength: 1, maxLength: 15 }),
      capacity,
      (sizes, v) => {
        const features = sizes.map((remaining, i) => ({
          id: `F${i + 1}`,
          order: i,
          remaining,
          blockedBy: [],
        }));
        const total = sizes.reduce((n, s) => n + s, 0);
        const plan = attempt(features, v);
        if (total > SPRINT_COUNT_MAX * v) expect(plan).toBeNull();
        else expect(Math.max(0, ...(plan ?? []).map((p) => p.sprint))).toBeLessThanOrEqual(SPRINT_COUNT_MAX);
      },
    ),
  );
});
