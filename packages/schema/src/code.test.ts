import { describe, expect, test } from "bun:test";
import {
  CODE_MUTATION_METHODS,
  CodeEvent,
  CodeRequest,
  eventTouches,
  GhLogin,
  LOCAL_ONLY_CODE_METHODS,
  MAX_EVENT_PATHS,
  RelPath,
} from "./code";
import { ExternalRef } from "./external-ref";
import { EMPTY_TABS, salvageTabsState, TabsState, TabTarget } from "./tabs";

describe("code contracts", () => {
  test("RelPath refuses absolute paths, parent segments and NUL", () => {
    expect(RelPath.safeParse("packages/core/src/ticket.ts").success).toBe(true);
    expect(RelPath.safeParse("/etc/passwd").success).toBe(false);
    expect(RelPath.safeParse("a/../../b").success).toBe(false);
    expect(RelPath.safeParse("a\0b").success).toBe(false);
  });

  test("GhLogin accepts logins and org/team, refuses options", () => {
    expect(GhLogin.safeParse("adam").success).toBe(true);
    expect(GhLogin.safeParse("kibo/core-team").success).toBe(true);
    expect(GhLogin.safeParse("--admin").success).toBe(false);
  });

  test("CodeRequest validates each method", () => {
    const base = { projectId: "p1", worktree: "/tmp/repo" };
    expect(CodeRequest.safeParse({ method: "status", ...base }).success).toBe(true);
    expect(
      CodeRequest.safeParse({
        method: "stageHunk",
        ...base,
        path: "a.ts",
        area: "unstaged",
        index: 0,
        header: "@@ -1 +1 @@",
      }).success,
    ).toBe(true);
    expect(CodeRequest.safeParse({ method: "commit", ...base, message: "   ", amend: false }).success).toBe(
      false,
    );
    expect(CodeRequest.safeParse({ method: "reword", ...base, sha: "not-a-sha", message: "x" }).success).toBe(
      false,
    );
    expect(
      CodeRequest.safeParse({
        method: "createPr",
        ...base,
        title: "feat: x",
        body: "",
        base: "main",
        draft: true,
        reviewers: ["--admin"],
        ticketId: null,
      }).success,
    ).toBe(false);
  });

  test("discardChanges, stageAll and unstageAll are code requests confined to relative paths", () => {
    const w = { projectId: "p1", worktree: "/repo" };
    expect(CodeRequest.safeParse({ method: "discardChanges", ...w, paths: ["src/a.ts"] }).success).toBe(true);
    expect(CodeRequest.safeParse({ method: "discardChanges", ...w, paths: [] }).success).toBe(false);
    expect(CodeRequest.safeParse({ method: "discardChanges", ...w, paths: ["../x"] }).success).toBe(false);
    expect(CodeRequest.safeParse({ method: "stageAll", ...w }).success).toBe(true);
    expect(CodeRequest.safeParse({ method: "unstageAll", ...w }).success).toBe(true);
  });

  test("every code request is either a local-only mutation or a listed read", () => {
    expect(CODE_MUTATION_METHODS).toEqual([
      "writeFile",
      "stageFiles",
      "unstageFiles",
      "discardChanges",
      "stageAll",
      "unstageAll",
      "stageHunk",
      "commit",
      "reword",
      "undoCommit",
      "abortOperation",
      "push",
      "createPr",
    ]);
    expect(LOCAL_ONLY_CODE_METHODS).toEqual([...CODE_MUTATION_METHODS, "openInEditor"]);
    const reads: CodeRequest["method"][] = [
      "worktrees",
      "status",
      "diff",
      "readFile",
      "remoteBranches",
      "compare",
      "commitDefaults",
      "ghStatus",
      "prForBranch",
    ];
    const methods = CodeRequest.options.map((o) => o.shape.method.value);
    expect([...methods].sort()).toEqual([...LOCAL_ONLY_CODE_METHODS, ...reads].sort());
  });

  test("CodeEvent is tagged", () => {
    expect(CodeEvent.safeParse({ type: "code", projectId: "p", worktree: "/w" }).success).toBe(true);
    expect(CodeEvent.safeParse({ projectId: "p" }).success).toBe(false);
  });

  test("CodeEvent may name the changed paths, within a bound", () => {
    const event = { type: "code", projectId: "p", worktree: "/w" } as const;
    expect(CodeEvent.safeParse({ ...event, paths: ["src/a.ts"] }).success).toBe(true);
    const tooMany = Array.from({ length: MAX_EVENT_PATHS + 1 }, (_, i) => `f${i}`);
    expect(CodeEvent.safeParse({ ...event, paths: tooMany }).success).toBe(false);
  });

  test("an event touches a path it names, one inside a named folder, or any path when unnamed", () => {
    const event = { type: "code", projectId: "p", worktree: "/w" } as const;
    expect(eventTouches(event, "src/a.ts")).toBe(true);
    expect(eventTouches({ ...event, paths: ["src/a.ts"] }, "src/a.ts")).toBe(true);
    expect(eventTouches({ ...event, paths: ["src"] }, "src/a.ts")).toBe(true);
    expect(eventTouches({ ...event, paths: ["src/b.ts", "sr"] }, "src/a.ts")).toBe(false);
  });

  test("ExternalRef describes a GitHub PR", () => {
    const ref = { kind: "github_pr", url: "https://github.com/kibo/test/pull/1", number: 1, state: "draft" };
    expect(ExternalRef.safeParse(ref).success).toBe(true);
    expect(ExternalRef.safeParse({ ...ref, state: "unknown" }).success).toBe(false);
  });
});

describe("tabs contracts", () => {
  test("targets are discriminated by kind", () => {
    expect(TabTarget.safeParse({ kind: "page", projectId: "p", pageId: "1@1" }).success).toBe(true);
    expect(
      TabTarget.safeParse({ kind: "file", projectId: "p", worktree: null, path: "a.ts", line: 4 }).success,
    ).toBe(true);
    expect(
      TabTarget.safeParse({ kind: "file", projectId: "p", worktree: null, path: "../a", line: null }).success,
    ).toBe(false);
  });

  test("a screen outside any project is a target", () => {
    expect(TabTarget.safeParse({ kind: "screen", screen: "queue" }).success).toBe(true);
    expect(TabTarget.safeParse({ kind: "screen", screen: "elsewhere" }).success).toBe(false);
  });

  test("salvaging a stored state drops the unknown targets and keeps the others", () => {
    const project = { kind: "project", projectId: "p" };
    const stored = {
      tabs: [
        { id: "a", target: project, pinned: true },
        { id: "b", target: { kind: "future", x: 1 }, pinned: false },
      ],
      activeId: "b",
      recents: [{ kind: "future" }, project],
    };
    expect(salvageTabsState(stored)).toEqual({
      tabs: [{ id: "a", target: { kind: "project", projectId: "p" }, pinned: true }],
      activeId: null,
      recents: [{ kind: "project", projectId: "p" }],
    });
    expect(salvageTabsState({ tabs: "nope" })).toBeNull();
  });

  test("the empty state is valid and the tab count is bounded", () => {
    expect(TabsState.parse(EMPTY_TABS)).toEqual({ tabs: [], activeId: null, recents: [] });
    const tab = { id: "t", target: { kind: "project", projectId: "p" }, pinned: false };
    expect(
      TabsState.safeParse({ tabs: Array.from({ length: 51 }, () => tab), activeId: null, recents: [] })
        .success,
    ).toBe(false);
  });
});
