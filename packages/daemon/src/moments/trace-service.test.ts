import { expect, test } from "bun:test";
import { statSync } from "node:fs";
import { join } from "node:path";
import { openTranscript } from "../agents/fake-claude-transcript";
import { cleanTraceDirs, hook, kinds, playEditAndTests, setup } from "./trace.test-helper";

cleanTraceDirs();

test("an accepted transcript is folded into moments, pass after pass", async () => {
  const s = setup();
  playEditAndTests(s);
  await s.trace.onHook(s.run, hook("PostToolUse", { tool: "Bash" }));
  expect(s.trace.trace(s.run.id)).toMatchObject({ source: "transcript", path: s.path, partial: null });
  expect(s.trace.trace(s.run.id)?.offset).toBe(statSync(s.path).size);
  expect(kinds(s)).toEqual(["message", "actions", "reasoning", "message"]);
  const actions = s.store.list(s.run.id)[1]?.data;
  expect(actions).toMatchObject({
    kind: "actions",
    summary: "A lu 1 fichier, modifié 1 fichier et lancé les tests (12 réussis, 1 échec)",
    failed: true,
  });
  expect(s.events).toEqual([{ type: "run.moments", runId: s.run.id, moments: s.store.list(s.run.id) }]);

  await s.trace.onHook(s.run, hook("PostToolUse", { tool: "Read" }));
  expect(s.events).toHaveLength(1);

  s.transcript.say("Terminé.");
  await s.trace.onHook(s.run, hook("Stop", { detail: "Terminé." }));
  expect(s.events.at(-1)?.moments.map((m) => m.data)).toEqual([{ kind: "message", text: "Terminé." }]);
  expect(kinds(s)).toHaveLength(5);
});

test("hooks that start no pass read nothing", async () => {
  const s = setup();
  playEditAndTests(s);
  await s.trace.onHook(s.run, hook("PreToolUse", { tool: "Edit" }));
  await s.trace.onHook(s.run, hook("SessionStart"));
  expect(s.reads.count).toBe(0);
  expect(s.trace.trace(s.run.id)).toBeNull();
});

test("simultaneous hooks run their passes one after the other", async () => {
  const s = setup();
  playEditAndTests(s);
  await Promise.all([
    s.trace.onHook(s.run, hook("PostToolUse")),
    s.trace.onHook(s.run, hook("PostToolUse")),
    s.trace.onHook(s.run, hook("Notification")),
  ]);
  expect(s.reads.count).toBe(3);
  const seqs = s.store.list(s.run.id).map((m) => m.seq);
  expect(seqs).toEqual([0, 1, 2, 3]);
});

test("a transcript bigger than a pass is read in several chained passes", async () => {
  const s = setup({ maxBytes: 4 * 1024 });
  for (let i = 0; i < 40; i++) s.transcript.say(`Message ${i} ${"x".repeat(500)}`);
  await s.trace.onHook(s.run, hook("PostToolUse"));
  expect(s.reads.count).toBeGreaterThan(4);
  expect(kinds(s)).toEqual(Array.from({ length: 40 }, () => "message"));
});

test("TodoWrite becomes the internal plan", async () => {
  const s = setup();
  const todos = [
    { content: "Lire", status: "completed" as const },
    { content: "Corriger", status: "in_progress" as const },
  ];
  await s.trace.onHook(s.run, hook("PostToolUse", { tool: "TodoWrite", todos }));
  expect(s.trace.page(s.run.id).internalPlan).toEqual([
    { id: "todo-1", title: "Lire", status: "done", note: null },
    { id: "todo-2", title: "Corriger", status: "doing", note: null },
  ]);
});

test("moments carry the doing step, earlier actions keep the previous one", async () => {
  const s = setup();
  const t = s.transcript;
  t.toolResult(t.toolUse("Read", { file_path: "a.ts" }), { content: "x", isError: false });
  await s.trace.onHook(s.run, hook("PostToolUse"));
  expect(kinds(s)).toEqual([]);
  t.toolUse("mcp__kibo__ticket_progress", { plan: [] });
  s.trace.setDoingStep(s.run.id, "s2");
  expect(s.store.list(s.run.id).map((m) => [m.data.kind, m.stepId])).toEqual([["actions", null]]);
  t.toolResult(t.toolUse("Edit", { file_path: "a.ts" }), { content: "ok", isError: false });
  t.say("Corrigé.");
  await s.trace.onHook(s.run, hook("PostToolUse"));
  const moments = s.store.list(s.run.id);
  expect(moments.slice(1).map((m) => [m.data.kind, m.stepId])).toEqual([
    ["actions", "s2"],
    ["message", "s2"],
  ]);
  expect(moments[1]?.data.kind === "actions" && moments[1].data.actions.length).toBe(1);
  expect(s.trace.trace(s.run.id)?.doingStep).toBe("s2");
});

