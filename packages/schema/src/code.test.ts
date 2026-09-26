import { describe, expect, test } from "bun:test";
import { CodeEvent, CodeRequest, GhLogin, RelPath } from "./code";
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

  test("CodeEvent is tagged", () => {
    expect(CodeEvent.safeParse({ type: "code", projectId: "p", worktree: "/w" }).success).toBe(true);
    expect(CodeEvent.safeParse({ projectId: "p" }).success).toBe(false);
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
