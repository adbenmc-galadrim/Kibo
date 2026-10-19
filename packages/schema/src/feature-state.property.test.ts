import { expect, test } from "bun:test";
import fc from "fast-check";
import { featureState, isOpenFeature } from "./feature-state";
import { NOT_STARTED_STATUSES } from "./startable";
import { StatusId } from "./status";

const dateArb = fc
  .date({ min: new Date("2026-01-01T00:00:00Z"), max: new Date("2027-12-31T00:00:00Z"), noInvalidDate: true })
  .map((d) => d.toISOString().slice(0, 10));
const stepsArb = fc.array(
  fc.record({ statusId: fc.constantFrom(...StatusId.options), optional: fc.boolean() }),
  { minLength: 1, maxLength: 8 },
);
const inputArb = fc.record({
  steps: stepsArb.map((list) => list.map((s, i) => ({ ...s, ticketId: `e${i}`, onHold: null }))),
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

test("an open feature has a started step and is not delivered, whatever the day and the sprint", () => {
  fc.assert(
    fc.property(inputArb, ({ steps, blocking, sprint, today }) => {
      const state = featureState({ steps, blockingQuestions: new Set(blocking), sprint, today });
      if (!isOpenFeature(state)) return;
      expect(steps.some((s) => !NOT_STARTED_STATUSES.includes(s.statusId))).toBe(true);
      expect(state.status).not.toBe("delivered");
    }),
  );
});

test("a feature with mandatory steps left is late only after the last day of its sprint", () => {
  fc.assert(
    fc.property(inputArb, fc.boolean(), ({ steps, blocking, sprint: drawn, today }, lastDay) => {
      const sprint = lastDay ? { end: today } : drawn;
      const state = featureState({ steps, blockingQuestions: new Set(blocking), sprint, today });
      const left = steps.filter((s) => !s.optional && s.statusId !== "done");
      const due = sprint !== null && sprint.end < today;
      if (state.status === "late") expect(due).toBe(true);
      if (due && left.length > 0 && state.status !== "blocked") expect(state.status).toBe("late");
    }),
  );
});

const HOLD = { source: "own" as const, key: "SILO-1", reason: "R", since: "2026-10-16" };
const heldInputArb = fc.record({
  steps: fc
    .array(
      fc.record({
        statusId: fc.constantFrom(...StatusId.options),
        optional: fc.boolean(),
        held: fc.boolean(),
      }),
      {
        minLength: 1,
        maxLength: 8,
      },
    )
    .map((list) =>
      list.map(({ held, ...s }, i) => ({ ...s, ticketId: `e${i}`, onHold: held ? HOLD : null })),
    ),
  blocking: fc.array(
    fc.nat(7).map((i) => `e${i}`),
    { maxLength: 3 },
  ),
  sprint: fc.option(dateArb.map((end) => ({ end }))),
  today: dateArb,
});

test("a step on hold counts as if it were not there, apart from the held count", () => {
  fc.assert(
    fc.property(heldInputArb, ({ steps, blocking, sprint, today }) => {
      const blockingQuestions = new Set(blocking);
      const active = steps.filter((s) => s.onHold === null);
      const { held, ...withHolds } = featureState({ steps, blockingQuestions, sprint, today });
      const { held: none, ...without } = featureState({ steps: active, blockingQuestions, sprint, today });
      expect(held).toBe(steps.length - active.length);
      expect(none).toBe(0);
      expect(withHolds.steps).toEqual(without.steps);
      expect(withHolds.remaining).toBe(without.remaining);
      expect(withHolds.nextStepId).toBe(without.nextStepId);
      expect(withHolds.started).toBe(without.started);
      if (active.length > 0) expect(withHolds.status).toBe(without.status);
    }),
  );
});

test("a delivered feature has at least one step that is not on hold", () => {
  fc.assert(
    fc.property(heldInputArb, ({ steps, blocking, sprint, today }) => {
      const state = featureState({ steps, blockingQuestions: new Set(blocking), sprint, today });
      if (state.status === "delivered") expect(steps.some((s) => s.onHold === null)).toBe(true);
    }),
  );
});
