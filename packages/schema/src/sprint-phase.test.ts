import { expect, test } from "bun:test";
import fc from "fast-check";
import { featureState } from "./feature-state";
import { addDays } from "./iso-date";
import { lateFeatures } from "./late-features";
import { currentSprint, isLingering, sprintState } from "./sprint";
import { isSprintOver, sprintPhase } from "./sprint-phase";

const S42 = { id: "s42", code: "S42", name: "Saisie", start: "2026-10-12", end: "2026-10-16" };
const S43 = { id: "s43", code: "S43", name: "Import", start: "2026-10-19", end: "2026-10-23" };
const SPRINTS = [S42, S43];

test("a sprint is upcoming, current, ends today, then ended", () => {
  expect(sprintPhase(S42, "2026-10-11")).toBe("upcoming");
  expect(sprintPhase(S42, "2026-10-12")).toBe("current");
  expect(sprintPhase(S42, "2026-10-15")).toBe("current");
  expect(sprintPhase(S42, "2026-10-16")).toBe("ends-today");
  expect(sprintPhase(S42, "2026-10-17")).toBe("ended");
  expect(sprintPhase({ start: "2026-10-16", end: "2026-10-16" }, "2026-10-16")).toBe("ends-today");
});

test("on its last day S42 stays the current sprint and nothing is late yet", () => {
  const today = "2026-10-16";
  expect(currentSprint(SPRINTS, today)?.id).toBe("s42");
  expect(isLingering(S42, SPRINTS, today)).toBe(false);
  expect(isSprintOver(S42, today)).toBe(false);
  const f4 = { id: "F4", sprintId: "s42", remaining: 2, rank: 4 };
  const f5 = { id: "F5", sprintId: "s42", remaining: 4, rank: 5 };
  expect(lateFeatures([f4, f5], SPRINTS, today)).toEqual([]);
  const steps = [
    { ticketId: "a", statusId: "done" as const, optional: false },
    { ticketId: "b", statusId: "todo" as const, optional: false },
  ];
  expect(featureState({ steps, blockingQuestions: new Set(), sprint: S42, today }).status).toBe("open");
});

test("the day after, S42 is over, lingers, and F4 and F5 are late", () => {
  const today = "2026-10-17";
  expect(currentSprint(SPRINTS, today)?.id).toBe("s42");
  expect(isLingering(S42, SPRINTS, today)).toBe(true);
  expect(isSprintOver(S42, today)).toBe(true);
  const f4 = { id: "F4", sprintId: "s42", remaining: 2, rank: 4 };
  const f5 = { id: "F5", sprintId: "s42", remaining: 4, rank: 5 };
  expect(lateFeatures([f4, f5], SPRINTS, today).map((f) => f.id)).toEqual(["F4", "F5"]);
});

const dateArb = fc.integer({ min: 0, max: 3000 }).map((n) => addDays("2025-01-01", n));
const sprintArb = fc
  .tuple(dateArb, fc.integer({ min: 0, max: 30 }))
  .map(([start, length]) => ({ start, end: addDays(start, length) }));

test("the phase agrees with the sprint state and with lateness", () => {
  fc.assert(
    fc.property(sprintArb, dateArb, (sprint, today) => {
      const phase = sprintPhase(sprint, today);
      const state = sprintState(sprint, today);
      expect(state === "done").toBe(phase === "ended");
      expect(state === "planned").toBe(phase === "upcoming");
      expect(isSprintOver(sprint, today)).toBe(phase === "ended");
      expect(phase === "ends-today").toBe(sprint.end === today);
      const full = { ...sprint, id: "s", code: "S", name: "S" };
      const late = lateFeatures([{ id: "f", sprintId: "s", remaining: 1, rank: 0 }], [full], today);
      expect(late.length > 0).toBe(phase === "ended");
    }),
  );
});
