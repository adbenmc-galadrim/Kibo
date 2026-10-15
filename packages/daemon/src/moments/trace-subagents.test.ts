import { expect, test } from "bun:test";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { MomentData } from "@kibo/schema";
import { openTranscript } from "../agents/fake-claude-transcript";
import { createSubagentSources } from "../subagents/sources";
import { openSubagentStore } from "../subagents/store";
import { subagentMetaPath, subagentTracePath } from "../subagents/trace";
import { createSubagentTracker } from "../subagents/tracker";
import { cleanTraceDirs, hook, SESSION, setup, tmp } from "./trace.test-helper";
import type { SubagentPort } from "./trace-live";

cleanTraceDirs();

const REVIEW = {
  subagent_type: "ecc:code-reviewer",
  description: "Porte qualité — correctness",
  prompt: "Relis le diff",
};
const META = join(import.meta.dir, "..", "subagents", "fixtures", "agent-meta.json");

function tracedRun(maxBytes?: number) {
  const order: string[] = [];
  const port: { current: SubagentPort | null } = { current: null };
  const relay: SubagentPort = {
    discover: (runId, path) => port.current?.discover(runId, path),
    sources: (runId) => port.current?.sources(runId) ?? [],
    read(path, offset, max) {
      order.push("subagent");
      if (port.current === null) throw new Error("no port");
      return port.current.read(path, offset, max);
    },
    skip: (path, offset) => port.current?.skip(path, offset) ?? null,
    advanced: (runId, source, offset, closed) => port.current?.advanced(runId, source, offset, closed),
    onLines: (runId, id, lines) => port.current?.onLines(runId, id, lines),
  };
  const onRead = () => order.push("main");
  const s = setup({ subagents: relay, onRead, ...(maxBytes === undefined ? {} : { maxBytes }) });
  const store = openSubagentStore(tmp(), (runId, id) => s.store.subagentFacts(runId, id));
  const file = { transcriptPath: s.path, sessionId: SESSION, agentId: "a1" };
  const tracker = createSubagentTracker({
    store,
    now: () => s.clock.now,
    transcriptOf: (_runId, agentId) => subagentTracePath({ ...file, agentId }),
    announce: (runId, moment) => s.trace.mark(runId, moment),
  });
  port.current = createSubagentSources({ store, tracker, root: s.root, now: () => s.clock.now });
  return { s, store, tracker, order, file };
}

function launchReview(t: ReturnType<typeof tracedRun>) {
  const main = t.s.transcript;
  main.say("Je lance la revue.");
  const toolUseId = main.toolUse("Agent", REVIEW);
  mkdirSync(join(t.s.root, "proj", SESSION, "subagents"), { recursive: true });
  const meta = JSON.parse(readFileSync(META, "utf8"));
  writeFileSync(subagentMetaPath(t.file), JSON.stringify({ ...meta, toolUseId }));
  const sub = openTranscript(subagentTracePath(t.file), SESSION, t.s.home);
  sub.sidechain(true);
  sub.say("Je relis le diff.");
  sub.toolResult(sub.toolUse("Bash", { command: "git diff" }), { content: "diff", isError: false });
  sub.say("Rien à signaler.");
  return toolUseId;
}

const kindsOf = (data: MomentData[]) => data.map((d) => d.kind);

test("a pass reads the main thread then each active subagent", async () => {
  const t = tracedRun();
  const toolUseId = launchReview(t);
  await t.s.trace.onHook(t.s.run, hook("Stop"));
  const main = t.s.store.list(t.s.run.id).map((m) => m.data);
  expect(main).toEqual([
    { kind: "message", text: "Je lance la revue." },
    {
      kind: "subagent",
      subagentId: "a1",
      type: "ecc:code-reviewer",
      description: "Porte qualité — correctness",
    },
  ]);
  const own = t.s.store.listSubagent(t.s.run.id, "a1");
  expect(kindsOf(own.map((m) => m.data))).toEqual(["message", "actions", "message"]);
  expect(own.every((m) => m.subagentId === "a1")).toBe(true);
  expect(t.store.list(t.s.run.id)).toEqual([
    expect.objectContaining({
      id: "a1",
      toolUseId,
      prompt: "Relis le diff",
      state: "running",
      actions: 1,
      result: "Rien à signaler.",
    }),
  ]);
  expect(t.order.slice(0, 2)).toEqual(["main", "subagent"]);
});

test("the subagent waits while the main thread uses the whole budget", async () => {
  const t = tracedRun(1024);
  launchReview(t);
  await t.s.trace.onHook(t.s.run, hook("Stop"));
  expect(t.s.reads.count).toBeGreaterThan(1);
  expect(t.s.store.listSubagent(t.s.run.id, "a1")).toHaveLength(3);
});

test("an ended subagent is read to its end then closed", async () => {
  const t = tracedRun();
  launchReview(t);
  await t.s.trace.onHook(t.s.run, hook("Stop"));
  t.tracker.onHook(
    t.s.run.id,
    hook("SubagentStop", { agentId: "a1", tool: "ecc:code-reviewer", detail: "RAS" }),
  );
  writeFileSync(subagentTracePath(t.file), "", { flag: "a" });
  await t.s.trace.onHook(t.s.run, hook("Stop"));
  expect(t.store.trace("a1")?.closedAt).not.toBeNull();
  expect(t.store.list(t.s.run.id)[0]).toMatchObject({ state: "done", result: "Rien à signaler." });
});

test("the actions of a running subagent are shown as soon as they are read", async () => {
  const t = tracedRun();
  const main = t.s.transcript;
  const toolUseId = main.toolUse("Agent", REVIEW);
  mkdirSync(join(t.s.root, "proj", SESSION, "subagents"), { recursive: true });
  const meta = JSON.parse(readFileSync(META, "utf8"));
  writeFileSync(subagentMetaPath(t.file), JSON.stringify({ ...meta, toolUseId }));
  const sub = openTranscript(subagentTracePath(t.file), SESSION, t.s.home);
  sub.sidechain(true);
  sub.toolResult(sub.toolUse("Bash", { command: "git diff" }), { content: "diff", isError: false });
  const pending = sub.toolUse("Read", { file_path: "a.ts" });
  await t.s.trace.onHook(t.s.run, hook("PostToolUse", { tool: "Bash" }));
  const own = t.s.store.listSubagent(t.s.run.id, "a1").map((m) => m.data);
  expect(kindsOf(own)).toEqual(["actions"]);
  expect(own[0]).toMatchObject({ actions: [expect.objectContaining({ tool: "Bash" })] });
  sub.toolResult(pending, { content: "x", isError: false });
  await t.s.trace.onHook(t.s.run, hook("PostToolUse", { tool: "Read" }));
  const after = t.s.store.listSubagent(t.s.run.id, "a1").map((m) => m.data);
  expect(after[1]).toMatchObject({ actions: [expect.objectContaining({ tool: "Read" })] });
});
