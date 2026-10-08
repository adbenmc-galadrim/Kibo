import { describe, expect, test } from "bun:test";
import {
  AgentProfile,
  ConfigCommand,
  DEFAULT_RULES,
  estimateTokens,
  Guideline,
  GuidelinePath,
  HookInput,
  HookPost,
  PermissionMode,
  ProfileInput,
  RpcRequest,
  Rule,
  RunEvent,
  runSubject,
  WorkspacePatch,
} from "./index";

const profile = {
  id: "p1",
  name: "opus-dev",
  model: "opus",
  execution: "cli",
  permissionMode: "acceptEdits",
  workspace: "worktree",
  maxParallel: 2,
  subagents: ["sonnet", "haiku"],
};

describe("agent profile", () => {
  test("accepts the four safe permission modes only", () => {
    for (const mode of ["default", "acceptEdits", "plan", "auto"]) {
      expect(AgentProfile.safeParse({ ...profile, permissionMode: mode }).success).toBe(true);
    }
    for (const mode of ["bypassPermissions", "dontAsk", "manual"]) {
      expect(AgentProfile.safeParse({ ...profile, permissionMode: mode }).success).toBe(false);
    }
  });
  test("names are short lowercase slugs", () => {
    expect(AgentProfile.safeParse({ ...profile, name: "Opus Dev" }).success).toBe(false);
    expect(AgentProfile.safeParse({ ...profile, name: "-dev" }).success).toBe(false);
    expect(AgentProfile.safeParse({ ...profile, maxParallel: 0 }).success).toBe(false);
  });
  test("a bypass profile cannot even be sent as a command", () => {
    const cmd = { method: "createProfile", profile: { ...profile, permissionMode: "bypassPermissions" } };
    expect(ConfigCommand.safeParse(cmd).success).toBe(false);
  });
});

describe("guidelines", () => {
  test("paths are relative markdown files without traversal", () => {
    for (const ok of ["guidelines/core.md", "skills/loro-patterns.md", "front.md"]) {
      expect(GuidelinePath.safeParse(ok).success).toBe(true);
    }
    for (const ko of ["../etc.md", "/abs.md", "a/../b.md", "notes.txt", "CLAUDE.md", "a//b.md"]) {
      expect(GuidelinePath.safeParse(ko).success).toBe(false);
    }
  });
  test("the owner says where a guideline applies", () => {
    const g = {
      id: "g1",
      owner: { scope: "domain", domainId: "core" },
      path: "guidelines/core.md",
      content: "# Core",
    };
    expect(Guideline.safeParse(g).success).toBe(true);
    expect(Guideline.safeParse({ ...g, owner: { scope: "domain" } }).success).toBe(false);
  });
  test("tokens are estimated from characters", () => {
    expect(estimateTokens("")).toBe(0);
    expect(estimateTokens("abcde")).toBe(2);
  });
});

describe("rules", () => {
  test("default rules are valid and a rule never sets Blocked", () => {
    expect(Rule.array().safeParse(DEFAULT_RULES).success).toBe(true);
    const bad = { id: "x", enabled: true, when: "run_done", from: ["todo"], to: "blocked" };
    expect(Rule.safeParse(bad).success).toBe(false);
  });
});

