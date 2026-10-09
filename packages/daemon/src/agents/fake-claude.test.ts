import { expect, test } from "bun:test";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { cleanFakeDirs, finish, readHooks, settings, start, tmp } from "./fake-claude.test-helper";
import { FAKE_CLAUDE, fakeCalls, releaseFakeRun, scenarioPath } from "./fake-claude-scenario";

cleanFakeDirs();

test("plays a turn: hooks with Claude Code inputs, transcript and a stream-json result", async () => {
  const state = tmp();
  const hooks = join(state, "hooks.jsonl");
  const env = {
    KIBO_FAKE_CLAUDE_SCENARIO: scenarioPath("question"),
    KIBO_FAKE_CLAUDE_STATE: state,
    KIBO_RUN_TOKEN: "t",
  };
  const run = await finish(start(["--session-id", "s1", "--settings", settings(hooks)], env));
  expect(run.code).toBe(0);
  expect(run.lines[0]).toMatchObject({ type: "system", subtype: "init", session_id: "s1" });
  expect(run.lines.at(-1)).toMatchObject({
    type: "result",
    is_error: false,
    result: "J'attends ta réponse.",
    session_id: "s1",
  });
  const got = readHooks(hooks);
  expect(got.map((h) => h.hook_event_name)).toEqual([
    "SessionStart",
    "PreToolUse",
    "PostToolUse",
    "PreToolUse",
    "PostToolUse",
    "Stop",
    "SessionEnd",
  ]);
  expect(got[4]).toMatchObject({
    session_id: "s1",
    tool_name: "mcp__kibo__ask_user",
    tool_input: { question: "Quel port pour le récepteur ?" },
    transcript_path: join(state, "s1.jsonl"),
  });
  expect(fakeCalls(state, "s1")).toEqual([
    expect.objectContaining({ prompt: "Lis le brief.", hasToken: true, hookUrl: null }),
  ]);
});

test("a resume plays the next turn of the same session", async () => {
  const state = tmp();
  const hooks = join(state, "hooks.jsonl");
  const env = { KIBO_FAKE_CLAUDE_SCENARIO: scenarioPath("question"), KIBO_FAKE_CLAUDE_STATE: state };
  await finish(start(["--session-id", "s2", "--settings", settings(hooks)], env));
  const second = await finish(
    start(["--resume", "s2", "--settings", settings(hooks)], env, "Port dynamique"),
  );
  expect(second.lines.at(-1)).toMatchObject({ result: "Port dynamique appliqué." });
  expect(
    readHooks(hooks)
      .filter((h) => h.hook_event_name === "SessionStart")
      .map((h) => h.source),
  ).toEqual(["startup", "resume"]);
  expect(fakeCalls(state, "s2").map((c) => c.prompt)).toEqual(["Lis le brief.", "Port dynamique"]);
});

test("refuses to bypass permissions", async () => {
  const env = { KIBO_FAKE_CLAUDE_SCENARIO: scenarioPath("done"), KIBO_FAKE_CLAUDE_STATE: tmp() };
  expect((await finish(start(["--session-id", "s3", "--dangerously-skip-permissions"], env))).code).toBe(3);
  expect(
    (await finish(start(["--session-id", "s3", "--permission-mode", "bypassPermissions"], env))).code,
  ).toBe(3);
});

test("a failing turn exits non-zero with an error result and StopFailure", async () => {
  const state = tmp();
  const hooks = join(state, "hooks.jsonl");
  const env = { KIBO_FAKE_CLAUDE_SCENARIO: scenarioPath("fail"), KIBO_FAKE_CLAUDE_STATE: state };
  const run = await finish(start(["--session-id", "s4", "--settings", settings(hooks)], env));
  expect(run.code).toBe(1);
  expect(run.err).toContain("boom");
  expect(run.lines.at(-1)).toMatchObject({ is_error: true, result: "Échec : tests" });
  expect(readHooks(hooks).map((h) => h.hook_event_name)).toContain("StopFailure");
});

test("--help lists the permission modes of Claude Code 2.1.283", async () => {
  const proc = Bun.spawn([FAKE_CLAUDE, "--help"], { stdout: "pipe" });
  const text = await new Response(proc.stdout).text();
  expect(text).toContain('"manual"');
  expect(text).not.toContain('"default"');
  expect(await proc.exited).toBe(0);
});

