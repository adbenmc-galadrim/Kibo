import { expect, test } from "bun:test";
import { readFileSync, realpathSync, rmSync, statSync } from "node:fs";
import { join } from "node:path";
import { orderQueue } from "@kibo/core/scheduler";
import { PROJECT_AGENT_DENY, PROJECT_AGENT_MCP_TOOLS } from "@kibo/schema";
import { fakeCalls, releaseFakeRun } from "./fake-claude-scenario";
import { createOrchestrator } from "./orchestrator";
import {
  assign,
  cleanHarness,
  type Harness,
  profile,
  projectAgentProfile,
  run,
  setup,
  waitUntil,
} from "./orchestrator.test-helper";

cleanHarness();

const profiles = [profile(), projectAgentProfile()];
const start = (h: Harness, text = "Où en est-on ?", projectId = "p1") =>
  h.orch.startProjectRun({ projectId, projectName: "Emis", text });
const flagOf = (argv: string[], name: string) => argv[argv.indexOf(name) + 1] ?? "";

test("startProjectRun queues a project run at the head with its first message", () => {
  const h = setup({ scenario: "done", profiles });
  h.orch.setHost({ paused: true });
  const ticket = assign(h, "t1");
  const r = start(h);
  expect(r).toMatchObject({
    kind: "project",
    ticketId: null,
    profileId: "project-agent",
    ticketTitle: "Agent de projet · Emis",
    brief: "",
    state: "queued",
    pendingAnswer: "Où en est-on ?",
    priority: true,
  });
  expect(orderQueue(h.orch.state().runs).map((x) => x.id)).toEqual([r.id, ticket.id]);
});

test("each message is a turn: resume after done, pending during a turn, prompt composed by the port", async () => {
  const h = setup({ scenario: "done", profiles });
  const r = start(h);
  await waitUntil(() => run(h, r.id).state === "done");
  expect(run(h, r.id)).toMatchObject({
    workspace: "projet",
    session: { mode: "fresh", reason: "no_previous" },
  });
  h.orch.answer(r.id, "Et EMIS-11 ?");
  await waitUntil(() => run(h, r.id).state === "done" && run(h, r.id).turns === 2);
  const calls = fakeCalls(h.state, r.sessionId);
  expect(calls.map((c) => c.prompt)).toEqual(["[tour 1] Où en est-on ?", "[tour 2] Et EMIS-11 ?"]);
  expect(calls[0]?.argv.slice(-2)).toEqual(["--session-id", r.sessionId]);
  expect(calls[1]?.argv.slice(-2)).toEqual(["--resume", r.sessionId]);
  expect(calls[0]?.cwd).toBe(realpathSync(join(h.home, "project")));
  expect(run(h, r.id).session).toEqual({ mode: "resumed", from: r.id });
  expect(h.prepared).toEqual([r.id, r.id]);
  expect(readFileSync(join(h.home, "runs", r.id, "CLAUDE.md"), "utf8")).toBe("# rôle");
}, 30_000);

test("a project run launches with its kibo tools, its deny rules and a private MCP config", async () => {
  const h = setup({ scenario: "done", profiles });
  const r = start(h);
  await waitUntil(() => run(h, r.id).state === "done");
  const [call] = fakeCalls(h.state, r.sessionId);
  const argv = call?.argv ?? [];
  const settings = JSON.parse(flagOf(argv, "--settings"));
  expect(settings.permissions.allow).toEqual(
    expect.arrayContaining([...PROJECT_AGENT_MCP_TOOLS, "Read", "Grep", "Glob"]),
  );
  expect(settings.permissions.deny).toEqual([...PROJECT_AGENT_DENY]);
  const configFile = flagOf(argv, "--mcp-config");
  expect(configFile).toBe(join(h.home, "runs", r.id, "mcp.json"));
  const config = JSON.parse(readFileSync(configFile, "utf8"));
  expect(config.mcpServers.kibo.env).toEqual({
    KIBO_MCP_URL: `${h.url}/agent-mcp/${r.id}`,
    KIBO_RUN_TOKEN: h.tokens.get(r.id),
  });
  expect(statSync(configFile).mode & 0o777).toBe(0o600);
  expect(statSync(join(h.home, "runs", r.id)).mode & 0o777).toBe(0o700);
  expect(argv.join(" ")).not.toContain(h.tokens.get(r.id) ?? "?");
}, 30_000);

test("a missing transcript starts the next turn on a fresh session", async () => {
  const h = setup({ scenario: "done", profiles });
  const r = start(h);
  await waitUntil(() => run(h, r.id).state === "done");
  rmSync(run(h, r.id).transcriptPath ?? "");
  h.orch.answer(r.id, "Et ensuite ?");
  await waitUntil(() => run(h, r.id).state === "done" && run(h, r.id).turns === 2);
  const fresh = run(h, r.id);
  expect(fresh.session).toEqual({ mode: "fresh", reason: "transcript_missing" });
  expect(fresh.sessionId).not.toBe(r.sessionId);
  expect(fakeCalls(h.state, fresh.sessionId)[0]?.argv.slice(-2)).toEqual(["--session-id", fresh.sessionId]);
}, 30_000);

