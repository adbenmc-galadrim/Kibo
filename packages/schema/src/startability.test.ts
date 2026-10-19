import { expect, test } from "bun:test";
import fc from "fast-check";
import { lastStepWaitsOn, type StartContext, type StartFacts, startable } from "./startability";
import { isStartable } from "./startable";
import { StatusId } from "./status";

const S42 = { code: "S42", start: "2026-10-12" };
const S43 = { code: "S43", start: "2026-10-19" };
const ctx: StartContext = {
  today: "2026-10-16",
  limit: 2,
  inProgressFeatures: new Set(["f4", "f5"]),
  planned: true,
};
const ready: StartFacts = {
  statusId: "todo",
  busy: false,
  blockers: [],
  blockingQuestion: null,
  onHold: null,
  feature: { id: "f4", sprint: S42, waitingSteps: [] },
};

test("a step of a feature already in progress, in the current sprint, is startable", () => {
  expect(startable(ready, ctx)).toEqual({ startable: true });
  expect(startable({ ...ready, statusId: "backlog" }, ctx)).toEqual({ startable: true });
});

test("a ticket outside any feature ignores sprints and the limit", () => {
  expect(startable({ ...ready, feature: null }, ctx)).toEqual({ startable: true });
});

test("a step waits for its undelivered dependencies", () => {
  const delivered = { key: "SILO-32", statusId: "done" as const };
  const blockers = [delivered, { key: "SILO-33", statusId: "in_review" as const }];
  expect(startable({ ...ready, blockers }, ctx)).toEqual({
    startable: false,
    reason: { kind: "dependency", keys: ["SILO-33"] },
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
  expect(startable({ ...ready, feature: { id: "f6", sprint: S43, waitingSteps: [] } }, ctx)).toEqual({
    startable: false,
    reason: { kind: "sprint", code: "S43" },
  });
  expect(
    startable(
      { ...ready, feature: { id: "f6", sprint: S43, waitingSteps: [] } },
      { ...ctx, today: "2026-10-19", limit: 3 },
    ),
  ).toEqual({ startable: true });
});

test("a step of a feature in a past sprint is startable", () => {
  const past = { code: "S41", start: "2026-10-05" };
  expect(startable({ ...ready, feature: { id: "f5", sprint: past, waitingSteps: [] } }, ctx)).toEqual({
    startable: true,
  });
});

test("a step of an unplanned feature is not startable", () => {
  expect(startable({ ...ready, feature: { id: "f9", sprint: null, waitingSteps: [] } }, ctx)).toEqual({
    startable: false,
    reason: { kind: "unplanned" },
  });
});

test("in a project without any sprint, the sprint condition does not apply, the limit still does", () => {
  const unplanned = { ...ctx, planned: false };
  expect(startable({ ...ready, feature: { id: "f4", sprint: null, waitingSteps: [] } }, unplanned)).toEqual({
    startable: true,
  });
  expect(
    startable({ ...ready, feature: { id: "f6", sprint: S43, waitingSteps: [] } }, { ...unplanned, limit: 3 }),
  ).toEqual({
    startable: true,
  });
  expect(startable({ ...ready, feature: { id: "f7", sprint: null, waitingSteps: [] } }, unplanned)).toEqual({
    startable: false,
    reason: { kind: "limit", limit: 2, count: 2 },
  });
});

test("the limit of features in progress stops a new feature, not one already in progress", () => {
  const f7 = { id: "f7", sprint: S42, waitingSteps: [] };
  expect(startable({ ...ready, feature: f7 }, ctx)).toEqual({
    startable: false,
    reason: { kind: "limit", limit: 2, count: 2 },
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
    blockers: [{ key: "SILO-33", statusId: "todo" }],
    blockingQuestion: { number: 14, importRef: null },
    onHold: null,
    feature: { id: "f6", sprint: S43, waitingSteps: [] },
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
    fc.record({ key: fc.constantFrom("SILO-1", "SILO-2"), statusId: fc.constantFrom(...StatusId.options) }),
    { maxLength: 3 },
  ),
  blockingQuestion: fc.option(
    fc.record({ number: fc.integer({ min: 1, max: 30 }), importRef: fc.constant(null) }),
  ),
  onHold: fc.constant(null),
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

const steps = [
  { ticketId: "s1", key: "PFD-1", statusId: "done" as const, optional: false, onHold: null },
  { ticketId: "s2", key: "PFD-2", statusId: "in_review" as const, optional: false, onHold: null },
  { ticketId: "s3", key: "PFD-3", statusId: "todo" as const, optional: false, onHold: null },
  { ticketId: "s4", key: "PFD-4", statusId: "todo" as const, optional: true, onHold: null },
  { ticketId: "s5", key: "PFD-5", statusId: "todo" as const, optional: true, onHold: null },
];

test("the last step waits for the other mandatory steps not delivered", () => {
  expect(lastStepWaitsOn("s5", steps)).toEqual(["PFD-2", "PFD-3"]);
});

test("an optional step never makes the last step wait, and only the last step waits", () => {
  expect(lastStepWaitsOn("s5", steps).includes("PFD-4")).toBe(false);
  expect(lastStepWaitsOn("s3", steps)).toEqual([]);
  expect(lastStepWaitsOn("s4", steps)).toEqual([]);
});

test("the only step of a feature does not wait", () => {
  expect(
    lastStepWaitsOn("s1", [
      { ticketId: "s1", key: "PFD-1", statusId: "todo", optional: false, onHold: null },
    ]),
  ).toEqual([]);
});

test("the last step is startable once the other mandatory steps are delivered", () => {
  const delivered = steps.map((s) => (s.optional ? s : { ...s, statusId: "done" as const }));
  expect(lastStepWaitsOn("s5", delivered)).toEqual([]);
});

test("a last step waiting for the others says « attend PFD-3 », after its own dependencies", () => {
  const feature = { id: "f4", sprint: S42, waitingSteps: ["PFD-2", "PFD-3"] };
  expect(startable({ ...ready, feature }, ctx)).toEqual({
    startable: false,
    reason: { kind: "dependency", keys: ["PFD-2", "PFD-3"] },
  });
  const blockers = [
    { key: "PFD-3", statusId: "todo" as const },
    { key: "SILO-9", statusId: "todo" as const },
  ];
  expect(startable({ ...ready, blockers, feature }, ctx)).toEqual({
    startable: false,
    reason: { kind: "dependency", keys: ["PFD-3", "SILO-9", "PFD-2"] },
  });
});

const stepArb = fc.record({
  statusId: fc.constantFrom(...StatusId.options),
  optional: fc.boolean(),
});

test("the last step waits exactly when a mandatory other step is not done", () => {
  fc.assert(
    fc.property(fc.array(stepArb, { minLength: 2, maxLength: 6 }), (raw) => {
      const all = raw.map((s, i) => ({ ...s, ticketId: `s${i}`, key: `K-${i}`, onHold: null }));
      const last = all[all.length - 1];
      if (last === undefined) return;
      const pending = all.slice(0, -1).some((s) => !s.optional && s.statusId !== "done");
      expect(lastStepWaitsOn(last.ticketId, all).length > 0).toBe(pending);
    }),
  );
});

const HOLD = { source: "own" as const, key: "SILO-33", reason: "Serveur MinIO", since: "2026-10-16" };
const silo = (n: number, statusId: StatusId, held = false) => ({
  ticketId: String(n),
  key: `SILO-${n}`,
  statusId,
  optional: false,
  onHold: held ? HOLD : null,
});

test("a step on hold is not startable, before its dependencies", () => {
  const blockers = [{ key: "SILO-32", statusId: "in_review" as const }];
  expect(startable({ ...ready, onHold: HOLD, blockers }, ctx)).toEqual({
    startable: false,
    reason: { kind: "onHold", hold: HOLD },
  });
  expect(startable({ ...ready, statusId: "in_progress", onHold: HOLD }, ctx)).toEqual({
    startable: false,
    reason: { kind: "status" },
  });
});

test("the last step does not wait for a step on hold, and a step on hold is not the last", () => {
  expect(lastStepWaitsOn("35", [silo(33, "todo", true), silo(34, "done"), silo(35, "todo")])).toEqual([]);
  expect(lastStepWaitsOn("34", [silo(33, "todo"), silo(34, "todo"), silo(35, "todo", true)])).toEqual([
    "SILO-33",
  ]);
  expect(lastStepWaitsOn("35", [silo(33, "todo"), silo(35, "todo", true)])).toEqual([]);
});
