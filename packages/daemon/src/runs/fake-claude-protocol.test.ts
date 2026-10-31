import { expect, test } from "bun:test";
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { cleanFakeDirs, finish, readHooks, settings, start, tmp } from "./fake-claude.test-helper";
import { denialReason, fakeMeta } from "./fake-claude-hooks";
import { fakeLaunch } from "./fake-claude-launch";
import { FakeRoutes, FakeScenario } from "./fake-claude-scenario";

cleanFakeDirs();

const DENY = JSON.stringify({
  hookSpecificOutput: {
    hookEventName: "PreToolUse",
    permissionDecision: "deny",
    permissionDecisionReason: "reserved",
  },
});

function scenario(dir: string, turn: Record<string, unknown>): string {
  const file = join(dir, "scenario.json");
  writeFileSync(file, JSON.stringify(FakeScenario.parse({ turns: [{ result: "Fini.", ...turn }] })));
  return file;
}

async function play(turn: Record<string, unknown>, args: string[] = []) {
  const state = tmp();
  const log = join(state, "hooks.jsonl");
  const env = { KIBO_FAKE_CLAUDE_SCENARIO: scenario(state, turn), KIBO_FAKE_CLAUDE_STATE: state };
  const run = await finish(start(["--session-id", "s1", "--settings", settings(log), ...args], env));
  return { state, run, hooks: () => readHooks(log) };
}

test("the launch flags are recorded: agents, tools, model, name and prompt snapshot", async () => {
  const state = tmp();
  const agents = join(state, "agents.json");
  writeFileSync(
    agents,
    JSON.stringify({ review: { description: "Relit le code", prompt: "Tu relis.", tools: ["Read"] } }),
  );
  const env = { KIBO_FAKE_CLAUDE_SCENARIO: scenario(state, { steps: [] }), KIBO_FAKE_CLAUDE_STATE: state };
  const args = [
    "--session-id",
    "s1",
    "--agents",
    agents,
    "--tools",
    "Read,Grep",
    "--disallowedTools",
    "Bash",
    "--model",
    "opus",
    "--name",
    "Agent de projet · Silo",
    "--system-prompt-snapshot",
    "off",
  ];
  expect((await finish(start(args, env))).code).toBe(0);
  expect(fakeLaunch(state, "s1")).toEqual({
    agents: { review: { description: "Relit le code", prompt: "Tu relis.", tools: ["Read"] } },
    tools: ["Read", "Grep"],
    disallowedTools: ["Bash"],
    model: "opus",
    name: "Agent de projet · Silo",
    systemPromptSnapshot: "off",
  });
});

test("a launch without flags records nulls", async () => {
  const { state, run } = await play({ steps: [] });
  expect(run.code).toBe(0);
  expect(fakeLaunch(state, "s1")).toEqual({
    agents: null,
    tools: null,
    disallowedTools: null,
    model: null,
    name: null,
    systemPromptSnapshot: null,
  });
});

test("an invalid agents file stops the launch", async () => {
  for (const content of ["{ pas du json", JSON.stringify({ review: { description: "x" } }), "[]"]) {
    const state = tmp();
    const agents = join(state, "agents.json");
    writeFileSync(agents, content);
    const env = { KIBO_FAKE_CLAUDE_SCENARIO: scenario(state, { steps: [] }), KIBO_FAKE_CLAUDE_STATE: state };
    const run = await finish(start(["--session-id", "s1", "--agents", agents], env));
    expect(run.code).toBe(1);
    expect(run.err).toContain("invalid agents");
  }
});

test("a hook step carries a tool use id shared by its Pre and Post hooks", async () => {
  const { hooks } = await play({
    steps: [
      { hook: "PreToolUse", tool: "Read", input: { file_path: "a.ts" } },
      { hook: "PostToolUse", tool: "Read", input: { file_path: "a.ts" } },
    ],
  });
  const read = hooks().filter((h) => h.tool_name === "Read");
  expect(read[0]?.tool_use_id).toEqual(expect.stringMatching(/^toolu_/));
  expect(read[1]?.tool_use_id).toBe(read[0]?.tool_use_id);
});

function blockingStopSettings(dir: string): string {
  const log = join(dir, "hooks.jsonl");
  const marker = join(dir, "blocked");
  const record = `cat >> '${log}'; echo >> '${log}'`;
  const block = `if [ ! -f '${marker}' ]; then touch '${marker}'; echo '{"decision":"block","reason":"rapport"}'; fi`;
  return JSON.stringify({
    hooks: { Stop: [{ hooks: [{ type: "command", command: `${record}; ${block}` }] }] },
  });
}

