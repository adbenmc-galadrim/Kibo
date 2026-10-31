import { expect, spyOn, test } from "bun:test";
import { existsSync } from "node:fs";
import { type HookPayload, PROJECT_AGENT_REF, type RunView } from "@kibo/schema";
import { fakeCalls, releaseFakeRun } from "./fake-claude-scenario";
import { createOrchestrator } from "./orchestrator";
import {
  cleanHarness,
  projectAgentAgent,
  run,
  setup,
  startProject,
  waitUntil,
} from "./orchestrator.test-helper";
import { createRunLauncher, type LiveRun } from "./run-launch";
import { openRunRegistry } from "./run-registry";

cleanHarness();

test("four runs on three host slots leave one queued until a slot frees", async () => {
  const h = setup({ scenario: "hold", profiles: [projectAgentAgent(4)] });
  const runs = ["p1", "p2", "p3", "p4"].map((p) => startProject(h, p));
  const at = (i: number): RunView => {
    const r = runs[i];
    if (!r) throw new Error(`run ${i} missing`);
    return r;
  };
  const snapshot = h.orch.state();
  expect(snapshot.host).toMatchObject({ hostSlots: 3, autoSlots: 3, slotsFixed: false, used: 3 });
  expect(snapshot.queue).toEqual([
    { runId: at(3).id, position: 1, reason: { kind: "host", used: 3, total: 3 } },
  ]);
  await waitUntil(() => [0, 1, 2].every((i) => run(h, at(i).id).state === "running"));
  releaseFakeRun(h.state, at(0).sessionId);
  await waitUntil(() => run(h, at(3).id).state === "running");
  expect(run(h, at(0).id).state).toBe("done");
  expect(run(h, at(3).id).lane).toBe(1);
  for (const i of [1, 2, 3]) releaseFakeRun(h.state, at(i).sessionId);
  await waitUntil(() => runs.every((r) => run(h, r.id).state === "done"));
}, 30_000);

test("above the CPU threshold nothing starts until the threshold is raised", async () => {
  const h = setup({ profiles: [projectAgentAgent()], scenario: "done", load: () => ({ cpu: 95, ram: 20 }) });
  const r = startProject(h);
  expect(h.orch.state().queue).toEqual([
    { runId: r.id, position: 1, reason: { kind: "cpu", value: 95, threshold: 85 } },
  ]);
  await Bun.sleep(300);
  expect(run(h, r.id).state).toBe("queued");
  expect(h.orch.setHost({ cpuThreshold: 100 })).toMatchObject({ cpuThreshold: 100, slotsFixed: false });
  await waitUntil(() => run(h, r.id).state === "done");
  expect(h.store.hostSettings()).toEqual({ cpuThreshold: 100 });
  expect(h.orch.setHost({ hostSlots: 3 })).toMatchObject({ hostSlots: 3, autoSlots: 3, slotsFixed: true });
}, 30_000);

test("hooks need the live token of their own run", async () => {
  const h = setup({ scenario: "hold", profiles: [projectAgentAgent(2)] });
  const a = startProject(h, "p1");
  const b = startProject(h, "p2");
  await waitUntil(() => [a, b].every((r) => run(h, r.id).lastActivity?.event === "PreToolUse"));
  const payload: HookPayload = {
    event: "Notification",
    sessionId: a.sessionId,
    transcriptPath: null,
    tool: null,
    detail: "ping",
    question: null,
    agentId: null,
    toolUseId: null,
    ask: null,
    todos: null,
    stopHookActive: false,
  };
  const post = (token: string | null) =>
    fetch(`${h.url}/hooks/${a.id}`, {
      method: "POST",
      headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({ payload, toolInput: null }),
    });
  const tokenA = h.tokens.get(a.id) ?? "";
  const tokenB = h.tokens.get(b.id) ?? "";
  expect(tokenA).toMatch(/^[0-9a-f]{64}$/);
  const before = h.orch.log(a.id).length;
  expect((await post(null)).status).toBe(401);
  expect((await post(tokenB)).status).toBe(401);
  expect((await post("0".repeat(64))).status).toBe(401);
  expect(h.orch.log(a.id)).toHaveLength(before);
  expect((await post(tokenA)).status).toBe(204);
  expect(h.orch.log(a.id)).toHaveLength(before + 1);
  releaseFakeRun(h.state, a.sessionId);
  await waitUntil(() => run(h, a.id).state === "done");
  const after = h.orch.log(a.id).length;
  expect((await post(tokenA)).status).toBe(401);
  expect(h.orch.log(a.id)).toHaveLength(after);
  releaseFakeRun(h.state, b.sessionId);
}, 30_000);

