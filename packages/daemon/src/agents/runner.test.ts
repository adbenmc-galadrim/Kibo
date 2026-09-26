import { afterEach, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, realpathSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ASK_TOOL, HookEventName } from "@kibo/schema";
import { FAKE_CLAUDE, fakeCalls, releaseFakeRun, scenarioPath } from "./fake-claude-scenario";
import {
  childEnv,
  claudeArgs,
  claudeSettings,
  type LaunchInput,
  launch,
  parseHelp,
  parseResultLine,
  permissionFlag,
  readCliCaps,
  reapOrphan,
  resolveClaudeBin,
} from "./runner";

const dirs: string[] = [];
const tmp = () => {
  const d = realpathSync(mkdtempSync(join(tmpdir(), "kibo-runner-")));
  dirs.push(d);
  return d;
};
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

const kiboHook = { command: "/k/kibo-hook", args: [] };
const base: Pick<LaunchInput, "model" | "permissionFlag" | "extraArgs" | "systemPromptFile" | "hook"> = {
  model: "opus",
  permissionFlag: "manual",
  extraArgs: [],
  systemPromptFile: "/r/CLAUDE.md",
  hook: kiboHook,
};

test("the command line never bypasses permissions and pins the session", () => {
  const args = claudeArgs({ ...base, sessionId: "s1", resume: false });
  expect(args.join(" ")).not.toMatch(/dangerously|bypass/);
  expect(args.slice(0, 4)).toEqual(["-p", "--output-format", "stream-json", "--verbose"]);
  const flag = (name: string) => args[args.indexOf(name) + 1];
  expect(flag("--permission-mode")).toBe("manual");
  expect(flag("--permission-prompts")).toBe("none");
  expect(flag("--model")).toBe("opus");
  expect(flag("--append-system-prompt-file")).toBe("/r/CLAUDE.md");
  expect(flag("--session-id")).toBe("s1");
  expect(args).not.toContain("--resume");
  const resumed = claudeArgs({ ...base, sessionId: "s1", resume: true });
  expect(resumed[resumed.indexOf("--resume") + 1]).toBe("s1");
  expect(resumed).not.toContain("--session-id");
  expect(JSON.parse(flag("--mcp-config") ?? "")).toEqual({
    mcpServers: { kibo: { command: "/k/kibo-hook", args: ["mcp"] } },
  });
  const extra = claudeArgs({
    ...base,
    permissionFlag: null,
    extraArgs: ["--tools", ""],
    sessionId: "s1",
    resume: false,
  });
  expect(extra).not.toContain("--permission-mode");
  expect(extra.slice(-4)).toEqual(["--tools", "", "--session-id", "s1"]);
  for (const forbidden of [
    ["--dangerously-skip-permissions"],
    ["--permission-mode", "bypassPermissions"],
    ["--settings", "{}"],
  ]) {
    expect(() => claudeArgs({ ...base, extraArgs: forbidden, sessionId: "s1", resume: false })).toThrow(
      "INVALID_INPUT",
    );
  }
});

test("the permission mode follows what the installed CLI accepts", () => {
  const help = [
    '  --output-format <format>   (choices: "text", "json", "stream-json")',
    "  --permission-mode <mode>   Permission mode to use for the session",
    '                             (choices: "acceptEdits", "auto",',
    '                             "bypassPermissions", "manual", "dontAsk", "plan")',
  ].join("\n");
  const caps = parseHelp(help);
  expect(caps.permissionModes).toEqual([
    "acceptEdits",
    "auto",
    "bypassPermissions",
    "manual",
    "dontAsk",
    "plan",
  ]);
  expect(permissionFlag("default", caps)).toBe("manual");
  expect(permissionFlag("plan", caps)).toBe("plan");
  expect(permissionFlag("default", { permissionModes: ["default", "plan", "acceptEdits"] })).toBe("default");
  expect(permissionFlag("default", parseHelp("no options here"))).toBeNull();
  expect(permissionFlag("acceptEdits", parseHelp(""))).toBe("acceptEdits");
});

test("the CLI capabilities are read from claude --help", async () => {
  expect((await readCliCaps(FAKE_CLAUDE, { PATH: process.env.PATH ?? "" })).permissionModes).toContain(
    "manual",
  );
});

test("settings send every hook event to kibo-hook and allow only the ask tool", () => {
  const settings = JSON.parse(claudeSettings(kiboHook));
  for (const event of HookEventName.options) {
    const [group] = settings.hooks[event];
    expect(group.hooks).toEqual([{ type: "command", command: "'/k/kibo-hook' 'event'", timeout: 10 }]);
    expect(group.matcher).toBe(event.endsWith("ToolUse") ? "*" : undefined);
  }
  expect(settings.permissions).toEqual({ allow: [ASK_TOOL] });
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

function fakeLaunch(scenario: "done" | "fail" | "hold", sessionId: string) {
  const state = tmp();
  const hooks = join(state, "hooks.jsonl");
  const proc = launch({
    ...base,
    claudeBin: FAKE_CLAUDE,
    cwd: state,
    sessionId,
    resume: false,
    prompt: "# KIB-1 · Brief",
    hook: { command: "sh", args: ["-c", `cat >> ${hooks}; echo >> ${hooks}`, "sh"] },
    hookUrl: "http://127.0.0.1:1/hooks/r1",
    token: "t".repeat(64),
    baseEnv: {
      ...process.env,
      KIBO_FAKE_CLAUDE_SCENARIO: scenarioPath(scenario),
      KIBO_FAKE_CLAUDE_STATE: state,
    },
    extraEnv: {},
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

const claudeInCommonPlaces = Bun.which("claude", { PATH: "/opt/homebrew/bin:/usr/local/bin" }) !== null;

test.skipIf(claudeInCommonPlaces)(
  "the claude binary is found in PATH or common places, never guessed",
  () => {
    expect(resolveClaudeBin("/opt/claude")).toBe("/opt/claude");
    expect(() => resolveClaudeBin(null, { PATH: "" }, tmp())).toThrow("AGENT_CLI_NOT_FOUND");
  },
);
