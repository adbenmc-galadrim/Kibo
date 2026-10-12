import { describe, expect, test } from "bun:test";
import {
  AGENT_TEMPLATES,
  AgentCreateInput,
  AgentFrontmatter,
  AgentRef,
  AgentSettings,
  AgentSettingsPatch,
  agentRef,
  ConfigCommand,
  DEFAULT_AGENT_SETTINGS,
  DEFAULT_RULES,
  estimateTokens,
  Guideline,
  GuidelinePath,
  HookInput,
  HookPost,
  isReservedAgentName,
  PermissionMode,
  parseAgentRef,
  RpcRequest,
  Rule,
  RunEvent,
  runSubject,
  systemAgentName,
  systemAgentRef,
  systemAgentSettings,
  systemIdOfName,
  WorkspacePatch,
} from "./index";

const UUID = "0d3c7a8e-2b1f-4c5d-9e6a-7b8c9d0e1f2a";

describe("agent refs", () => {
  test("accept the three scopes and refuse anything else", () => {
    for (const ok of ["global:review-pr", `project:${UUID}:review-pr`, "system:demo"]) {
      expect(AgentRef.safeParse(ok).success).toBe(true);
    }
    for (const ko of ["global:Review", "system:dev", "project:x:review"]) {
      expect(AgentRef.safeParse(ko).success).toBe(false);
    }
  });
  test("parse back into their parts", () => {
    expect(parseAgentRef("global:review-pr")).toEqual({ scope: "global", name: "review-pr" });
    expect(parseAgentRef(`project:${UUID}:review-pr`)).toEqual({
      scope: "project",
      projectId: UUID,
      name: "review-pr",
    });
    expect(parseAgentRef("system:project-agent")).toEqual({ scope: "system", id: "project-agent" });
  });
  test("are built from a scope, a project and a name", () => {
    expect(agentRef("project", UUID, "a")).toBe(`project:${UUID}:a`);
    expect(agentRef("global", null, "a")).toBe("global:a");
    expect(systemAgentRef("project-agent")).toBe("system:project-agent");
    expect(systemAgentName("generateur")).toBe("kibo-generateur");
  });
  test("the names of the Kibo agents are reserved, other kibo- names are not", () => {
    expect(isReservedAgentName("kibo-demo")).toBe(true);
    expect(isReservedAgentName("kibo-dev")).toBe(false);
    expect(systemIdOfName("kibo-project-agent")).toBe("project-agent");
    expect(systemIdOfName("kibo-dev")).toBeNull();
  });
});

describe("agent settings", () => {
  test("default to a worktree, all skills and the generic subagents", () => {
    expect(AgentSettings.parse({})).toEqual({
      workspace: "worktree",
      permissionMode: "default",
      allow: [],
      maxParallel: 1,
      enabled: true,
      subagents: [],
      genericSubagents: true,
      skills: { mode: "all" },
    });
    expect(DEFAULT_AGENT_SETTINGS).toEqual(AgentSettings.parse({}));
  });
  test("bound the subagents and the allowed skills", () => {
    const refs = Array.from({ length: 21 }, (_, i) => `global:a${i}`);
    expect(AgentSettings.safeParse({ subagents: refs }).success).toBe(false);
    expect(AgentSettings.safeParse({ skills: { mode: "list", ids: ["a:b", "c"] } }).success).toBe(true);
    const ids = Array.from({ length: 51 }, (_, i) => `s${i}`);
    expect(AgentSettings.safeParse({ skills: { mode: "list", ids } }).success).toBe(false);
  });
  test("accept the four safe permission modes only", () => {
    for (const mode of ["default", "acceptEdits", "plan", "auto"]) {
      expect(AgentSettings.safeParse({ permissionMode: mode }).success).toBe(true);
    }
    for (const mode of ["bypassPermissions", "dontAsk", "manual"]) {
      expect(AgentSettings.safeParse({ permissionMode: mode }).success).toBe(false);
    }
    expect(AgentSettings.safeParse({ maxParallel: 0 }).success).toBe(false);
    expect(AgentSettings.safeParse({ allow: ["Bash"] }).success).toBe(false);
  });
  test("a patch is strict", () => {
    expect(AgentSettingsPatch.safeParse({ enabled: false }).success).toBe(true);
    expect(AgentSettingsPatch.safeParse({ model: "opus" }).success).toBe(false);
  });
  test("the Kibo agents keep their fixed settings", () => {
    expect(systemAgentSettings("demo", { maxParallel: 3 }).maxParallel).toBe(1);
    const generator = systemAgentSettings("generateur", { maxParallel: 9 });
    expect(generator.maxParallel).toBe(4);
    expect(generator.skills).toEqual({ mode: "list", ids: [] });
    expect(generator.genericSubagents).toBe(false);
    expect(generator.subagents).toEqual([]);
    expect(generator.workspace).toBe("isolated");
    expect(generator.permissionMode).toBe("acceptEdits");
    expect(systemAgentSettings("assistant", { enabled: false, permissionMode: "auto" })).toMatchObject({
      enabled: false,
      permissionMode: "default",
    });
  });
});

describe("agent files", () => {
  test("the model is an alias or a full name in lower case", () => {
    expect(
      AgentFrontmatter.safeParse({ name: "a", description: "d", model: "claude-opus-4-1" }).success,
    ).toBe(true);
    expect(AgentFrontmatter.safeParse({ name: "a", description: "d", model: "Opus" }).success).toBe(false);
    expect(AgentFrontmatter.parse({ name: "a", description: "d" })).toMatchObject({
      extra: "",
      extraKeys: [],
    });
  });
  test("creation leaves the project check to the service", () => {
    expect(AgentCreateInput.parse({ scope: "project", name: "x", description: "d" }).template).toBe("blank");
    expect(AGENT_TEMPLATES).toContain("conductor");
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
    const assign = {
      method: "assignAgent",
      projectId: "p",
      ticketId: "1@1",
      profileId: "global:p1",
      brief: "",
    };
    expect(RpcRequest.parse(assign)).toMatchObject({ fresh: false });
    expect(RpcRequest.parse({ ...assign, fresh: true })).toMatchObject({ fresh: true });
  });
  test("agent rpc requests are validated", () => {
    const assign = {
      method: "assignAgent",
      projectId: "p",
      ticketId: "1@1",
      profileId: "global:p1",
      brief: "",
    };
    expect(RpcRequest.safeParse(assign).success).toBe(true);
    expect(RpcRequest.safeParse({ ...assign, profileId: "p1" }).success).toBe(false);
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

test("the profile commands are gone and the profile guidelines with them", () => {
  expect(ConfigCommand.safeParse({ method: "createProfile", profile: {} }).success).toBe(false);
  const g = { id: "g", owner: { scope: "profile", profileId: "p" }, path: "a.md", content: "" };
  expect(Guideline.safeParse(g).success).toBe(false);
  expect(PermissionMode.safeParse("bypassPermissions").success).toBe(false);
});
