import { expect, test } from "bun:test";
import type { SprintView } from "@kibo/schema";
import { currentSprintOf } from "./sprint-filter";

const view = (code: string, start: string, state: SprintView["state"], lingering = false): SprintView => ({
  id: code,
  code,
  name: code,
  start,
  end: start,
  state,
  features: [],
  delivered: 0,
  total: 0,
  lingering,
});

test("the current sprint is the running one, as computed by the daemon", () => {
  const sprints = [
    view("S41", "2026-10-05", "done"),
    view("S42", "2026-10-12", "current"),
    view("S43", "2026-10-19", "planned"),
  ];
  expect(currentSprintOf(sprints)?.code).toBe("S42");
});

test("between two sprints, the finished one that lingers stays current", () => {
  const sprints = [
    view("S41", "2026-10-05", "done"),
    view("S42", "2026-10-12", "done", true),
    view("S43", "2026-10-19", "planned"),
  ];
  expect(currentSprintOf(sprints)?.code).toBe("S42");
});

test("two running sprints: the one started last; none running nor lingering: none", () => {
  expect(
    currentSprintOf([view("A", "2026-10-12", "current"), view("B", "2026-10-14", "current")])?.code,
  ).toBe("B");
  expect(currentSprintOf([view("S43", "2026-10-19", "planned")])).toBeNull();
  expect(currentSprintOf([])).toBeNull();
});
