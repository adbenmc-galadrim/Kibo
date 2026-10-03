import { expect, test } from "bun:test";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { fakeCalls, releaseFakeRun } from "./fake-claude-scenario";
import { createOrchestrator } from "./orchestrator";
import {
  assign,
  cleanHarness,
  type Harness,
  profile,
  run,
  setup,
  waitUntil,
} from "./orchestrator.test-helper";

cleanHarness();

const ticketDone = (h: Harness, key: string) =>
  h.notices.filter((n) => n.title.endsWith("a terminé") && n.body.startsWith(`${key} ·`));

test("writing to a finished ticket run resumes the same session at the head of the queue", async () => {
  const h = setup({ scenario: "done" });
  const first = assign(h, "t1");
  await waitUntil(() => run(h, first.id).state === "done");
  expect(h.orch.state().resumable).toEqual([first.id]);
  h.orch.setHost({ paused: true });
  const other = assign(h, "t2");

  const resumed = h.orch.answer(first.id, "Ajoute aussi les tests\nsur deux lignes.");
  expect(resumed).toMatchObject({
    id: first.id,
    state: "queued",
    priority: true,
    endedAt: null,
    error: null,
    pendingAnswer: "Ajoute aussi les tests\nsur deux lignes.",
  });
  expect(h.orch.state().queue.map((q) => q.runId)).toEqual([first.id, other.id]);
  expect(h.orch.state().resumable).toEqual([]);
  expect(h.orch.answer(first.id, "encore")).toMatchObject({
    state: "queued",
    pendingAnswer: "Ajoute aussi les tests\nsur deux lignes.\n\nencore",
  });

  h.orch.setHost({ paused: false });
  await waitUntil(() => run(h, first.id).state === "done" && run(h, first.id).turns === 2);
  const calls = fakeCalls(h.state, first.sessionId);
  expect(calls).toHaveLength(2);
  expect(calls[1]?.argv.slice(-2)).toEqual(["--resume", first.sessionId]);
  expect(calls[1]?.prompt).toBe("Ajoute aussi les tests\nsur deux lignes.\n\nencore");
  expect(run(h, first.id)).toMatchObject({ tokens: 2400, label: "opus-dev-1", pendingAnswer: null });
  expect(h.started.filter((t) => t === "t1")).toEqual(["t1", "t1"]);
  await waitUntil(() => ticketDone(h, "KIB-1").length === 2);
}, 30_000);

test("a failed or cancelled ticket run can be written to once its process has exited", async () => {
  const h = setup({ scenario: "hold" });
  const r = assign(h, "t1");
  await waitUntil(() => run(h, r.id).lastActivity?.event === "PreToolUse");
  expect(h.orch.answer(r.id, "x")).toMatchObject({ state: "running", pendingAnswer: "x" });
  h.orch.cancel(r.id);
  expect(() => h.orch.answer(r.id, "x")).toThrow("INVALID_TRANSITION");
  expect(h.orch.state().resumable).toEqual([]);
  await waitUntil(() => h.orch.log(r.id).some((e) => e.event.type === "exited"));
  await waitUntil(() => h.orch.state().resumable.includes(r.id));
  expect(h.orch.answer(r.id, "Reprends").state).not.toBe("cancelled");
  await waitUntil(() => fakeCalls(h.state, r.sessionId).length === 2);
  releaseFakeRun(h.state, r.sessionId);
  await waitUntil(() => run(h, r.id).state === "done");
}, 30_000);

test("runs that never started, have no ticket or were replaced cannot be written to", async () => {
  const h = setup({
    scenario: "done",
    profiles: [
      profile(),
      profile({ id: "repo", name: "repo-dev", workspace: "repo" }),
      profile({ id: "assistant", name: "assistant", system: true, maxParallel: 1 }),
    ],
  });
  const broken = assign(h, "t1", "repo");
  const cwd = join(h.home, "draft");
  mkdirSync(cwd);
  const task = h.orch.submit({
    profileId: "assistant",
    projectId: null,
    title: "Brouillon",
    cwd,
    prompt: "x",
  });
  const older = assign(h, "t2");
  await waitUntil(() => [broken, task, older].every((r) => run(h, r.id).state !== "queued"));
  await waitUntil(() => run(h, older.id).state === "done" && run(h, task.id).state === "done");
  const newer = assign(h, "t2");
  await waitUntil(() => run(h, newer.id).state === "done");

  expect(run(h, broken.id)).toMatchObject({ state: "failed", startedAt: null });
  for (const id of [broken.id, task.id, older.id]) {
    const events = h.orch.log(id).length;
    expect(() => h.orch.answer(id, "x")).toThrow("INVALID_TRANSITION");
    expect(h.orch.log(id)).toHaveLength(events);
  }
  expect(h.orch.state().resumable).toEqual([newer.id]);
}, 30_000);

