import { expect, test } from "bun:test";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { cleanFakeDirs, readHooks, tmp } from "./fake-claude.test-helper";
import { fakeToolUses } from "./fake-claude-ai";
import { FAKE_CLAUDE, FakeRoutes, FakeScenario, scenarioPath } from "./fake-claude-scenario";

cleanFakeDirs();

const MCP_SERVER = `
const fs = require("node:fs");
let buffer = "";
const answer = (id, result) => process.stdout.write(JSON.stringify({ jsonrpc: "2.0", id, result }) + "\\n");
process.stdin.on("data", (chunk) => {
  buffer += chunk;
  let i;
  while ((i = buffer.indexOf("\\n")) >= 0) {
    const msg = JSON.parse(buffer.slice(0, i));
    buffer = buffer.slice(i + 1);
    if (msg.method === "initialize") answer(msg.id, { protocolVersion: msg.params.protocolVersion, capabilities: { tools: {} }, serverInfo: { name: "t", version: "1" } });
    if (msg.method === "tools/call") {
      fs.appendFileSync(process.env.LOG, JSON.stringify(msg.params) + "\\n");
      const text = msg.params.arguments.plan ? "Plan enregistré." : "Compte rendu enregistré.";
      answer(msg.id, { content: [{ type: "text", text }] });
    }
  }
});
`;

const EVENTS = ["SessionStart", "PreToolUse", "PostToolUse", "Stop", "StopFailure", "SessionEnd"];

function settings(dir: string, blockStop: boolean): string {
  const file = join(dir, "hooks.jsonl");
  const record = `cat >> '${file}'; echo >> '${file}'`;
  const marker = join(dir, "blocked");
  const block = `if [ ! -f '${marker}' ]; then touch '${marker}'; echo '{"decision":"block","reason":"rapport"}'; fi`;
  const hooks = Object.fromEntries(
    EVENTS.map((e) => {
      const command = e === "Stop" && blockStop ? `${record}; ${block}` : record;
      return [
        e,
        [{ ...(e.endsWith("ToolUse") ? { matcher: "*" } : {}), hooks: [{ type: "command", command }] }],
      ];
    }),
  );
  return JSON.stringify({ hooks });
}

async function play(name: "progress" | "progress-no-plan" | null, blockStop: boolean, turn?: unknown) {
  const dir = tmp();
  const scenario = join(dir, "scenario.json");
  if (turn !== undefined) writeFileSync(scenario, JSON.stringify({ turns: [turn] }));
  const log = join(dir, "mcp.jsonl");
  const kibo = { command: "bun", args: ["-e", MCP_SERVER], env: { LOG: log } };
  const args = ["-p", "--output-format", "stream-json", "--verbose", "--session-id", "p1"];
  const config = JSON.stringify({ mcpServers: { kibo } });
  const proc = Bun.spawn(
    [FAKE_CLAUDE, ...args, "--settings", settings(dir, blockStop), "--mcp-config", config],
    {
      cwd: dir,
      env: {
        ...process.env,
        KIBO_FAKE_CLAUDE_SCENARIO: name ? scenarioPath(name) : scenario,
        KIBO_FAKE_CLAUDE_STATE: dir,
      },
      stdin: new TextEncoder().encode("Corrige KIB-14."),
      stdout: "pipe",
      stderr: "pipe",
    },
  );
  const [out, err, code] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);
  const transcript = readFileSync(join(dir, "p1.jsonl"), "utf8")
    .trim()
    .split("\n")
    .map((l) => JSON.parse(l) as { type: string; message: { content: unknown }; toolUseResult?: unknown });
  const mcp = existsSync(log) ? readFileSync(log, "utf8").trim().split("\n") : [];
  const result = JSON.parse(out.trim().split("\n").at(-1) ?? "{}") as Record<string, unknown>;
  return { dir, err, code, transcript, hooks: readHooks(join(dir, "hooks.jsonl")), mcp, result };
}

type Block = Record<string, unknown>;
const blockOf = (line: { message: { content: unknown } }): Block => {
  const content = line.message.content;
  if (typeof content === "string") return { type: "prompt" };
  return Array.isArray(content) ? (content[0] as Block) : {};
};
const summary = (b: Block) =>
  b.type === "text" ? `text:${b.text}` : b.type === "tool_use" ? `use:${b.name}` : String(b.type);

