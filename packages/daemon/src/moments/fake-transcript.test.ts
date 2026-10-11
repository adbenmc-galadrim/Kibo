import { expect, test } from "bun:test";
import { mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { initRun } from "@kibo/core/run-machine";
import { hasSecret, type RunMoment, type RunView } from "@kibo/schema";
import { cleanFakeDirs, tmp } from "../agents/fake-claude.test-helper";
import { FAKE_CLAUDE, scenarioPath } from "../agents/fake-claude-scenario";
import { reduceHookInput } from "../agents/hook-payload";
import { openMomentStore } from "./store";
import { createTraceService } from "./trace-service";

cleanFakeDirs();

const MCP_SERVER = `
let buffer = "";
const answer = (id, result) => process.stdout.write(JSON.stringify({ jsonrpc: "2.0", id, result }) + "\\n");
process.stdin.on("data", (chunk) => {
  buffer += chunk;
  let i;
  while ((i = buffer.indexOf("\\n")) >= 0) {
    const msg = JSON.parse(buffer.slice(0, i));
    buffer = buffer.slice(i + 1);
    if (msg.method === "initialize") answer(msg.id, { protocolVersion: msg.params.protocolVersion, capabilities: { tools: {} }, serverInfo: { name: "t", version: "1" } });
    if (msg.method === "tools/call") answer(msg.id, { content: [{ type: "text", text: "Plan enregistré." }] });
  }
});
`;

const EVENTS = ["SessionStart", "PreToolUse", "PostToolUse", "Stop", "SessionEnd"];

function settings(file: string): string {
  const command = `cat >> '${file}'; echo >> '${file}'`;
  const hooks = Object.fromEntries(
    EVENTS.map((e) => [
      e,
      [{ ...(e.endsWith("ToolUse") ? { matcher: "*" } : {}), hooks: [{ type: "command", command }] }],
    ]),
  );
  return JSON.stringify({ hooks });
}

async function playProgress(home: string) {
  const state = join(home, "fake", "projects");
  mkdirSync(state, { recursive: true });
  const hooksFile = join(home, "hooks.jsonl");
  const config = JSON.stringify({ mcpServers: { kibo: { command: "bun", args: ["-e", MCP_SERVER] } } });
  const proc = Bun.spawn(
    [
      FAKE_CLAUDE,
      ...["-p", "--output-format", "stream-json", "--verbose", "--session-id", "sess-p"],
      ...["--settings", settings(hooksFile), "--mcp-config", config],
    ],
    {
      cwd: home,
      env: {
        ...process.env,
        KIBO_FAKE_CLAUDE_SCENARIO: scenarioPath("progress"),
        KIBO_FAKE_CLAUDE_STATE: state,
      },
      stdin: new TextEncoder().encode("Corrige KIB-14."),
      stdout: "pipe",
      stderr: "pipe",
    },
  );
  expect(await proc.exited).toBe(0);
  return readFileSync(hooksFile, "utf8")
    .trim()
    .split("\n")
    .map((line) => reduceHookInput(JSON.parse(line)));
}

const shape = (m: RunMoment) =>
  m.data.kind === "actions" ? `actions:${m.data.actions.map((a) => a.kind).join(",")}` : m.data.kind;

test("the fake claude transcript folds into the expected moments through the hooks", async () => {
  const home = tmp();
  const payloads = await playProgress(home);
  const store = openMomentStore(home);
  const trace = createTraceService({ store, root: join(home, "fake"), now: () => 1, emit: () => {} });
  const record = {
    id: "run-p",
    kind: "ticket" as const,
    seq: 1,
    projectId: "p1",
    ticketId: "t1",
    ticketKey: "KIB-14",
    ticketTitle: "Corriger la validation",
    profileId: "opus",
    profileName: "opus-dev",
    sessionId: "sess-p",
    brief: "",
    createdAt: 0,
    resumedFrom: null,
  };
  let run: RunView = { ...initRun(record, 0, 0), state: "running" };
  for (const payload of payloads) {
    run = { ...run, transcriptPath: payload.transcriptPath };
    await trace.onHook(run, payload);
  }
  await trace.onTurnEnd({ ...run, state: "done" });

  expect(trace.trace(run.id)).toMatchObject({ source: "transcript", partial: null });
  const moments = store.list(run.id);
  expect(moments.map(shape)).toEqual([
    "message",
    "actions:read,todo,progress,edit,test",
    "message",
    "actions:create,progress",
    "message",
  ]);
  const edit = moments[1]?.data.kind === "actions" ? moments[1].data.actions[3] : null;
  expect(edit).toMatchObject({ label: "A modifié `LoginForm.tsx` (+8 −3)", patch: { added: 8, removed: 3 } });
  expect(moments[1]?.data).toMatchObject({ failed: true });
  expect(moments.every((m) => m.data.kind !== "raw")).toBe(true);
  expect(moments.some((m) => hasSecret(m.data.kind === "message" ? m.data.text : ""))).toBe(false);
  expect(trace.page(run.id).internalPlan?.map((s) => s.status)).toEqual(["done", "doing", "todo"]);
  store.close();
});
