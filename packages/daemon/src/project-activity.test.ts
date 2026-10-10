import { expect, test } from "bun:test";
import { RunState } from "@kibo/schema";
import { createActivityTracker } from "./project-activity";
import { runView } from "./questions/questions.test-helper";

const busy = (tracker: ReturnType<typeof createActivityTracker>, projectId: string) => [
  ...tracker.activity(projectId).busyTickets,
];

test("a ticket is busy while its run is queued, starting, running or waiting for input", () => {
  const live = ["queued", "starting", "running", "waiting_input"];
  for (const state of RunState.options) {
    const tracker = createActivityTracker([runView({ id: "r1", projectId: "p", ticketId: "t1", state })]);
    expect(busy(tracker, "p")).toEqual(live.includes(state) ? ["t1"] : []);
  }
});

test("the busy tickets follow the run states and stay within their project", () => {
  const tracker = createActivityTracker([
    runView({ id: "r1", projectId: "p", ticketId: "t1", state: "running" }),
    runView({ id: "r2", projectId: "other", ticketId: "t9", state: "queued" }),
    runView({ id: "r3", projectId: "p", ticketId: null, kind: "project", state: "running" }),
  ]);
  expect(busy(tracker, "p")).toEqual(["t1"]);
  tracker.track(runView({ id: "r4", projectId: "p", ticketId: "t2", state: "queued" }));
  tracker.track(runView({ id: "r1", projectId: "p", ticketId: "t1", state: "done" }));
  expect(busy(tracker, "p")).toEqual(["t2"]);
  expect(busy(tracker, "other")).toEqual(["t9"]);
  expect(busy(tracker, "none")).toEqual([]);
});