test("a PreToolUse denied by a hook becomes a permission denial", async () => {
  const state = tmp();
  const deny = JSON.stringify({
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "deny",
      permissionDecisionReason: "non",
    },
  });
  const command = `if grep -q '"tool_name":"Bash"'; then echo '${deny}'; fi`;
  const guardSettings = JSON.stringify({
    hooks: { PreToolUse: [{ matcher: "*", hooks: [{ type: "command", command }] }] },
  });
  const env = { KIBO_FAKE_CLAUDE_SCENARIO: scenarioPath("guard"), KIBO_FAKE_CLAUDE_STATE: state };
  const run = await finish(start(["--session-id", "s6", "--settings", guardSettings], env));
  expect(run.code).toBe(0);
  expect(run.lines.at(-1)).toMatchObject({
    permission_denials: [{ tool_name: "Bash" }],
    result: '{"title":"Burndown"}',
  });
});

test("hold keeps the process alive until released", async () => {
  const state = tmp();
  const env = { KIBO_FAKE_CLAUDE_SCENARIO: scenarioPath("hold"), KIBO_FAKE_CLAUDE_STATE: state };
  const proc = start(["--session-id", "s5"], env);
  while (fakeCalls(state, "s5").length === 0) await Bun.sleep(20);
  await Bun.sleep(150);
  expect(proc.exitCode).toBeNull();
  releaseFakeRun(state, "s5");
  expect((await finish(proc)).code).toBe(0);
});

test("hold gives up when the process that launched it dies", async () => {
  const state = tmp();
  const parentScript = `
    const child = Bun.spawn([${JSON.stringify(FAKE_CLAUDE)}, "-p", "--output-format", "stream-json", "--verbose", "--session-id", "s9"], {
      stdin: new TextEncoder().encode("x"),
      stdout: "ignore",
      stderr: "ignore",
      detached: true,
    });
    process.stdout.write(String(child.pid));
    while (!(await Bun.file(${JSON.stringify(join(state, "s9.calls.jsonl"))}).exists())) await Bun.sleep(20);
    process.exit(0);
  `;
  const parent = Bun.spawn(["bun", "-e", parentScript], {
    env: { ...process.env, KIBO_FAKE_CLAUDE_SCENARIO: scenarioPath("hold"), KIBO_FAKE_CLAUDE_STATE: state },
    stdout: "pipe",
  });
  const pid = Number(await new Response(parent.stdout).text());
  await parent.exited;
  const alive = () => {
    try {
      process.kill(pid, 0);
      return true;
    } catch {
      return false;
    }
  };
  const deadline = Date.now() + 3000;
  while (alive() && Date.now() < deadline) await Bun.sleep(25);
  const stillAlive = alive();
  if (stillAlive) process.kill(pid, "SIGKILL");
  expect(pid).toBeGreaterThan(0);
  expect(stillAlive).toBe(false);
});

test("a hook exiting with 2 on PreToolUse denies the tool", async () => {
  const state = tmp();
  const command = `if grep -q '"tool_name":"Bash"'; then exit 2; fi`;
  const guardSettings = JSON.stringify({
    hooks: { PreToolUse: [{ matcher: "Bash", hooks: [{ type: "command", command }] }] },
  });
  const env = { KIBO_FAKE_CLAUDE_SCENARIO: scenarioPath("guard"), KIBO_FAKE_CLAUDE_STATE: state };
  const run = await finish(start(["--session-id", "s7", "--settings", guardSettings], env));
  expect(run.lines.at(-1)).toMatchObject({ permission_denials: [{ tool_name: "Bash" }] });
});

test("resuming an unknown session fails like Claude Code", async () => {
  const env = { KIBO_FAKE_CLAUDE_SCENARIO: scenarioPath("done"), KIBO_FAKE_CLAUDE_STATE: tmp() };
  const run = await finish(start(["--resume", "missing"], env));
  expect(run.code).toBe(1);
  expect(run.err).toContain("No conversation found with session ID: missing");
  expect(run.lines).toEqual([]);
});

test("stream-json output requires --verbose", async () => {
  const env = {
    ...process.env,
    KIBO_FAKE_CLAUDE_SCENARIO: scenarioPath("done"),
    KIBO_FAKE_CLAUDE_STATE: tmp(),
  };
  const proc = Bun.spawn([FAKE_CLAUDE, "-p", "--output-format", "stream-json", "--session-id", "s8"], {
    env,
    stdin: new TextEncoder().encode("x"),
    stderr: "pipe",
  });
  expect(await proc.exited).toBe(1);
  expect(await new Response(proc.stderr).text()).toContain("requires --verbose");
});

