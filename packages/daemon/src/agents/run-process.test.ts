import { afterEach, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, realpathSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { childEnv, cleanEnv } from "./child-env";
import { NO_AGENT_FLAGS } from "./cli-flags";
import { FAKE_CLAUDE, fakeCalls, releaseFakeRun, scenarioPath } from "./fake-claude-scenario";
import { killGroup, launch, parseResultLine, reapOrphan, resolveClaudeBin } from "./run-process";

const dirs: string[] = [];
const tmp = () => {
  const d = realpathSync(mkdtempSync(join(tmpdir(), "kibo-runner-")));
  dirs.push(d);
  return d;
};
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

test("the tool set of the run reaches the child environment and cannot be forged", () => {
  const extra = { hookUrl: "u", token: "t", mcpUrl: "http://h/agent-mcp/r1" };
  expect(childEnv({}, { ...extra, mcpTools: "ticket" }).KIBO_MCP_TOOLS).toBe("ticket");
  expect(childEnv({}, { ...extra, mcpTools: "project" }).KIBO_MCP_TOOLS).toBe("project");
  expect(
    childEnv({ KIBO_MCP_TOOLS: "project" }, { ...extra, mcpTools: null, env: { KIBO_MCP_TOOLS: "project" } }),
  ).not.toHaveProperty("KIBO_MCP_TOOLS");
  expect(cleanEnv({ KIBO_MCP_TOOLS: "ticket", HOME: "/h" })).toEqual({ HOME: "/h" });
});

test("the MCP URL reaches the child environment only for a project run", () => {
  const extra = { hookUrl: "u", token: "t" };
  expect(childEnv({ PATH: "/bin", KIBO_MCP_URL: "stale" }, { ...extra, mcpUrl: null })).toEqual({
    PATH: "/bin",
    KIBO_HOOK_URL: "u",
    KIBO_RUN_TOKEN: "t",
  });
  expect(childEnv({ PATH: "/bin" }, { ...extra, mcpUrl: "http://h/agent-mcp/r1" }).KIBO_MCP_URL).toBe(
    "http://h/agent-mcp/r1",
  );
  expect(
    childEnv({}, { ...extra, mcpUrl: null, env: { KIBO_MCP_URL: "forged" } }).KIBO_MCP_URL,
  ).toBeUndefined();
  expect(cleanEnv({ KIBO_MCP_URL: "x", HOME: "/h" })).toEqual({ HOME: "/h" });
});

test("the child environment drops Claude session variables and adds the run's", () => {
  const env = childEnv(
    {
      PATH: "/bin",
      HOME: "/h",
      CLAUDECODE: "1",
      CLAUDE_CODE_SESSION_ID: "x",
      CLAUDE_EFFORT: "high",
      CLAUDE_CONFIG_DIR: "/cfg",
      KIBO_RUN_TOKEN: "old",
      EMPTY: undefined,
    },
    { hookUrl: "http://127.0.0.1:1/hooks/r1", token: "t".repeat(64) },
  );
  expect(env).toEqual({
    PATH: "/bin",
    HOME: "/h",
    CLAUDE_CONFIG_DIR: "/cfg",
    KIBO_HOOK_URL: "http://127.0.0.1:1/hooks/r1",
    KIBO_RUN_TOKEN: "t".repeat(64),
  });
  const guarded = childEnv(
    { PATH: "/bin" },
    { hookUrl: "u", token: "t", env: { NO_COLOR: "1", KIBO_RUN_TOKEN: "forged", KIBO_HOOK_URL: "forged" } },
  );
  expect(guarded).toEqual({ PATH: "/bin", NO_COLOR: "1", KIBO_HOOK_URL: "u", KIBO_RUN_TOKEN: "t" });
});

test("only a well-formed result line is read", () => {
  expect(parseResultLine('{"type":"system","subtype":"init"}')).toBeNull();
  expect(parseResultLine("garbage")).toBeNull();
  const line = JSON.stringify({
    type: "result",
    is_error: false,
    result: "ok",
    total_cost_usd: 0.5,
    usage: { input_tokens: 10, output_tokens: 20, cache_read_input_tokens: 5 },
    permission_denials: [{ tool_name: "Write" }, { tool_name: "Bash" }],
  });
  expect(parseResultLine(line)).toEqual({
    isError: false,
    result: "ok",
    tokens: 35,
    costUsd: 0.5,
    denied: ["Write", "Bash"],
    raw: line,
  });
});

test("a denied Task, the historical name of the Agent tool, is told as Agent", () => {
  const line = JSON.stringify({
    type: "result",
    is_error: false,
    permission_denials: [{ tool_name: "Task" }, { tool_name: "Agent" }, { tool_name: "Bash" }],
  });
  expect(parseResultLine(line)?.denied).toEqual(["Agent", "Agent", "Bash"]);
});

function fakeLaunch(scenario: "done" | "fail" | "hold", sessionId: string) {
  const state = tmp();
  const hooks = join(state, "hooks.jsonl");
  const proc = launch({
    model: "opus",
    permissionFlag: "manual",
    extraArgs: [],
    systemPromptFile: "/r/CLAUDE.md",
    allow: [],
    deny: [],
    mcpConfigFile: null,
    mcpTools: null,
    claudeBin: FAKE_CLAUDE,
    cwd: state,
    sessionId,
    resume: false,
    prompt: "# KIB-1 · Brief",
    hook: { command: "sh", args: ["-c", `cat >> ${hooks}; echo >> ${hooks}`, "sh"] },
    hookUrl: "http://127.0.0.1:1/hooks/r1",
    token: "t".repeat(64),
    mcpUrl: null,
    baseEnv: {
      ...process.env,
      KIBO_FAKE_CLAUDE_SCENARIO: scenarioPath(scenario),
      KIBO_FAKE_CLAUDE_STATE: state,
    },
    extraEnv: {},
    agentFlags: NO_AGENT_FLAGS,
  });
  return { proc, state, hooks };
}

test("launches claude with the prompt on stdin and reads its result", async () => {
  const { proc, state, hooks } = fakeLaunch("done", "s-done");
  expect(proc.pid).toBeGreaterThan(0);
  expect(await proc.exited).toEqual({
    code: 0,
    result: {
      isError: false,
      result: "Travail terminé.",
      tokens: 1200,
      costUsd: 0.0012,
      denied: [],
      raw: expect.stringContaining('"type":"result"'),
    },
    stderrTail: "",
  });
  const [call] = fakeCalls(state, "s-done");
  expect(call).toMatchObject({
    prompt: "# KIB-1 · Brief",
    hasToken: true,
    hookUrl: "http://127.0.0.1:1/hooks/r1",
    cwd: state,
  });
  expect(readFileSync(hooks, "utf8")).toContain('"hook_event_name":"SessionStart"');
});

test("a failing run reports its exit code, error result and stderr", async () => {
  const outcome = await fakeLaunch("fail", "s-fail").proc.exited;
  expect(outcome.code).toBe(1);
  expect(outcome.result?.isError).toBe(true);
  expect(outcome.stderrTail).toContain("boom");
});

test("an orphan is killed only when its command line carries the run's session", async () => {
  const orphan = Bun.spawn(["sh", "-c", "sleep 30; true", "reap-s9"], { detached: true, stdout: "ignore" });
  await Bun.sleep(100);
  expect(reapOrphan(orphan.pid, "another-session")).toBe(false);
  expect(orphan.exitCode).toBeNull();
  expect(reapOrphan(orphan.pid, "reap-s9")).toBe(true);
  expect(await orphan.exited).not.toBe(0);
  expect(reapOrphan(999_999_999, "reap-s9", () => null)).toBe(false);
});

test("kill stops a running process", async () => {
  const { proc, state } = fakeLaunch("hold", "s-hold");
  while (fakeCalls(state, "s-hold").length === 0) await Bun.sleep(20);
  proc.kill();
  const outcome = await proc.exited;
  expect(outcome.code).not.toBe(0);
  expect(outcome.result).toBeNull();
  releaseFakeRun(state, "s-hold");
});

test("a process group that ignores SIGTERM is killed after the grace delay", async () => {
  const stubborn = Bun.spawn(
    [
      process.execPath,
      "-e",
      "process.on('SIGTERM', () => {}); console.log('ready'); setInterval(() => {}, 1000);",
    ],
    { detached: true, stdout: "pipe" },
  );
  const reader = stubborn.stdout.getReader();
  await reader.read();
  reader.releaseLock();
  killGroup(stubborn.pid, 200);
  await Bun.sleep(100);
  expect(stubborn.exitCode).toBeNull();
  await stubborn.exited;
  expect(stubborn.signalCode).toBe("SIGKILL");
});

const claudeInCommonPlaces = Bun.which("claude", { PATH: "/opt/homebrew/bin:/usr/local/bin" }) !== null;

test.skipIf(claudeInCommonPlaces)(
  "the claude binary is found in PATH or common places, never guessed",
  () => {
    expect(resolveClaudeBin("/opt/claude")).toBe("/opt/claude");
    expect(() => resolveClaudeBin(null, { PATH: "" }, tmp())).toThrow("AGENT_CLI_NOT_FOUND");
  },
);
