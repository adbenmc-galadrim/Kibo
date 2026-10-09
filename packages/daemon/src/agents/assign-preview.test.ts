import { afterEach, expect, test } from "bun:test";
import { mkdirSync, realpathSync } from "node:fs";
import { join } from "node:path";
import { initRun } from "@kibo/core/run-machine";
import type { Plan } from "@kibo/core/scheduler";
import { type RunState, type RunView, type TicketView, WORKTREE_DEFAULTS } from "@kibo/schema";
import { activeRunOf, plannedCwd, previewAssign } from "./assign-preview";
import { cleanupTmp, tmp } from "./git-test-kit";
import { profile } from "./orchestrator.test-helper";

afterEach(cleanupTmp);

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
      kind: "ticket",
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

const preview = (runs: RunView[], cwd: string | null = "/repo") =>
  previewAssign({
    runs,
    projectId: "p1",
    ticket,
    profile: profile(),
    guidelines: 2,
    at: 0,
    plan: admitAll,
    plannedCwd: cwd,
    transcriptExists: (path) => path === "/t/s-r1.jsonl",
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

const started = (patch: Partial<RunView>): RunView => ({
  ...runOf("r1", "t1", "done"),
  label: "opus-dev-2",
  startedAt: 5,
  cwd: "/repo",
  transcriptPath: "/t/s-r1.jsonl",
  turns: 3,
  tokens: 12_000,
  ...patch,
});

test("the preview announces the main session of the ticket and whether it resumes", () => {
  expect(preview([runOf("r0", "t1", "failed")]).session).toBeNull();
  expect(preview([started({})]).session).toEqual({
    runId: "r1",
    label: "opus-dev-2",
    turns: 3,
    tokens: 12_000,
    resumable: true,
    reason: null,
  });
  expect(preview([started({ transcriptPath: "/t/gone.jsonl" })]).session).toMatchObject({
    resumable: false,
    reason: "transcript_missing",
  });
  expect(preview([started({})], "/elsewhere").session).toMatchObject({ reason: "workspace_changed" });
  expect(preview([started({ profileId: "sonnet" })]).session).toMatchObject({ reason: "profile_changed" });
});

test("the planned folder follows the profile space: project folder, ticket worktree, never an isolated one", () => {
  const folder = tmp();
  const real = realpathSync(folder);
  const meta = { folder, worktree: null };
  expect(plannedCwd("repo", meta, ticket)).toBe(real);
  expect(plannedCwd("repo", { ...meta, folder: null }, ticket)).toBeNull();
  expect(plannedCwd("isolated", meta, ticket)).toBeNull();
  expect(plannedCwd("worktree", meta, ticket)).toBe(join(real, ".kibo", "worktrees", "kib-1"));
  mkdirSync(join(folder, ".kibo", "worktrees", "kib-1"), { recursive: true });
  expect(plannedCwd("worktree", meta, ticket)).toBe(join(real, ".kibo", "worktrees", "kib-1"));
  const outside = { ...WORKTREE_DEFAULTS, pathTemplate: "../../x/{slug}" };
  expect(plannedCwd("worktree", { ...meta, worktree: outside }, ticket)).toBeNull();
});