test("the progress scenario writes a realistic transcript, in order, and stops once", async () => {
  const run = await play("progress", false);
  expect(run.code).toBe(0);
  const blocks = run.transcript.map(blockOf);
  expect(blocks.map(summary)).toEqual([
    "prompt",
    "text:Je lis le formulaire.",
    "use:Read",
    "tool_result",
    "use:TodoWrite",
    "tool_result",
    "use:mcp__kibo__ticket_progress",
    "tool_result",
    "use:Edit",
    "tool_result",
    "use:Bash",
    "tool_result",
    "text:Un échec sur la validation vide. ghp_FAKE0000000000000000000000",
    "use:Write",
    "tool_result",
    "use:mcp__kibo__ticket_progress",
    "tool_result",
    "text:Validation corrigée ; il reste le cas de l'e-mail vide.",
  ]);
  const results = blocks.flatMap((b, i) =>
    b.type === "tool_result" ? [{ b, use: blocks[i - 1] ?? {} }] : [],
  );
  expect(results.every(({ b, use }) => b.tool_use_id === use.id)).toBe(true);
  expect(blocks[7]).toMatchObject({ content: [{ type: "text", text: "Plan enregistré." }] });
  expect(blocks[11]).toMatchObject({ content: "Exit code 1\n 12 pass\n 1 fail", is_error: true });
  const edit = run.transcript[9]?.toolUseResult as { structuredPatch: Array<{ lines: string[] }> };
  const lines = edit.structuredPatch.flatMap((h) => h.lines);
  expect([
    lines.filter((l) => l.startsWith("+")).length,
    lines.filter((l) => l.startsWith("-")).length,
  ]).toEqual([8, 3]);
  expect(run.mcp.map((l) => JSON.parse(l).name)).toEqual(["ticket_progress", "ticket_progress"]);
  expect(fakeToolUses(run.dir, "p1").map((u) => u.tool)).toEqual([
    "mcp__kibo__ticket_progress",
    "Edit",
    "mcp__kibo__ticket_progress",
  ]);
  const stops = run.hooks.filter((h) => h.hook_event_name === "Stop");
  expect(stops).toEqual([expect.objectContaining({ stop_hook_active: false })]);
  const editHook = run.hooks.find((h) => h.hook_event_name === "PostToolUse" && h.tool_name === "Edit");
  expect(editHook).toMatchObject({ tool_response: "ok" });
  expect(editHook && ("patch" in editHook || "is_error" in editHook)).toBe(false);
  const todo = run.hooks.find((h) => h.tool_name === "TodoWrite");
  expect((todo?.tool_input as { todos: unknown[] }).todos).toHaveLength(3);
});

test("a Stop blocked by a hook plays onStopBlock, then stops again with stop_hook_active", async () => {
  const run = await play("progress-no-plan", true);
  expect(run.code).toBe(0);
  expect(run.hooks.map((h) => h.hook_event_name)).toEqual([
    "SessionStart",
    "PreToolUse",
    "PostToolUse",
    "Stop",
    "PreToolUse",
    "PostToolUse",
    "Stop",
    "SessionEnd",
  ]);
  const stops = run.hooks.filter((h) => h.hook_event_name === "Stop").map((h) => h.stop_hook_active);
  expect(stops).toEqual([false, true]);
  expect(run.mcp.map((l) => JSON.parse(l).arguments)).toEqual([
    { report: { done: "Libellé du bouton corrigé.", files: ["src/Signup.tsx"], next: "" } },
  ]);
  expect(run.transcript.map(blockOf).map(summary).slice(-3)).toEqual([
    "text:Libellé corrigé.",
    "use:mcp__kibo__ticket_progress",
    "tool_result",
  ]);
});

test("the replayed Stop carries the last sentence said after the block", async () => {
  const run = await play(null, true, {
    steps: [{ say: "Avant." }],
    result: "Fini.",
    onStopBlock: [{ say: "Rapport." }],
  });
  const stops = run.hooks.filter((h) => h.hook_event_name === "Stop").map((h) => h.last_assistant_message);
  expect(stops).toEqual(["Fini.", "Rapport."]);
  const silent = await play(null, true, { steps: [{ say: "Avant." }], result: "Fini.", onStopBlock: [] });
  const again = silent.hooks.filter((h) => h.hook_event_name === "Stop").map((h) => h.last_assistant_message);
  expect(again).toEqual(["Fini.", "Fini."]);
});

test("a failing onStopBlock ends the turn in error with StopFailure", async () => {
  const run = await play(null, true, {
    steps: [],
    result: "Fini.",
    onStopBlock: [{ write: "a.txt", fixture: "absent/nothing.fixture" }],
  });
  expect(run.code).toBe(1);
  expect(run.result).toMatchObject({ type: "result", is_error: true });
  expect(run.result.result).not.toBe("Fini.");
  expect(run.hooks.map((h) => h.hook_event_name).slice(-3)).toEqual(["Stop", "StopFailure", "SessionEnd"]);
});

test("without a block, onStopBlock is never played", async () => {
  const run = await play("progress-no-plan", false);
  expect(run.hooks.filter((h) => h.hook_event_name === "Stop")).toHaveLength(1);
  expect(run.mcp).toEqual([]);
});

test("the progress scenarios and their routes are valid", () => {
  for (const name of ["progress", "progress-hold", "progress-no-plan"] as const) {
    expect(() => FakeScenario.parse(JSON.parse(readFileSync(scenarioPath(name), "utf8")))).not.toThrow();
  }
  const routes = FakeRoutes.parse(JSON.parse(readFileSync(scenarioPath("progress-routes"), "utf8")));
  expect(routes.routes.map((r) => [r.prompt, r.scenario])).toEqual([
    ["KIB-14", "progress-hold.json"],
    ["KIB-16", "progress-no-plan.json"],
  ]);
  expect(routes.fallback).toBe("done.json");
  const held = FakeScenario.parse(JSON.parse(readFileSync(scenarioPath("progress-hold"), "utf8")));
  const plain = FakeScenario.parse(JSON.parse(readFileSync(scenarioPath("progress"), "utf8")));
  expect(held.turns[0]?.steps.filter((step) => !("hold" in step || "think" in step))).toEqual(
    plain.turns[0]?.steps ?? [],
  );
});
