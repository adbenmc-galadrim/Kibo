import { expect, test } from "bun:test";
import { initRun } from "@kibo/core/run-machine";
import type { Plan } from "@kibo/core/scheduler";
import type { RunState, RunView, TicketView } from "@kibo/schema";
import { activeRunOf, previewAssign } from "./assign-preview";
import { profile } from "./orchestrator.test-helper";

const runOf = (id: string, ticketId: string, state: RunState): RunView => ({
  ...initRun(
    {
      id,
      seq: 1,
      projectId: "p1",
      ticketId,
      ticketKey: "KIB-1",
      ticketTitle: "Ticket",
      profileId: "opus",
      profileName: "opus-dev",
      sessionId: `s-${id}`,
      brief: "",
      resumedFrom: null,
      createdAt: 0,
    },
    1,
    0,
  ),
  state,
});

const ticket: TicketView & { key: string } = {
  id: "t1",
  key: "KIB-1",
  pendingSeq: null,
  keyLabel: "KIB-1",
  title: "Ticket",
  description: "",
  statusId: "todo",
  blockedReason: null,
  domainId: null,
  assignee: null,
  parentId: null,
  labels: [],
  externalRefs: [],
  progress: { done: 0, total: 0 },
  waitingOn: [],
  openQuestions: 0,
};

const admitAll = (runs: RunView[]): Plan => ({
  admit: runs.filter((r) => r.state === "queued").map((r) => ({ runId: r.id, lane: 1 })),
  waiting: [],
});

const preview = (runs: RunView[]) =>
  previewAssign({ runs, projectId: "p1", ticket, profile: profile(), guidelines: 2, at: 0, plan: admitAll });

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

test("the preview says the ticket is busy before any other reason", () => {
  expect(preview([runOf("r1", "t1", "waiting_input")])).toEqual({
    position: null,
    reason: { kind: "ticket_busy" },
    guidelines: 2,
    session: null,
  });
  expect(preview([runOf("r1", "t1", "done")])).toEqual({
    position: null,
    reason: null,
    guidelines: 2,
    session: null,
  });
});