test("a queued project run keeps its message across a restart and starts with it", async () => {
  const h = setup({ scenario: "done", profiles });
  h.orch.setHost({ paused: true });
  const queued = start(h);
  await h.orch.stop();
  const restarted = createOrchestrator({ ...h.options, tickMs: 50 });
  h.route(restarted);
  try {
    const view = () => restarted.state().runs.find((x) => x.id === queued.id);
    expect(view()).toMatchObject({ state: "queued", pendingAnswer: "Où en est-on ?" });
    restarted.setHost({ paused: false });
    await waitUntil(() => view()?.state === "done");
    expect(fakeCalls(h.state, queued.sessionId).map((c) => c.prompt)).toEqual(["[tour 1] Où en est-on ?"]);
  } finally {
    await restarted.stop();
  }
}, 30_000);

test("a project run interrupted by a restart fails INTERRUPTED, never LOST_TASK, and resumes its session", async () => {
  const h = setup({ scenario: "hold", profiles });
  const r = start(h);
  await waitUntil(() => run(h, r.id).lastActivity?.event === "PreToolUse");
  await h.orch.stop();
  const restarted = createOrchestrator({ ...h.options, tickMs: 50 });
  h.route(restarted);
  try {
    const view = () => restarted.state().runs.find((x) => x.id === r.id);
    expect(view()).toMatchObject({
      state: "failed",
      error: expect.stringMatching(/^INTERRUPTED: the daemon/),
    });
    expect(restarted.state().resumable).toContain(r.id);
    restarted.answer(r.id, "Reprends");
    await waitUntil(() => view()?.turns === 2 && view()?.lastActivity?.event === "PreToolUse");
    releaseFakeRun(h.state, r.sessionId);
    await waitUntil(() => view()?.state === "done");
    const calls = fakeCalls(h.state, r.sessionId);
    expect(calls.at(-1)?.prompt).toBe("[tour 2] Reprends");
    expect(calls.at(-1)?.argv.slice(-2)).toEqual(["--resume", r.sessionId]);
  } finally {
    await restarted.stop();
  }
}, 30_000);

test("a project run never runs the ticket rules nor the ticket preparation", async () => {
  const h = setup({ scenario: "done", profiles });
  const r = start(h);
  await waitUntil(() => run(h, r.id).state === "done");
  expect(h.started).toEqual([]);
  expect(h.done).toEqual([]);
  expect(h.delivered).toEqual([]);
  expect(run(h, r.id).cwd).toBe(realpathSync(join(h.home, "project")));
}, 30_000);

test("the guard denies a shell call of a project run", async () => {
  const h = setup({ scenario: "hold", profiles });
  const r = start(h);
  await waitUntil(() => run(h, r.id).lastActivity?.event === "PreToolUse");
  releaseFakeRun(h.state, r.sessionId);
  await waitUntil(() => run(h, r.id).state === "done");
  expect(run(h, r.id).denied).toEqual(["Bash"]);
}, 30_000);

test("startProjectRun fails NOT_FOUND without the project-agent profile", () => {
  const bare = setup({ scenario: "done" });
  expect(() => start(bare)).toThrow("NOT_FOUND");
  expect(bare.orch.state().runs).toEqual([]);
});

test("a second open project run of the same project is a conflict, another project is not", () => {
  const h = setup({ scenario: "done", profiles });
  h.orch.setHost({ paused: true });
  start(h);
  expect(() => start(h, "Encore")).toThrow("CONFLICT");
  expect(start(h, "Autre", "p2").projectId).toBe("p2");
});

test("a read-only project refuses a project run", () => {
  const h = setup({ scenario: "done", profiles, readOnly: true });
  expect(() => start(h)).toThrow("FORBIDDEN");
});

test("answer on a project run that is not the latest of its project is refused", async () => {
  const h = setup({ scenario: "done", profiles });
  const older = start(h);
  await waitUntil(() => run(h, older.id).state === "done");
  const newer = start(h, "Nouvelle session");
  await waitUntil(() => run(h, newer.id).state === "done");
  expect(() => h.orch.answer(older.id, "x")).toThrow("INVALID_TRANSITION");
  expect(h.orch.answer(newer.id, "y").pendingAnswer).toBe("y");
}, 30_000);

test("a ticket run is untouched: no deny rules, inline MCP config without env", async () => {
  const h = setup({ scenario: "done", profiles });
  const r = assign(h, "t1");
  await waitUntil(() => run(h, r.id).state === "done");
  const argv = fakeCalls(h.state, r.sessionId)[0]?.argv ?? [];
  expect(JSON.parse(flagOf(argv, "--settings")).permissions.deny).toBeUndefined();
  expect(JSON.parse(flagOf(argv, "--mcp-config")).mcpServers.kibo.env).toBeUndefined();
}, 30_000);

test("cancelling a turn drops the waiting message and keeps the session for the next one", async () => {
  const h = setup({ scenario: "hold", profiles });
  const r = start(h);
  await waitUntil(() => run(h, r.id).lastActivity?.event === "PreToolUse");
  h.orch.answer(r.id, "Attends");
  expect(h.orch.cancel(r.id)).toMatchObject({ state: "cancelled", pendingAnswer: null });
  await waitUntil(() => h.orch.state().resumable.includes(r.id));
  h.orch.answer(r.id, "Reprends");
  await waitUntil(() => run(h, r.id).turns === 2 && run(h, r.id).lastActivity?.event === "PreToolUse");
  releaseFakeRun(h.state, r.sessionId);
  await waitUntil(() => run(h, r.id).state === "done");
  const last = fakeCalls(h.state, r.sessionId).at(-1);
  expect(last?.prompt).toBe("[tour 2] Reprends");
  expect(last?.argv.slice(-2)).toEqual(["--resume", r.sessionId]);
}, 30_000);
