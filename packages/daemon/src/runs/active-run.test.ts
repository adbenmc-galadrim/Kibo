import { expect, test } from "bun:test";
import { initRun } from "@kibo/core/run-machine";
import type { RunState, RunView } from "@kibo/schema";
import { activeRunOf } from "./active-run";

const runOf = (id: string, ticketId: string, state: RunState): RunView => ({
  ...initRun(
    {
      id,
      seq: 1,
      projectId: "p1",
      ticketId,
      ticketKey: "KIB-1",
      ticketTitle: "Ticket",
      profileId: "global:opus",
      profileName: "opus-dev",
      agentScope: "global",
      projectKey: null,
      sessionId: `s-${id}`,
      brief: "",
      kind: "project",
      resumedFrom: null,
      createdAt: 0,
    },
    1,
    0,
  ),
  state,
});

test("a queued, starting, running or waiting run of the ticket is its active run", () => {
  for (const state of ["queued", "starting", "running", "waiting_input"] as const) {
    const active = runOf("r2", "t1", state);
    expect(activeRunOf([runOf("r1", "t1", "done"), runOf("r3", "t2", "running"), active], "t1")).toBe(active);
  }
});

test("a ticket whose runs all ended has no active run", () => {
  const ended = (["done", "failed", "cancelled"] as const).map((s, i) => runOf(`r${i}`, "t1", s));
  expect(activeRunOf(ended, "t1")).toBeNull();
  expect(activeRunOf([runOf("r9", "t2", "queued")], "t1")).toBeNull();
});
