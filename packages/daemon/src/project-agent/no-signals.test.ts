import { expect, test } from "bun:test";
import { NO_SIGNALS } from "./no-signals";

test("the inert signal port has nothing open and settles nothing", () => {
  expect(NO_SIGNALS.list("p1")).toEqual({
    signals: [],
    wakeup: { projectId: "p1", lastAt: null, dueAt: null },
  });
  expect(NO_SIGNALS.markRead("p1", "r1")).toEqual([]);
  expect(NO_SIGNALS.openRefs("p1")).toEqual([]);
  expect(NO_SIGNALS.openCount("p1")).toBe(0);
});
