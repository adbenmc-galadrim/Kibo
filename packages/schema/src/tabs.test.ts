import { expect, test } from "bun:test";
import { Screen, salvageTabsState, TabTarget, targetProjectId } from "./tabs";

test("retired screens and targets no longer parse, so a stored tab of theirs is dropped", () => {
  for (const screen of ["agents", "queue", "skills", "creations"])
    expect(Screen.safeParse(screen).success).toBe(false);
  expect(TabTarget.safeParse({ kind: "run", runId: "r1" }).success).toBe(false);
  expect(TabTarget.safeParse({ kind: "skill", skillId: "a:b" }).success).toBe(false);
  expect(TabTarget.safeParse({ kind: "changes", projectId: "p1", worktree: null }).success).toBe(false);
  const kept = {
    id: "t2",
    target: { kind: "ticket" as const, projectId: "p1", ticketId: "t1" },
    pinned: false,
  };
  const run = { id: "t1", target: { kind: "run", runId: "r1" }, pinned: false };
  expect(salvageTabsState({ tabs: [run, kept], activeId: "t1", recents: [run.target] })).toEqual({
    tabs: [{ ...kept, preview: false }],
    activeId: null,
    recents: [],
  });
  expect(targetProjectId({ kind: "ticket", projectId: "p1", ticketId: "t1" })).toBe("p1");
});

test("a page target may point at one question, none by default", () => {
  const page = { kind: "page", projectId: "p", pageId: "pg" };
  expect(TabTarget.parse(page)).toEqual({ kind: "page", projectId: "p", pageId: "pg" });
  expect(TabTarget.parse({ ...page, question: "q1" })).toMatchObject({ question: "q1" });
  expect(TabTarget.parse({ ...page, question: null })).toMatchObject({ question: null });
  expect(TabTarget.safeParse({ ...page, question: "" }).success).toBe(false);
  expect(TabTarget.safeParse({ ...page, question: 3 }).success).toBe(false);
});

test("the domains screen may aim at one project, which never makes it a project tab", () => {
  const aimed = TabTarget.parse({ kind: "screen", screen: "domains", projectId: "p1" });
  expect(aimed).toEqual({ kind: "screen", screen: "domains", projectId: "p1" });
  expect(targetProjectId(aimed)).toBeNull();
  expect(TabTarget.parse({ kind: "screen", screen: "domains" })).toEqual({
    kind: "screen",
    screen: "domains",
  });
  expect(TabTarget.safeParse({ kind: "screen", screen: "domains", projectId: "" }).success).toBe(false);
});

test("a sprint is a project target a tab can open", () => {
  const sprint = TabTarget.parse({ kind: "sprint", projectId: "p1", sprintId: "s1" });
  expect(sprint).toEqual({ kind: "sprint", projectId: "p1", sprintId: "s1" });
  expect(targetProjectId(sprint)).toBe("p1");
  expect(TabTarget.safeParse({ kind: "sprint", projectId: "p1", sprintId: "" }).success).toBe(false);
});

test("tabs stored before sprints still read back, a sprint tab beside them", () => {
  const stored = {
    tabs: [
      { id: "a", target: { kind: "ticket", projectId: "p1", ticketId: "t1" }, pinned: false },
      { id: "b", target: { kind: "page", projectId: "p1", pageId: "pg" }, pinned: true, preview: false },
      { id: "c", target: { kind: "sprint", projectId: "p1", sprintId: "s1" }, pinned: false },
    ],
    activeId: "b",
    recents: [{ kind: "project", projectId: "p1" }],
  };
  const state = salvageTabsState(stored);
  expect(state?.tabs.map((t) => t.target.kind)).toEqual(["ticket", "page", "sprint"]);
  expect(state?.activeId).toBe("b");
  expect(state?.recents).toEqual([{ kind: "project", projectId: "p1" }]);
});