test("a Stop blocked by a hook plays onStopBlock, then replays Stop with the last sentence said", async () => {
  const stopsOf = async (onStopBlock: unknown[]) => {
    const state = tmp();
    const env = {
      KIBO_FAKE_CLAUDE_SCENARIO: scenario(state, { steps: [{ say: "Avant." }], onStopBlock }),
      KIBO_FAKE_CLAUDE_STATE: state,
    };
    const run = await finish(start(["--session-id", "s1", "--settings", blockingStopSettings(state)], env));
    expect(run.code).toBe(0);
    return readHooks(join(state, "hooks.jsonl")).map((h) => [h.stop_hook_active, h.last_assistant_message]);
  };
  expect(await stopsOf([{ say: "Rapport." }])).toEqual([
    [false, "Fini."],
    [true, "Rapport."],
  ]);
  expect(await stopsOf([])).toEqual([
    [false, "Fini."],
    [true, "Fini."],
  ]);
});

test("structuredOutput is copied into the result line", async () => {
  const pages = { pages: [{ title: "Suivi clients" }] };
  const { run } = await play({ steps: [], structuredOutput: pages });
  expect(run.lines.at(-1)).toMatchObject({ type: "result", structured_output: pages });
  const plain = await play({ steps: [] });
  expect(plain.run.lines.at(-1)).not.toHaveProperty("structured_output");
});

test("the fake claude binary answers the probes without a scenario", async () => {
  const probe = async (args: string[], env: Record<string, string> = {}) => {
    const proc = Bun.spawn([join(import.meta.dir, "fake-claude.ts"), ...args], {
      env: { ...process.env, ...env },
      stdout: "pipe",
      stderr: "pipe",
    });
    const [out, code] = await Promise.all([new Response(proc.stdout).text(), proc.exited]);
    return { out, code };
  };
  expect(await probe(["--version"])).toEqual({ out: "2.1.283 (Claude Code)\n", code: 0 });
  const auth = await probe(["auth", "status", "--json"], { KIBO_FAKE_CLAUDE_LOGGED_OUT: "1" });
  expect(auth).toEqual({ out: '{"loggedIn":false}\n', code: 0 });
  const legacy = await probe(["--help"], { KIBO_FAKE_CLAUDE_HELP: "legacy" });
  expect(legacy.out).toContain('"default"');
  expect(legacy.out).not.toContain("--tools");
});

test("fakeMeta answers --version, --help and auth status", () => {
  expect(fakeMeta(["--version"], {})).toBe("2.1.283 (Claude Code)\n");
  expect(fakeMeta(["--help"], {})).toContain("--json-schema");
  expect(fakeMeta(["--help"], { KIBO_FAKE_CLAUDE_HELP: "legacy" })).not.toContain("--json-schema");
  expect(fakeMeta(["auth", "status", "--json"], {})).toBe('{"loggedIn":true,"authMethod":"claude.ai"}\n');
  expect(fakeMeta(["auth", "status", "--json"], { KIBO_FAKE_CLAUDE_LOGGED_OUT: "1" })).toBe(
    '{"loggedIn":false}\n',
  );
  expect(fakeMeta(["-p", "--output-format", "stream-json"], {})).toBeNull();
});

test("denialReason reads the PreToolUse decision printed by kibo-hook", () => {
  expect(denialReason(["", DENY])).toBe("reserved");
  expect(denialReason([JSON.stringify({ hookSpecificOutput: { permissionDecision: "allow" } })])).toBeNull();
  expect(denialReason([""])).toBeNull();
  expect(denialReason(["{not json", "plain text"])).toBeNull();
  expect(denialReason([JSON.stringify({ hookSpecificOutput: { permissionDecision: "deny" } })])).toBe(
    "denied",
  );
});

test("every scenario parses, as turns or as routes to existing scenarios", () => {
  const dir = join(import.meta.dir, "scenarios");
  const files = readdirSync(dir).filter((f) => f.endsWith(".json"));
  expect(files.length).toBeGreaterThan(0);
  for (const file of files) {
    const json: unknown = JSON.parse(readFileSync(join(dir, file), "utf8"));
    const routes = FakeRoutes.safeParse(json);
    if (!routes.success) {
      expect(FakeScenario.safeParse(json).success).toBe(true);
      continue;
    }
    for (const target of [...routes.data.routes.map((r) => r.scenario), routes.data.fallback])
      expect(files).toContain(target);
  }
});
