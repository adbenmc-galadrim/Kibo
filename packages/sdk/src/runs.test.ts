import { expect, test } from "bun:test";
import type { AgentsState, RunView } from "@kibo/schema";
import { ticketRuns } from "./runs";

const run = (p: Pick<RunView, "id" | "seq" | "state"> & Partial<RunView>): RunView => ({
  projectId: "kibo",
  ticketId: "t1",
  ticketKey: "KIB-1",
  ticketTitle: "Ticket",
  profileId: "opus",
  profileName: "opus-dev",
  sessionId: `s-${p.id}`,
  brief: "",
  createdAt: 0,
  label: "opus-dev",
  lane: null,
  priority: false,
  rank: 0,
  question: null,
  pendingAnswer: null,
  lastActivity: null,
  subagents: [],
  workspace: null,
  cwd: null,
  guidelines: 0,
  transcriptPath: null,
  tokens: 0,
  costUsd: 0,
  denied: [],
  error: null,
  output: null,
  stateSince: 0,
  startedAt: null,
  endedAt: null,
  turns: 0,
  ...p,
});

const state = (runs: RunView[], queue: AgentsState["queue"] = []): AgentsState => ({
  runs,
  queue,
  host: {
    hostSlots: 3,
    slotsFixed: false,
    cpuThreshold: 85,
    ramThreshold: 90,
    paused: false,
    autoSlots: 3,
    cores: 8,
    ramGb: 16,
    used: 0,
    cpu: 0,
    ram: 0,
  },
  tokensToday: 0,
});

test("each ticket of the project keeps its latest run, with its place in the queue", () => {
  const runs = [
    run({ id: "old", seq: 1, state: "done", label: "opus-dev-1" }),
    run({ id: "new", seq: 4, state: "queued" }),
    run({ id: "wait", seq: 2, state: "waiting_input", ticketId: "t2", label: "opus-dev-2" }),
    run({ id: "other", seq: 3, state: "running", projectId: "portfolio", ticketId: "t9" }),
    run({ id: "task", seq: 5, state: "running", ticketId: null, ticketKey: null }),
  ];
  expect(ticketRuns(state(runs, [{ runId: "new", position: 2, reason: null }]), "kibo")).toEqual([
    { ticketId: "t1", runId: "new", label: "opus-dev", state: "queued", position: 2 },
    { ticketId: "t2", runId: "wait", label: "opus-dev-2", state: "waiting_input", position: null },
  ]);
});
