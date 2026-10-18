import { expect, test } from "bun:test";
import {
  DEADLINE_MAX_WEEKS,
  DEADLINE_WEEKS,
  deadlineColumns,
  deadlineRows,
  todayOffset,
} from "./deadline-rows";
import { featureSteps } from "./feature-steps";
import { BLOCKING, emisTickets, SPRINT_VIEWS, TODAY } from "./overview-test-kit";

const AFTER = "2026-10-17";

const features = (today: string) => {
  const tickets = emisTickets(today);
  return tickets.flatMap((t, rank) =>
    t.feature === null || t.sprintId === null || t.shortKey === null
      ? []
      : [
          {
            id: t.id,
            shortKey: t.shortKey,
            title: t.title,
            sprintId: t.sprintId,
            rank,
            state: t.feature,
            steps: featureSteps({ feature: t.id, tickets, links: [] }),
          },
        ],
  );
};
const rowsAt = (today: string) =>
  deadlineRows({ sprints: SPRINT_VIEWS, features: features(today), blockingQuestions: BLOCKING, today });

test("the window covers four weeks from the start of the current sprint", () => {
  expect(DEADLINE_WEEKS).toBe(4);
  expect(deadlineColumns(SPRINT_VIEWS, TODAY)).toEqual([
    { start: "2026-10-12", sprint: { id: "s42", code: "S42" } },
    { start: "2026-10-19", sprint: { id: "s43", code: "S43" } },
    { start: "2026-10-26", sprint: { id: "s44", code: "S44" } },
    { start: "2026-11-02", sprint: null },
  ]);
  expect(deadlineColumns(SPRINT_VIEWS, "2026-10-20").map((c) => c.start)).toEqual([
    "2026-10-19",
    "2026-10-26",
    "2026-11-02",
    "2026-11-09",
  ]);
});

test("a finished sprint anchors the window until the next starts, else the next one does", () => {
  expect(deadlineColumns(SPRINT_VIEWS, "2026-10-17")[0]).toEqual({
    start: "2026-10-12",
    sprint: { id: "s42", code: "S42" },
  });
  expect(deadlineColumns(SPRINT_VIEWS, "2026-11-20")[0]).toEqual({
    start: "2026-10-26",
    sprint: { id: "s44", code: "S44" },
  });
  expect(deadlineColumns(SPRINT_VIEWS, "2026-10-01")[0]).toEqual({
    start: "2026-10-05",
    sprint: { id: "s41", code: "S41" },
  });
  expect(deadlineColumns([], TODAY)).toEqual([]);
});

test("the window stretches to the weeks asked, up to twelve", () => {
  const six = deadlineColumns(SPRINT_VIEWS, TODAY, 6);
  expect(six.map((c) => c.start).slice(4)).toEqual(["2026-11-09", "2026-11-16"]);
  expect(deadlineColumns(SPRINT_VIEWS, TODAY, 20).length).toBe(DEADLINE_MAX_WEEKS);
  expect(deadlineColumns(SPRINT_VIEWS, TODAY, 1).length).toBe(DEADLINE_WEEKS);
  expect(todayOffset(six, TODAY)).toBe(4 / 42);
  const rows = deadlineRows({
    sprints: SPRINT_VIEWS,
    features: features(TODAY),
    blockingQuestions: BLOCKING,
    today: TODAY,
    weeks: 6,
  });
  expect(rows.map((r) => r.shortKey)).toEqual(rowsAt(TODAY).map((r) => r.shortKey));
});

test("today sits four days into the 28 of the window", () => {
  const columns = deadlineColumns(SPRINT_VIEWS, TODAY);
  expect(todayOffset(columns, TODAY)).toBe(4 / 28);
  expect(todayOffset(columns, "2026-12-01")).toBeNull();
  expect(todayOffset([], TODAY)).toBeNull();
});

test("one row per undelivered feature of the window, by sprint then rank", () => {
  const rows = rowsAt(TODAY);
  expect(rows.map((r) => r.shortKey)).toEqual(["F4", "F5", "F6", "F8", "F7"]);
  expect(rows.map((r) => r.column)).toEqual([0, 0, 1, 1, 2]);
});

test("on the last day of its sprint a feature does not slip yet", () => {
  const f5 = rowsAt(TODAY).find((r) => r.shortKey === "F5");
  expect(f5?.slipTo).toBeNull();
  expect(f5?.cells.some((c) => c.slipped)).toBe(false);
});

test("a late feature slips its remaining steps into the next sprint", () => {
  const f5 = rowsAt(AFTER).find((r) => r.shortKey === "F5");
  expect(f5?.slipTo).toEqual({ id: "s43", code: "S43" });
  expect(f5?.cells.filter((c) => !c.slipped).map((c) => c.statusId)).toEqual([
    "done",
    "in_review",
    "in_progress",
    "todo",
    "todo",
  ]);
  expect(f5?.cells.filter((c) => c.slipped).map((c) => c.statusId)).toEqual([
    "in_review",
    "in_progress",
    "todo",
    "todo",
  ]);
  expect(rowsAt(AFTER).find((r) => r.shortKey === "F4")?.slipTo).toEqual({ id: "s43", code: "S43" });
});

test("a feature blocked by a question names it", () => {
  const f6 = rowsAt(TODAY).find((r) => r.shortKey === "F6");
  expect(f6?.blockedBy).toBe("Q14");
  expect(f6?.cells.map((c) => c.blocked)).toEqual([true, false, false, false]);
  expect(rowsAt(TODAY).find((r) => r.shortKey === "F8")?.blockedBy).toBeNull();
});

test("the window moves with today", () => {
  expect(rowsAt("2026-10-20").map((r) => r.shortKey)).toEqual(["F6", "F8", "F7"]);
});
