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

test("a ticket in session is busy and its session and last event are exposed", () => {
  const session = { tool: "T3 Code", startedAt: 1_000 };
  const tracker = createActivityTracker(
    [runView({ id: "r1", projectId: "p", ticketId: "t1", state: "running" })],
    {
      sessions: (projectId) => (projectId === "p" ? new Map([["t2", session]]) : new Map()),
      lastEventAt: (projectId) => (projectId === "p" ? new Map([["t3", 2_000]]) : new Map()),
    },
  );
  const activity = tracker.activity("p");
  expect([...activity.busyTickets].sort()).toEqual(["t1", "t2"]);
  expect(activity.sessions).toEqual(new Map([["t2", session]]));
  expect(activity.lastEventAt).toEqual(new Map([["t3", 2_000]]));
  expect(busy(tracker, "other")).toEqual([]);
});