test("a routing file picks the scenario from the prompt and keeps it on resume", async () => {
  const state = tmp();
  const env = { KIBO_FAKE_CLAUDE_SCENARIO: scenarioPath("routes"), KIBO_FAKE_CLAUDE_STATE: state };
  const asking = await finish(start(["--session-id", "s1"], env, "# KIB-14 · Récepteur de hooks"));
  expect(asking.lines.at(-1)).toMatchObject({ result: "J'attends ta réponse." });
  const resumed = await finish(start(["--resume", "s1"], env, "Port dynamique"));
  expect(resumed.lines.at(-1)).toMatchObject({ result: "Port dynamique appliqué." });
  const held = start(["--session-id", "s2"], env, "# KIB-12 · Schéma Loro");
  releaseFakeRun(state, "s2");
  expect((await finish(held)).lines.at(-1)).toMatchObject({ result: "Tests verts." });
});

const mcpScenario = (state: string) => {
  const file = join(state, "mcp.json");
  const step = { mcp: "list_tickets", input: { status: "done" } };
  writeFileSync(file, JSON.stringify({ turns: [{ steps: [step], result: "Lu." }] }));
  return file;
};

test("an mcp step launches the configured kibo server and calls the daemon through it", async () => {
  const state = tmp();
  const hooks = join(state, "hooks.jsonl");
  const seen: Array<{ path: string; auth: string | null; body: unknown }> = [];
  const daemon = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    async fetch(req) {
      seen.push({
        path: new URL(req.url).pathname,
        auth: req.headers.get("authorization"),
        body: await req.json(),
      });
      return Response.json({ ok: true, text: "[]" });
    },
  });
  try {
    const token = "c".repeat(64);
    const kibo = {
      command: "bun",
      args: [join(import.meta.dir, "kibo-hook.ts"), "mcp"],
      env: { KIBO_MCP_URL: `http://127.0.0.1:${daemon.port}/agent-mcp/r1`, KIBO_RUN_TOKEN: token },
    };
    const env = {
      KIBO_FAKE_CLAUDE_SCENARIO: mcpScenario(state),
      KIBO_FAKE_CLAUDE_STATE: state,
      KIBO_MCP_URL: "http://127.0.0.1:1/agent-mcp/inherited",
    };
    const args = ["--session-id", "m1", "--settings", settings(hooks), "--mcp-config"];
    const run = await finish(start([...args, JSON.stringify({ mcpServers: { kibo } })], env));
    expect(run.code).toBe(0);
    expect(run.lines.at(-1)).toMatchObject({ is_error: false, result: "Lu." });
    expect(seen).toEqual([
      {
        path: "/agent-mcp/r1",
        auth: `Bearer ${token}`,
        body: { tool: "list_tickets", input: { status: "done" } },
      },
    ]);
    const tools = readHooks(hooks).filter((h) => String(h.hook_event_name).endsWith("ToolUse"));
    expect(tools.map((h) => [h.hook_event_name, h.tool_name, h.tool_input])).toEqual([
      ["PreToolUse", "mcp__kibo__list_tickets", { status: "done" }],
      ["PostToolUse", "mcp__kibo__list_tickets", { status: "done" }],
    ]);
    expect(fakeCalls(state, "m1")[0]?.mcp).toEqual([{ tool: "list_tickets", text: "[]", isError: false }]);
  } finally {
    daemon.stop(true);
  }
});

test("an mcp step denied by a hook never reaches the server", async () => {
  const state = tmp();
  const deny = JSON.stringify({
    hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision: "deny" },
  });
  const guard = JSON.stringify({
    hooks: { PreToolUse: [{ matcher: "*", hooks: [{ type: "command", command: `echo '${deny}'` }] }] },
  });
  const kibo = { command: "bun", args: ["-e", "process.exit(9)"] };
  const env = { KIBO_FAKE_CLAUDE_SCENARIO: mcpScenario(state), KIBO_FAKE_CLAUDE_STATE: state };
  const config = JSON.stringify({ mcpServers: { kibo } });
  const run = await finish(start(["--session-id", "m3", "--settings", guard, "--mcp-config", config], env));
  expect(run.lines.at(-1)).toMatchObject({ permission_denials: [{ tool_name: "mcp__kibo__list_tickets" }] });
  expect(fakeCalls(state, "m3")[0]?.mcp).toEqual([]);
});

test("an mcp step without --mcp-config fails the turn loudly", async () => {
  const state = tmp();
  const env = { KIBO_FAKE_CLAUDE_SCENARIO: mcpScenario(state), KIBO_FAKE_CLAUDE_STATE: state };
  const run = await finish(start(["--session-id", "m2"], env));
  expect(run.code).toBe(1);
  expect(run.lines.at(-1)).toMatchObject({ type: "result", is_error: true, result: "no --mcp-config" });
});
