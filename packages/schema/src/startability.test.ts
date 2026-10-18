import { expect, test } from "bun:test";
import fc from "fast-check";
import { type StartContext, type StartFacts, startable } from "./startability";
import { isStartable } from "./startable";
import { StatusId } from "./status";

const S42 = { code: "S42", start: "2026-10-12" };
const S43 = { code: "S43", start: "2026-10-19" };
const ctx: StartContext = { today: "2026-10-16", limit: 2, inProgressFeatures: new Set(["f4", "f5"]) };
const ready: StartFacts = {
  statusId: "todo",
  busy: false,
  blockers: [],
  blockingQuestion: null,
  feature: { id: "f4", sprint: S42 },
};

test("a step of a feature already in progress, in the current sprint, is startable", () => {
  expect(startable(ready, ctx)).toEqual({ startable: true });
  expect(startable({ ...ready, statusId: "backlog" }, ctx)).toEqual({ startable: true });
});

test("a ticket outside any feature ignores sprints and the limit", () => {
  expect(startable({ ...ready, feature: null }, ctx)).toEqual({ startable: true });
});

test("a step waits for its undelivered dependencies", () => {
  const delivered = { key: "EMIS-32", statusId: "done" as const };
  const blockers = [delivered, { key: "EMIS-33", statusId: "in_review" as const }];
  expect(startable({ ...ready, blockers }, ctx)).toEqual({
    startable: false,
    reason: { kind: "dependency", keys: ["EMIS-33"] },
  });
  expect(startable({ ...ready, blockers: [delivered] }, ctx)).toEqual({ startable: true });
});

test("an open blocking question stops a step, named by its Qn", () => {
  const blockingQuestion = { number: 14, importRef: null };
  expect(startable({ ...ready, blockingQuestion }, ctx)).toEqual({
    startable: false,
    reason: { kind: "question", label: "Q14" },
  });
});

test("a step of a feature planned in a future sprint waits for that sprint", () => {
  expect(startable({ ...ready, feature: { id: "f6", sprint: S43 } }, ctx)).toEqual({
    startable: false,
    reason: { kind: "sprint", code: "S43" },
  });
  expect(
    startable({ ...ready, feature: { id: "f6", sprint: S43 } }, { ...ctx, today: "2026-10-19", limit: 3 }),
  ).toEqual({ startable: true });
});

test("a step of a feature in a past sprint is startable", () => {
  const past = { code: "S41", start: "2026-10-05" };
  expect(startable({ ...ready, feature: { id: "f5", sprint: past } }, ctx)).toEqual({ startable: true });
});

test("a step of an unplanned feature is not startable", () => {
  expect(startable({ ...ready, feature: { id: "f9", sprint: null } }, ctx)).toEqual({
    startable: false,
    reason: { kind: "unplanned" },
  });
});

test("the limit of features in progress stops a new feature, not one already in progress", () => {
  const f7 = { id: "f7", sprint: S42 };
  expect(startable({ ...ready, feature: f7 }, ctx)).toEqual({
    startable: false,
    reason: { kind: "limit", limit: 2 },
  });
  expect(startable({ ...ready, feature: f7 }, { ...ctx, limit: 3 })).toEqual({ startable: true });
  expect(startable(ready, { ...ctx, limit: 1 })).toEqual({ startable: true });
});

test("a ticket already started or held by a session is not startable", () => {
  expect(startable({ ...ready, statusId: "in_progress" }, ctx)).toEqual({
    startable: false,
    reason: { kind: "status" },
  });
  expect(startable({ ...ready, busy: true }, ctx)).toEqual({ startable: false, reason: { kind: "status" } });
});

test("reasons come in order: status, dependency, question, sprint, limit", () => {
  const all: StartFacts = {
    statusId: "todo",
    busy: false,
    blockers: [{ key: "EMIS-33", statusId: "todo" }],
    blockingQuestion: { number: 14, importRef: null },
    feature: { id: "f6", sprint: S43 },
  };
  const full = { ...ctx, limit: 1 };
  expect(startable(all, full)).toMatchObject({ reason: { kind: "dependency" } });
  expect(startable({ ...all, blockers: [] }, full)).toMatchObject({ reason: { kind: "question" } });
  expect(startable({ ...all, blockers: [], blockingQuestion: null }, full)).toMatchObject({
    reason: { kind: "sprint" },
  });
});

const factsArb = fc.record({
  statusId: fc.constantFrom(...StatusId.options),
  busy: fc.boolean(),
  blockers: fc.array(
    fc.record({ key: fc.constantFrom("EMIS-1", "EMIS-2"), statusId: fc.constantFrom(...StatusId.options) }),
    { maxLength: 3 },
  ),
  blockingQuestion: fc.option(
    fc.record({ number: fc.integer({ min: 1, max: 30 }), importRef: fc.constant(null) }),
  ),
  feature: fc.constant(null),
});

test("outside any feature, the rule agrees with the former isStartable", () => {
  fc.assert(
    fc.property(factsArb, (facts) => {
      const former = isStartable({
        statusId: facts.statusId,
        blockerStatuses: facts.blockers.map((b) => b.statusId),
        openBlockingQuestions: facts.blockingQuestion === null ? 0 : 1,
        busy: facts.busy,
      });
      expect(startable(facts, ctx).startable).toBe(former);
    }),
  );
});