test("cancelling a running run stops its process and frees the slot", async () => {
  const h = setup({ profiles: [projectAgentAgent()], scenario: "hold" });
  const r = startProject(h);
  await waitUntil(() => run(h, r.id).lastActivity?.event === "PreToolUse");
  expect(h.orch.cancel(r.id).state).toBe("cancelled");
  await waitUntil(() => h.orch.log(r.id).some((e) => e.event.type === "exited"));
  expect(run(h, r.id).state).toBe("cancelled");
  expect(h.orch.state().host.used).toBe(0);
  expect(() => h.orch.cancel(r.id)).toThrow("INVALID_TRANSITION");
}, 30_000);

test("queued runs can be moved and prioritized; running ones cannot", async () => {
  const h = setup({ profiles: [projectAgentAgent()], scenario: "hold" });
  const [a, b, c] = ["p1", "p2", "p3"].map((p) => startProject(h, p));
  if (!a || !b || !c) throw new Error("runs missing");
  expect(h.orch.state().queue.map((q) => q.runId)).toEqual([c.id, b.id]);
  h.orch.move(b.id, 0);
  expect(h.orch.state().queue.map((q) => q.runId)).toEqual([b.id, c.id]);
  h.orch.setPriority(c.id, true);
  expect(h.orch.state().queue.map((q) => q.runId)).toEqual([c.id, b.id]);
  expect(run(h, c.id).priority).toBe(true);
  const events = h.orch.log(a.id).length;
  expect(() => h.orch.move(a.id, 1)).toThrow("INVALID_TRANSITION");
  expect(() => h.orch.setPriority(a.id, true)).toThrow("INVALID_TRANSITION");
  expect(h.orch.log(a.id)).toHaveLength(events);
  for (const r of [a, b, c]) releaseFakeRun(h.state, r.sessionId);
  await waitUntil(() => [a, b, c].every((r) => run(h, r.id).state === "done"));
}, 30_000);

const claudeInCommonPlaces = ["/opt/homebrew/bin/claude", "/usr/local/bin/claude"].some((p) => existsSync(p));

test.skipIf(claudeInCommonPlaces)("a missing claude CLI fails the run", async () => {
  const h = setup({
    profiles: [projectAgentAgent()],
    scenario: "done",
    claudeBin: null,
    env: { PATH: "/nonexistent" },
  });
  const r = startProject(h);
  await waitUntil(() => run(h, r.id).state === "failed");
  expect(run(h, r.id).error).toStartWith("AGENT_CLI_NOT_FOUND: ");
});

test("each state change is announced, run by run", async () => {
  const h = setup({ profiles: [projectAgentAgent()], scenario: "done" });
  const states: string[] = [];
  h.orch.onRunState((r) => states.push(r.state));
  const r = startProject(h);
  await waitUntil(() => run(h, r.id).state === "done");
  expect(states).toEqual(["queued", "starting", "running", "done"]);
}, 30_000);

test("a restart after a crash kills the orphaned agent of an interrupted run", async () => {
  const h = setup({ profiles: [projectAgentAgent()], scenario: "hold" });
  const r = startProject(h);
  await waitUntil(() => run(h, r.id).lastActivity?.event === "PreToolUse");
  const restarted = createOrchestrator({ ...h.options, tickMs: 60_000 });
  expect(restarted.state().runs.find((x) => x.id === r.id)?.state).toBe("failed");
  await waitUntil(() => h.orch.log(r.id).some((e) => e.event.type === "exited"));
  await restarted.stop();
}, 30_000);