test("a reminder is a moment, after the actions that preceded it", async () => {
  const s = setup();
  const t = s.transcript;
  t.toolResult(t.toolUse("Read", { file_path: "a.ts" }), { content: "x", isError: false });
  await s.trace.onHook(s.run, hook("PostToolUse"));
  const moment = s.trace.reminder(s.run.id, "plan");
  expect(moment.data).toEqual({ kind: "reminder", reminder: "plan" });
  expect(kinds(s)).toEqual(["actions", "reminder"]);
  expect(s.events.at(-1)?.moments).toEqual([moment]);
});

test("the turn end makes a final pass, flushes and closes a finished run", async () => {
  const s = setup();
  s.transcript.say("Je lance les tests.");
  s.transcript.toolUse("Bash", { command: "bun test" });
  await s.trace.onTurnEnd({ ...s.run, state: "waiting_input" });
  expect(kinds(s)).toEqual(["message", "actions"]);
  expect(s.trace.trace(s.run.id)?.closedAt).toBeNull();

  s.transcript.say("Fini.");
  s.clock.now = 9_000;
  await s.trace.onTurnEnd({ ...s.run, state: "done" });
  expect(kinds(s)).toEqual(["message", "actions", "message"]);
  expect(s.trace.trace(s.run.id)?.closedAt).toBe(9_000);

  const reads = s.reads.count;
  s.transcript.say("Trop tard.");
  await s.trace.onHook({ ...s.run, state: "done" }, hook("PostToolUse"));
  await s.trace.onTurnEnd({ ...s.run, state: "done" });
  expect(s.reads.count).toBe(reads);
  expect(kinds(s)).toHaveLength(3);
});

test("a finished run resumed by an answer is read again from where it stopped", async () => {
  const s = setup();
  s.transcript.say("Veux-tu des tests ?");
  await s.trace.onTurnEnd({ ...s.run, state: "done" });
  expect(s.trace.trace(s.run.id)?.closedAt).not.toBeNull();

  s.transcript.say("Tout passe.");
  await s.trace.onHook({ ...s.run, state: "running" }, hook("Stop"));
  expect(s.trace.trace(s.run.id)?.closedAt).toBeNull();
  await s.trace.onTurnEnd({ ...s.run, state: "done" });
  expect(s.store.list(s.run.id).map((m) => m.data)).toEqual([
    { kind: "message", text: "Veux-tu des tests ?" },
    { kind: "message", text: "Tout passe." },
  ]);
  expect(s.trace.trace(s.run.id)?.closedAt).not.toBeNull();
});

test("a run that never sent a path is closed without a partial line", async () => {
  const s = setup();
  await s.trace.onTurnEnd({ ...s.run, state: "failed", transcriptPath: null });
  expect(s.trace.trace(s.run.id)).toMatchObject({ source: "pending", partial: null, closedAt: 5_000 });
  expect(kinds(s)).toEqual([]);
});

test("a new session of the same run is read from its own file", async () => {
  const s = setup();
  s.transcript.say("Premier tour.");
  await s.trace.onHook(s.run, hook("Stop"));
  const next = { ...s.run, sessionId: "sess-2", transcriptPath: join(s.root, "proj", "sess-2.jsonl") };
  const second = openTranscript(next.transcriptPath, "sess-2", s.home);
  second.say("Second tour.");
  await s.trace.onHook(next, hook("Stop", { transcriptPath: next.transcriptPath }));
  expect(s.store.list(s.run.id).map((m) => m.data)).toEqual([
    { kind: "message", text: "Premier tour." },
    { kind: "message", text: "Second tour." },
  ]);
  expect(s.trace.trace(s.run.id)?.path).toBe(next.transcriptPath);
});

test("page and peek read what is stored, without reading the transcript", async () => {
  const s = setup();
  s.transcript.say(`Je corrige. ${"z".repeat(300)}`);
  await s.trace.onHook(s.run, hook("PostToolUse"));
  const reads = s.reads.count;
  const page = s.trace.page(s.run.id);
  expect(page).toEqual({
    moments: s.store.list(s.run.id),
    internalPlan: null,
    partial: null,
    source: "transcript",
  });
  expect(s.trace.page(s.run.id, 0).moments).toEqual([]);
  expect(s.trace.page("inconnu")).toEqual({
    moments: [],
    internalPlan: null,
    partial: null,
    source: "pending",
  });
  const summary = { runId: s.run.id, step: { index: 2, total: 5, title: "Corriger" }, report: null };
  const peek = s.trace.peek({ ...s.run, state: "waiting_input" }, summary);
  expect(peek).toMatchObject({
    runId: s.run.id,
    label: s.run.label,
    profileName: "opus-dev",
    state: "waiting_input",
    ticketKey: "KIB-14",
    ticketTitle: "Corriger la validation",
    step: summary.step,
    waiting: true,
  });
  expect(peek.lastMessage?.startsWith("Je corrige.")).toBe(true);
  expect(peek.lastMessage?.length).toBe(200);
  expect(s.trace.peek(s.run, null)).toMatchObject({ step: null, waiting: false });
  expect(s.reads.count).toBe(reads);
});
