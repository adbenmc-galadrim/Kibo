import { expect, test } from "bun:test";
import {
  ALLOW_MAX,
  ASK_QUESTION_TOOL,
  ASK_TOOL,
  HookEventName,
  KiboError,
  PROGRESS_TOOL,
  PROJECT_AGENT_DENY,
  PROJECT_AGENT_MCP_TOOLS,
  PROJECT_AGENT_READ_TOOLS,
  SIGNAL_TOOL,
  TICKET_MCP_TOOLS,
} from "@kibo/schema";
import { claudeArgs, claudeSettings, parseHelp, permissionFlag, readCliCaps } from "./claude-args";
import { FAKE_CLAUDE } from "./fake-claude-scenario";
import type { LaunchInput } from "./run-process";

const kiboHook = { command: "/k/kibo-hook", args: [] };
const base: Pick<
  LaunchInput,
  | "model"
  | "permissionFlag"
  | "extraArgs"
  | "systemPromptFile"
  | "hook"
  | "allow"
  | "deny"
  | "mcpConfigFile"
  | "mcpTools"
  | "addDirs"
> = {
  model: "opus",
  permissionFlag: "manual",
  extraArgs: [],
  systemPromptFile: "/r/CLAUDE.md",
  hook: kiboHook,
  allow: [],
  deny: [],
  mcpConfigFile: null,
  mcpTools: null,
  addDirs: [],
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

test("a project run passes its private MCP config file and its deny rules", () => {
  const args = claudeArgs({
    ...base,
    allow: [...PROJECT_AGENT_MCP_TOOLS, ...PROJECT_AGENT_READ_TOOLS],
    deny: PROJECT_AGENT_DENY,
    mcpConfigFile: "/r/mcp.json",
    sessionId: "s1",
    resume: false,
  });
  expect(args[args.indexOf("--mcp-config") + 1]).toBe("/r/mcp.json");
  const settings = JSON.parse(args[args.indexOf("--settings") + 1] ?? "");
  expect(settings.permissions).toEqual({
    allow: [ASK_TOOL, ASK_QUESTION_TOOL, ...PROJECT_AGENT_MCP_TOOLS, ...PROJECT_AGENT_READ_TOOLS],
    deny: [...PROJECT_AGENT_DENY],
  });
  expect(args.join(" ")).not.toContain("KIBO_RUN_TOKEN");
});

test("a ticket run allows ticket_progress right after the ask tools; no profile can grant it elsewhere", () => {
  const args = claudeArgs({
    ...base,
    allow: ["Edit", PROGRESS_TOOL],
    mcpTools: "ticket",
    mcpConfigFile: "/r/mcp.json",
    sessionId: "s1",
    resume: false,
  });
  const settings = JSON.parse(args[args.indexOf("--settings") + 1] ?? "");
  expect(settings.permissions.allow).toEqual([...TICKET_MCP_TOOLS, "Edit"]);
  expect(settings.permissions.allow).toContain("mcp__kibo__signal_project");
  expect(JSON.parse(claudeSettings(kiboHook, [SIGNAL_TOOL, "Edit"])).permissions.allow).toEqual([
    ASK_TOOL,
    ASK_QUESTION_TOOL,
    "Edit",
  ]);
  expect(JSON.parse(claudeSettings(kiboHook, [PROGRESS_TOOL, "Edit"])).permissions.allow).toEqual([
    ASK_TOOL,
    ASK_QUESTION_TOOL,
    "Edit",
  ]);
  expect(JSON.parse(claudeSettings(kiboHook, [PROGRESS_TOOL], [], "project")).permissions.allow).toEqual([
    ASK_TOOL,
    ASK_QUESTION_TOOL,
  ]);
});

test("settings carry deny rules only when there are some", () => {
  expect(JSON.parse(claudeSettings(kiboHook, ["Read"], [])).permissions).toEqual({
    allow: [ASK_TOOL, ASK_QUESTION_TOOL, "Read"],
  });
  expect(JSON.parse(claudeSettings(kiboHook, [], ["Bash", "Edit"])).permissions.deny).toEqual([
    "Bash",
    "Edit",
  ]);
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

test("settings send every hook event to kibo-hook and allow only the ask tools", () => {
  const settings = JSON.parse(claudeSettings(kiboHook));
  for (const event of HookEventName.options) {
    const [group] = settings.hooks[event];
    expect(group.hooks).toEqual([{ type: "command", command: "'/k/kibo-hook' 'event'", timeout: 10 }]);
    expect(group.matcher).toBe(event.endsWith("ToolUse") ? "*" : undefined);
  }
  expect(settings.permissions).toEqual({ allow: [ASK_TOOL, ASK_QUESTION_TOOL] });
});

test("settings allow the ask tools first, then the profile rules, without duplicates", () => {
  const settings = JSON.parse(
    claudeSettings(kiboHook, ["Bash(pnpm *)", ASK_QUESTION_TOOL, ASK_TOOL, "Edit"]),
  );
  expect(settings.permissions.allow).toEqual([ASK_TOOL, ASK_QUESTION_TOOL, "Bash(pnpm *)", "Edit"]);
});

test("the command line carries the profile rules in its settings", () => {
  const args = claudeArgs({ ...base, allow: ["Bash(git *)"], sessionId: "s1", resume: false });
  const settings = JSON.parse(args[args.indexOf("--settings") + 1] ?? "");
  expect(settings.permissions.allow).toEqual([ASK_TOOL, ASK_QUESTION_TOOL, "Bash(git *)"]);
});

test("unsafe rules are refused again before claude is launched", () => {
  const tooMany = Array.from({ length: ALLOW_MAX + 1 }, (_, i) => `Bash(tool${i} *)`);
  for (const allow of [
    ["Bash"],
    ["Bash(*)"],
    ["Bash( * )"],
    ["Read(dangerously)"],
    ["bash(pnpm *)"],
    tooMany,
  ]) {
    expect(() => claudeSettings(kiboHook, allow)).toThrow(KiboError);
    expect(() => claudeArgs({ ...base, allow, sessionId: "s1", resume: false })).toThrow("INVALID_INPUT");
  }
});

test("auto is passed through when the CLI lists it, refused otherwise", () => {
  expect(permissionFlag("auto", { permissionModes: ["acceptEdits", "auto", "plan"] })).toBe("auto");
  expect(() => permissionFlag("auto", { permissionModes: ["acceptEdits", "plan"] })).toThrow(KiboError);
});

test("Kibo passes the added folders in one --add-dir closed by the session flag", () => {
  const dirs = ["/Users/a/.claude/skills", "/Users/a/Documents/emis"];
  for (const resume of [false, true]) {
    const args = claudeArgs({ ...base, extraArgs: ["--tools", ""], addDirs: dirs, sessionId: "s1", resume });
    const at = args.indexOf("--add-dir");
    expect(args.slice(at)).toEqual(["--add-dir", ...dirs, resume ? "--resume" : "--session-id", "s1"]);
    expect(args.filter((a) => a === "--add-dir")).toHaveLength(1);
  }
  expect(claudeArgs({ ...base, sessionId: "s1", resume: false })).not.toContain("--add-dir");
});

test("task arguments must start with a flag, so no bare value can follow the agent flags", () => {
  const addDirs = ["/Users/a/.claude/skills"];
  for (const extraArgs of [["/Users/x/.ssh"], ["", "--tools"]]) {
    expect(() =>
      claudeArgs({ ...base, agentFlags: undefined, extraArgs, addDirs, sessionId: "s1", resume: false }),
    ).toThrow("INVALID_INPUT");
  }
});

test("a task cannot add a folder by itself", () => {
  for (const extraArgs of [["--add-dir", "/x"], ["--add-dir=/x"]]) {
    expect(() => claudeArgs({ ...base, extraArgs, sessionId: "s1", resume: false })).toThrow("INVALID_INPUT");
  }
});
