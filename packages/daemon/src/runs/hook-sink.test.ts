import { afterEach, expect, spyOn, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  ASK_QUESTION_TOOL,
  type AskInput,
  DEFAULT_AGENT_SETTINGS,
  type HookPayload,
  type Question,
  type RunView,
} from "@kibo/schema";
import { answered, runView } from "../questions/questions.test-helper";
import { agentGuardOf } from "./agent-guard";
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
  toolUseId: null,
  ask: null,
  todos: null,
  stopHookActive: false,
};

const ASK: AskInput = {
  kind: "question",
  images: [],
  title: "Bloquer le dépôt ?",
  context: "",
  options: ["Oui", "Non"],
  provisional: "Non",
  blocking: false,
  recipient: null,
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
  expect(created).toEqual([["p1", "t1", { id: "r1", profileName: "opus-dev", cwd: null }, ASK]]);
  expect(notified).toEqual([["r1", "q1"]]);
  sink.receive("r1", asked, null);
  expect(created).toHaveLength(2);
  expect(notified).toEqual([["r1", "q1"]]);
});

test("a validation ask reaches the port with its kind, its image paths and the folder of the run", () => {
  const validation = { ...ASK, kind: "validation" as const, images: ["/w/shots/1.png"] };
  const run = runView({ id: "r1", state: "running", cwd: "/w" });
  const { sink, created } = questionSink([run], () => answered("q2"));
  sink.receive("r1", { ...asked, ask: validation }, null);
  expect(created).toEqual([["p1", "t1", { id: "r1", profileName: "opus-dev", cwd: "/w" }, validation]]);
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

test("the sink denies a shell call of a project run even when the CLI let it through", () => {
  const home = mkdtempSync(join(tmpdir(), "kibo-sink-"));
  dirs.push(home);
  const store = openRunStore(home);
  try {
    const registry = openRunRegistry(store);
    const run = (id: string, kind: "ticket" | "project") =>
      registry.create(
        {
          id,
          projectId: "p1",
          ticketId: kind === "ticket" ? "t1" : null,
          ticketKey: kind === "ticket" ? "SILO-1" : null,
          ticketTitle: "Agent de projet · Silo",
          profileId: kind === "ticket" ? "global:opus" : "system:project-agent",
          profileName: "x",
          agentScope: "global",
          projectKey: null,
          sessionId: `s-${id}`,
          brief: "",
          kind,
          resumedFrom: null,
        },
        0,
      );
    run("p", "project");
    run("t", "ticket");
    const sink = createHookSink({ live: new Map(), registry, agentGuard: () => null });
    const bash = { ...write, tool: "Bash" };
    expect(sink.receive("p", bash, { command: "ls" })).toMatchObject({
      kind: "permission",
      decision: "deny",
    });
    expect(sink.receive("p", { ...write, tool: "mcp__kibo__get_ticket" }, { key: "SILO-1" })).toBeNull();
    expect(sink.receive("t", bash, { command: "ls" })).toBeNull();
  } finally {
    store.close();
  }
});

test("the agent guard joins the project guard, the first deny wins and a throw denies", () => {
  const home = mkdtempSync(join(tmpdir(), "kibo-sink-"));
  dirs.push(home);
  const store = openRunStore(home);
  const errors = spyOn(console, "error").mockImplementation(() => {});
  try {
    const registry = openRunRegistry(store);
    for (const id of ["r1", "r2"])
      registry.create(
        {
          id,
          projectId: "p1",
          ticketId: null,
          ticketKey: null,
          ticketTitle: "Tâche",
          profileId: "global:review-pr",
          profileName: "review-pr",
          agentScope: "global",
          projectKey: null,
          sessionId: `s-${id}`,
          brief: "",
          kind: "ticket",
          resumedFrom: null,
        },
        0,
      );
    const rules = {
      settings: {
        ...DEFAULT_AGENT_SETTINGS,
        genericSubagents: false,
        skills: { mode: "list" as const, ids: ["brainstorming"] },
      },
    };
    const sink = createHookSink({
      live: new Map(),
      registry,
      agentGuard: (run) => {
        if (run.id === "r2") throw new Error("catalog down");
        return agentGuardOf(rules);
      },
    });
    const skill = { ...write, tool: "Skill" };
    expect(sink.receive("r1", skill, { skill: "deploy" })).toMatchObject({
      decision: "deny",
      reason: expect.stringContaining("skill non autorisé par Kibo"),
    });
    expect(sink.receive("r1", skill, { skill: "brainstorming" })).toBeNull();
    expect(sink.receive("r1", { ...write, tool: "Agent" }, { subagent_type: "seo" })).toMatchObject({
      decision: "deny",
      reason: expect.stringContaining("sous-agent non autorisé par Kibo"),
    });
    expect(sink.receive("r2", skill, { skill: "brainstorming" })).toMatchObject({
      decision: "deny",
      reason: "guard error",
    });
  } finally {
    errors.mockRestore();
    store.close();
  }
});