test("a message written before a restart keeps the run queued with its message", async () => {
  const h = setup({ scenario: "done" });
  const r = assign(h, "t1");
  await waitUntil(() => run(h, r.id).state === "done");
  h.orch.setHost({ paused: true });
  h.orch.answer(r.id, "Après le redémarrage");
  await h.orch.stop();

  const restarted = createOrchestrator({ ...h.options, tickMs: 50 });
  try {
    expect(restarted.state().runs.find((x) => x.id === r.id)).toMatchObject({
      state: "queued",
      priority: true,
      pendingAnswer: "Après le redémarrage",
    });
    restarted.setHost({ paused: false });
    await waitUntil(() => restarted.state().runs.find((x) => x.id === r.id)?.state === "done");
    expect(
      fakeCalls(h.state, r.sessionId)
        .map((c) => c.prompt)
        .at(-1),
    ).toBe("Après le redémarrage");
  } finally {
    await restarted.stop();
  }
}, 30_000);

test("a resumed turn cancelled while starting, then written to again, spawns one agent", async () => {
  const h = setup({ scenario: "done" });
  const r = assign(h, "t1");
  await waitUntil(() => run(h, r.id).state === "done");
  expect(h.orch.answer(r.id, "Premier message").state).toBe("starting");
  h.orch.cancel(r.id);
  expect(h.orch.answer(r.id, "Second message").state).toBe("starting");
  await waitUntil(() => run(h, r.id).state === "done" && run(h, r.id).turns === 2);
  await Bun.sleep(300);
  const spawned = h.orch.log(r.id).filter((e) => e.event.type === "spawned");
  expect(spawned).toHaveLength(2);
  const calls = fakeCalls(h.state, r.sessionId);
  expect(calls).toHaveLength(2);
  expect(calls[1]?.prompt).toBe("Second message");
}, 30_000);

test("a run whose profile was deleted cannot be written to", async () => {
  const profiles = [profile()];
  const h = setup({ scenario: "done", profiles });
  const r = assign(h, "t1");
  await waitUntil(() => run(h, r.id).state === "done");
  expect(h.orch.state().resumable).toEqual([r.id]);
  profiles.splice(0);
  expect(h.orch.state().resumable).toEqual([]);
  expect(() => h.orch.answer(r.id, "x")).toThrow("INVALID_TRANSITION");
}, 30_000);

test("a message written during a turn is kept and starts the next turn as soon as the process exits", async () => {
  const h = setup({ scenario: "hold" });
  const r = assign(h, "t1");
  await waitUntil(() => run(h, r.id).lastActivity?.event === "PreToolUse");
  expect(h.orch.answer(r.id, "Ajoute les tests")).toMatchObject({
    state: "running",
    pendingAnswer: "Ajoute les tests",
  });
  expect(h.orch.answer(r.id, "Et la doc.")).toMatchObject({
    pendingAnswer: "Ajoute les tests\n\nEt la doc.",
  });
  expect(h.orch.state().queue).toEqual([]);
  releaseFakeRun(h.state, r.sessionId);
  await waitUntil(() => run(h, r.id).turns === 2 && fakeCalls(h.state, r.sessionId).length === 2);
  expect(run(h, r.id)).toMatchObject({ state: "running", pendingAnswer: null });
  const calls = fakeCalls(h.state, r.sessionId);
  expect(calls[1]?.prompt).toBe("Ajoute les tests\n\nEt la doc.");
  expect(calls[1]?.argv.slice(-2)).toEqual(["--resume", r.sessionId]);
  const types = h.orch.log(r.id).map((e) => e.event.type);
  expect(types.filter((t) => t === "answered")).toHaveLength(2);
  expect(types.indexOf("requeued")).toBeGreaterThan(types.indexOf("exited"));
  releaseFakeRun(h.state, r.sessionId);
  await waitUntil(() => run(h, r.id).state === "done");
  expect(h.done).toEqual(["t1", "t1"]);
}, 30_000);

test("a message written to a queued first turn is appended to the brief", async () => {
  const h = setup({ scenario: "done" });
  h.orch.setHost({ paused: true });
  const r = assign(h, "t1");
  expect(h.orch.answer(r.id, "Commence par les tests.")).toMatchObject({
    state: "queued",
    pendingAnswer: "Commence par les tests.",
  });
  h.orch.setHost({ paused: false });
  await waitUntil(() => run(h, r.id).state === "done");
  const [first] = fakeCalls(h.state, r.sessionId);
  expect(first?.prompt).toContain("# KIB-1 · Ticket KIB-1");
  expect(first?.prompt).toEndWith("\n\nCommence par les tests.");
  expect(run(h, r.id).turns).toBe(1);
}, 30_000);
