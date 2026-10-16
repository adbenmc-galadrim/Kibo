import { expect, test } from "bun:test";
import fc from "fast-check";
import { featureState } from "./feature-state";
import { StatusId } from "./status";

const dateArb = fc
  .date({ min: new Date("2026-01-01T00:00:00Z"), max: new Date("2027-12-31T00:00:00Z"), noInvalidDate: true })
  .map((d) => d.toISOString().slice(0, 10));
const stepsArb = fc.array(
  fc.record({ statusId: fc.constantFrom(...StatusId.options), optional: fc.boolean() }),
  { minLength: 1, maxLength: 8 },
);
const inputArb = fc.record({
  steps: stepsArb.map((list) => list.map((s, i) => ({ ...s, ticketId: `e${i}` }))),
  blocking: fc.array(
    fc.nat(7).map((i) => `e${i}`),
    { maxLength: 3 },
  ),
  sprint: fc.option(dateArb.map((end) => ({ end }))),
  today: dateArb,
  otherDay: dateArb,
});

test("today only changes whether a feature is late", () => {
  fc.assert(
    fc.property(inputArb, ({ steps, blocking, sprint, today, otherDay }) => {
      const blockingQuestions = new Set(blocking);
      const a = featureState({ steps, blockingQuestions, sprint, today });
      const b = featureState({ steps, blockingQuestions, sprint, today: otherDay });
      const { status: statusA, ...restA } = a;
      const { status: statusB, ...restB } = b;
      expect(restA).toEqual(restB);
      if (statusA !== statusB) expect(statusA === "late" || statusB === "late").toBe(true);
    }),
  );
});

test("a feature is delivered exactly when all its mandatory steps are done", () => {
  fc.assert(
    fc.property(inputArb, ({ steps, blocking, sprint, today }) => {
      const state = featureState({ steps, blockingQuestions: new Set(blocking), sprint, today });
      const mandatoryDone = steps.filter((s) => !s.optional).every((s) => s.statusId === "done");
      expect(state.status === "delivered").toBe(mandatoryDone);
    }),
  );
});