test("stopping the daemon kills agents; the next start marks them interrupted", async () => {
  const h = setup({ profiles: [projectAgentAgent()], scenario: "hold" });
  const r = startProject(h);
  await waitUntil(() => run(h, r.id).lastActivity?.event === "PreToolUse");
  await h.orch.stop();
  expect(run(h, r.id).state).toBe("running");
  expect(openRunRegistry(h.store).get(r.id)).toMatchObject({
    state: "failed",
    error: expect.stringMatching(/^INTERRUPTED/),
  });
}, 30_000);

test("invalid host settings are refused and not saved", () => {
  const h = setup({ profiles: [projectAgentAgent()], scenario: "done" });
  expect(() => h.orch.setHost({ cpuThreshold: 5 })).toThrow("INVALID_INPUT");
  expect(h.store.hostSettings()).toEqual({});
});

test("a throwing listener neither silences the others nor stops the orchestrator", async () => {
  const errors = spyOn(console, "error").mockImplementation(() => {});
  try {
    const h = setup({ profiles: [projectAgentAgent()], scenario: "done" });
    const states: string[] = [];
    let changes = 0;
    h.orch.onRunState(() => {
      throw new Error("state listener exploded");
    });
    h.orch.onRunState((r) => states.push(r.state));
    h.orch.onChange(() => {
      throw new Error("change listener exploded");
    });
    h.orch.onChange(() => {
      changes += 1;
    });
    const r = startProject(h, "p1");
    await waitUntil(() => run(h, r.id).state === "done" && changes > 0);
    expect(states).toEqual(["queued", "starting", "running", "done"]);
    const again = startProject(h, "p2");
    await waitUntil(() => run(h, again.id).state === "done");
    expect(errors.mock.calls.some((c) => String(c[0]).includes("run state listener"))).toBe(true);
    expect(errors.mock.calls.some((c) => String(c[0]).includes("change listener"))).toBe(true);
  } finally {
    errors.mockRestore();
  }
}, 30_000);

test("a process ending while its run is queued again records no exit", async () => {
  const errors = spyOn(console, "error").mockImplementation(() => {});
  try {
    const h = setup({ profiles: [projectAgentAgent()], scenario: "hold" });
    const registry = openRunRegistry(h.store);
    const live = new Map<string, LiveRun>();
    const launchRun = createRunLauncher({
      opts: h.options,
      registry,
      live,
      agentOf: () => projectAgentAgent(),
      guards: new Map(),
      stopping: () => false,
    });
    const view = registry.create(
      {
        id: "stray",
        projectId: "p1",
        ticketId: null,
        ticketKey: null,
        ticketTitle: "Agent de projet · Silo",
        profileId: PROJECT_AGENT_REF,
        profileName: "kibo-project-agent",
        agentScope: "system" as const,
        projectKey: null,
        sessionId: crypto.randomUUID(),
        brief: "",
        kind: "project",
        resumedFrom: null,
      },
      0,
    );
    registry.apply(view.id, { type: "admitted", lane: 1 });
    const running = launchRun(view.id);
    await waitUntil(() => live.has(view.id) && fakeCalls(h.state, view.sessionId).length > 0);
    registry.apply(view.id, {
      type: "hook",
      payload: {
        event: "PostToolUse",
        sessionId: view.sessionId,
        transcriptPath: null,
        tool: "mcp__kibo__ask_user",
        detail: null,
        question: "Quel port ?",
        agentId: null,
        toolUseId: null,
        ask: null,
        todos: null,
        stopHookActive: false,
      },
    });
    registry.apply(view.id, {
      type: "exited",
      code: 0,
      isError: false,
      result: null,
      tokens: 0,
      costUsd: 0,
      denied: [],
    });
    registry.apply(view.id, { type: "answered", text: "8080", rank: -1 });
    const exits = () => registry.log(view.id).filter((e) => e.event.type === "exited").length;
    expect(exits()).toBe(1);
    live.get(view.id)?.proc.kill();
    await running;
    expect(registry.get(view.id).state).toBe("queued");
    expect(exits()).toBe(1);
    expect(registry.log(view.id).some((e) => e.event.type === "failed")).toBe(false);
    expect(errors.mock.calls.some((c) => String(c[0]).includes("exit not recorded"))).toBe(true);
  } finally {
    errors.mockRestore();
  }
}, 30_000);