describe("runs and hooks", () => {
  test("hook inputs accept the null fields Claude Code sends", () => {
    const input = {
      session_id: "s1",
      transcript_path: "/t.jsonl",
      cwd: "/w",
      hook_event_name: "PreToolUse",
      tool_name: "Write",
      tool_input: { file_path: "a.ts" },
      agent_id: null,
      agent_type: null,
    };
    expect(HookInput.safeParse(input).success).toBe(true);
    expect(HookInput.safeParse({ ...input, hook_event_name: "Unknown" }).success).toBe(false);
  });
  test("a hook post carries the tool input as an optional record", () => {
    const payload = {
      event: "PreToolUse",
      sessionId: "s1",
      transcriptPath: null,
      tool: "Bash",
      detail: "bun test",
      question: null,
      agentId: null,
    };
    expect(HookPost.safeParse({ payload, toolInput: { command: "bun test" } }).success).toBe(true);
    expect(HookPost.safeParse({ payload, toolInput: null }).success).toBe(true);
    expect(HookPost.safeParse({ payload, toolInput: "bun test" }).success).toBe(false);
  });
  test("a run without ticket is described by its title", () => {
    expect(runSubject({ ticketKey: "KIB-14", ticketTitle: "Hooks" })).toBe("KIB-14 · Hooks");
    expect(runSubject({ ticketKey: "KIB-14", ticketTitle: "Hooks" }, "12m")).toBe("KIB-14 · 12m");
    expect(runSubject({ ticketKey: null, ticketTitle: "Générer un composant" })).toBe("Générer un composant");
  });
  test("an answer is never empty", () => {
    expect(RunEvent.safeParse({ type: "answered", text: "  ", rank: 0 }).success).toBe(false);
    expect(RunEvent.safeParse({ type: "answered", text: "4747", rank: 0 }).success).toBe(true);
  });
  test("a session event is either resumed from a run or fresh for a known reason", () => {
    expect(RunEvent.parse({ type: "session", mode: "resumed", from: "r1" })).toEqual({
      type: "session",
      mode: "resumed",
      from: "r1",
    });
    expect(RunEvent.safeParse({ type: "session", mode: "fresh", reason: "user_reset" }).success).toBe(true);
    expect(RunEvent.safeParse({ type: "session", mode: "fresh", reason: "because" }).success).toBe(false);
    expect(RunEvent.safeParse({ type: "session", mode: "resumed" }).success).toBe(false);
    const spawned = { type: "spawned" as const, pid: 1, resume: false, workspace: "w", guidelines: 0 };
    expect(RunEvent.parse(spawned)).toEqual(spawned);
    expect(RunEvent.parse({ ...spawned, sessionId: "s2" })).toEqual({ ...spawned, sessionId: "s2" });
  });
  test("assignAgent starts from the main session unless asked to start fresh", () => {
    const assign = { method: "assignAgent", projectId: "p", ticketId: "1@1", profileId: "p1", brief: "" };
    expect(RpcRequest.parse(assign)).toMatchObject({ fresh: false });
    expect(RpcRequest.parse({ ...assign, fresh: true })).toMatchObject({ fresh: true });
  });
  test("agent rpc requests are validated", () => {
    const assign = { method: "assignAgent", projectId: "p", ticketId: "1@1", profileId: "p1", brief: "" };
    expect(RpcRequest.safeParse(assign).success).toBe(true);
    expect(RpcRequest.safeParse({ method: "answerRun", runId: "r", text: "" }).success).toBe(false);
    expect(RpcRequest.safeParse({ method: "setHost", patch: { cpuThreshold: 5 } }).success).toBe(false);
    expect(RpcRequest.safeParse({ method: "moveRun", runId: "r", index: -1 }).success).toBe(false);
  });
});

test("a workspace patch needs a field; the description is bounded and can be cleared", () => {
  expect(WorkspacePatch.safeParse({}).success).toBe(false);
  expect(WorkspacePatch.safeParse({ description: null }).success).toBe(true);
  expect(WorkspacePatch.safeParse({ description: "x".repeat(501) }).success).toBe(false);
  expect(WorkspacePatch.safeParse({ name: "x".repeat(41) }).success).toBe(false);
  const parsed = ConfigCommand.parse({
    method: "updateWorkspace",
    patch: { name: " Maison ", description: " Mes projets " },
  });
  expect(parsed).toEqual({
    method: "updateWorkspace",
    patch: { name: "Maison", description: "Mes projets" },
  });
});

test("profiles accept auto and default allow to an empty list", () => {
  const p = ProfileInput.parse({
    name: "x",
    model: "opus",
    execution: "cli",
    permissionMode: "auto",
    workspace: "worktree",
    maxParallel: 2,
    subagents: [],
  });
  expect(p.allow).toEqual([]);
  expect(ProfileInput.safeParse({ ...p, allow: ["Bash"] }).success).toBe(false);
  expect(PermissionMode.safeParse("bypassPermissions").success).toBe(false);
});
