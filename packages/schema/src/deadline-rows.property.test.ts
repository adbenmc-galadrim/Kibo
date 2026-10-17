import { expect, test } from "bun:test";
import fc from "fast-check";
import { deadlineColumns, deadlineRows } from "./deadline-rows";
import { featureSteps } from "./feature-steps";
import { BLOCKING, emisTickets, SPRINT_VIEWS } from "./overview-test-kit";

const tickets = emisTickets();
const FEATURES = tickets.flatMap((t, rank) =>
  t.feature === null
    ? []
    : [
        {
          id: t.id,
          shortKey: t.shortKey ?? t.keyLabel,
          title: t.title,
          sprintId: t.sprintId ?? "",
          rank,
          state: t.feature,
          steps: featureSteps({ feature: t.id, tickets, links: [] }),
        },
      ],
);
const day = fc.integer({ min: 0, max: 60 }).map((n) => {
  const d = new Date(Date.UTC(2026, 9, 1 + n));
  return d.toISOString().slice(0, 10);
});
const sprintPick = fc.subarray(SPRINT_VIEWS, { minLength: 0 });

test("no row belongs to a sprint that starts outside the window, no row is delivered", () => {
  fc.assert(
    fc.property(day, sprintPick, (today, sprints) => {
      const columns = deadlineColumns(sprints, today);
      const inWindow = new Set(columns.flatMap((c) => (c.sprint === null ? [] : [c.sprint.id])));
      const rows = deadlineRows({ sprints, features: FEATURES, blockingQuestions: BLOCKING, today });
      for (const row of rows) {
        expect(inWindow.has(row.sprintId)).toBe(true);
        expect(FEATURES.find((f) => f.id === row.featureId)?.state.status).not.toBe("delivered");
      }
    }),
  );
});
