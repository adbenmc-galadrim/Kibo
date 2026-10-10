import { expect, test } from "bun:test";
import {
  FINAL_STATUSES,
  isStartable,
  NO_ACTIVITY,
  NOT_STARTED_STATUSES,
  type StartableInput,
} from "./startable";

const ready: StartableInput = {
  statusId: "todo",
  blockerStatuses: [],
  openBlockingQuestions: 0,
  busy: false,
};

test("the truth table of a startable ticket", () => {
  const cases: [Partial<StartableInput>, boolean][] = [
    [{}, true],
    [{ statusId: "backlog" }, true],
    [{ statusId: "in_progress" }, false],
    [{ statusId: "in_review" }, false],
    [{ statusId: "blocked" }, false],
    [{ statusId: "done" }, false],
    [{ blockerStatuses: ["done"] }, true],
    [{ blockerStatuses: ["done", "in_review"] }, false],
    [{ blockerStatuses: ["todo"] }, false],
    [{ openBlockingQuestions: 1 }, false],
    [{ busy: true }, false],
  ];
  for (const [over, expected] of cases) expect(isStartable({ ...ready, ...over })).toBe(expected);
});

test("the status categories and the empty activity", () => {
  expect(NOT_STARTED_STATUSES).toEqual(["backlog", "todo"]);
  expect(FINAL_STATUSES).toEqual(["done"]);
  expect(NO_ACTIVITY.busyTickets.size).toBe(0);
});
