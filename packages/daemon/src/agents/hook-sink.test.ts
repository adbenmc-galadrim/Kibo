import { afterEach, expect, spyOn, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  ASK_QUESTION_TOOL,
  type AskInput,
  type HookPayload,
  type Question,
  type RunView,
} from "@kibo/schema";
import { answered, runView } from "../questions/questions.test-helper";
import type { HookSink } from "./hook-route";
import { createHookSink, withAgentQuestions } from "./hook-sink";
import { openRunRegistry } from "./run-registry";
import { openRunStore } from "./run-store";

const dirs: string[] = [];
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

const write: HookPayload = {
  event: "PreToolUse",
  sessionId: "s",
  transcriptPath: null,
  tool: "Write",
  detail: null,
  question: null,
  agentId: null,
  ask: null,
};

test("a demo guard that cannot be built denies the call and is logged", () => {
  const home = mkdtempSync(join(tmpdir(), "kibo-sink-"));
  dirs.push(home);
  const store = openRunStore(home);
  const errors = spyOn(console, "error").mockImplementation(() => {});
  try {
    const registry = openRunRegistry(store);
    registry.create(
      {
        id: "r1",
        projectId: "p1",
        ticketId: "t1",
        ticketKey: "DEMO-6",
        ticketTitle: "Démo",
        profileId: "demo",
        profileName: "demo",
        sessionId: "s",
        brief: "",
        kind: "ticket",
        resumedFrom: null,
      },
      0,
    );
    registry.apply("r1", { type: "admitted", lane: 1 });
    const gone = join(home, "runs/r1/workspace");
    registry.apply("r1", {
      type: "spawned",
      pid: 1,
      resume: false,
      workspace: "isolated",
      cwd: gone,
      guidelines: 0,
    });
    const sink = createHookSink({ live: new Map(), tasks: new Map(), registry });
    expect(sink.receive("r1", write, { file_path: join(gone, "notes.md") })).toEqual({
      decision: "deny",
      reason: "guard error",
    });
    expect(errors.mock.calls.some((c) => String(c[0]).includes("guard of run r1 failed"))).toBe(true);
  } finally {
    errors.mockRestore();
    store.close();
  }
});

const ASK: AskInput = {
  title: "Bloquer le dépôt ?",
  context: "",
  options: ["Oui", "Non"],
  provisional: "Non",
  blocking: false,
};
const asked: HookPayload = { ...write, event: "PostToolUse", tool: ASK_QUESTION_TOOL, ask: ASK };

function questionSink(runs: RunView[], create: (calls: unknown[]) => Question | null) {
  const received: string[] = [];
  const created: unknown[][] = [];
  const notified: [string, string][] = [];
  const inner: HookSink = {
    verify: (runId, token) => runId === "r1" && token === "ok",
    receive(runId, payload) {
      received.push(`${runId}:${payload.event}`);
      return null;
    },
  };
  const sink = withAgentQuestions(inner, {
    runOf: (runId) => runs.find((r) => r.id === runId) ?? null,
    data: {
      createQuestion(...args) {
        created.push(args);
        return create(args);
      },
    },
    onQuestion: (run, q) => notified.push([run.id, q.id]),
  });
  return { sink, received, created, notified };
}

test("an ask after the tool call creates one question on the ticket of the run, as its agent", () => {
  const q = answered("q1");
  const { sink, received, created, notified } = questionSink(
    [runView({ id: "r1", state: "running" })],
    () => q,
  );
  expect(sink.verify("r1", "ok")).toBe(true);
  expect(sink.receive("r1", asked, null)).toBeNull();
  expect(received).toEqual(["r1:PostToolUse"]);
  expect(created).toEqual([["p1", "t1", { id: "r1", profileName: "opus-dev" }, ASK]]);
  expect(notified).toEqual([["r1", "q1"]]);
  sink.receive("r1", asked, null);
  expect(created).toHaveLength(2);
  expect(notified).toEqual([["r1", "q1"]]);
});

test("the call before the tool, a run without ticket, a full run and a failing port create nothing more", () => {
  const warn = spyOn(console, "warn").mockImplementation(() => {});
  const errors = spyOn(console, "error").mockImplementation(() => {});
  try {
    const pre = questionSink([runView({ id: "r1" })], () => answered("q1"));
    pre.sink.receive("r1", { ...asked, event: "PreToolUse" }, { ticketId: "other" });
    expect(pre.created).toEqual([]);
    const system = questionSink([runView({ id: "r1", ticketId: null, projectId: null })], () =>
      answered("q1"),
    );
    system.sink.receive("r1", asked, null);
    expect(system.created).toEqual([]);
    const full = questionSink([runView({ id: "r1" })], () => null);
    full.sink.receive("r1", asked, null);
    expect(full.notified).toEqual([]);
    const invalid = questionSink([runView({ id: "r1" })], () => answered("q1"));
    invalid.sink.receive("r1", { ...asked, ask: null }, null);
    expect(invalid.created).toEqual([]);
    const broken = questionSink([runView({ id: "r1" })], () => {
      throw new Error("disk full");
    });
    expect(broken.sink.receive("r1", asked, null)).toBeNull();
    expect(broken.received).toEqual(["r1:PostToolUse"]);
    const logged = [...warn.mock.calls, ...errors.mock.calls].map((c) => String(c[0]));
    expect(logged.filter((line) => line.includes("question ignorée"))).toHaveLength(3);
    expect(logged.some((line) => line.includes("question of run r1 failed"))).toBe(true);
  } finally {
    warn.mockRestore();
    errors.mockRestore();
  }
});
