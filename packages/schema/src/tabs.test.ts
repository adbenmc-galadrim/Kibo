import { expect, test } from "bun:test";
import { Screen, TabTarget, targetProjectId } from "./tabs";

test("creations is a screen a tab can open", () => {
  expect(Screen.parse("creations")).toBe("creations");
  expect(TabTarget.parse({ kind: "screen", screen: "creations" })).toEqual({
    kind: "screen",
    screen: "creations",
  });
});

test("a run is a target a tab can open", () => {
  expect(TabTarget.parse({ kind: "run", runId: "r1" })).toEqual({ kind: "run", runId: "r1" });
  expect(TabTarget.safeParse({ kind: "run", runId: "" }).success).toBe(false);
  expect(targetProjectId({ kind: "run", runId: "r1" })).toBeNull();
  expect(targetProjectId({ kind: "screen", screen: "agents" })).toBeNull();
  expect(targetProjectId({ kind: "ticket", projectId: "p1", ticketId: "t1" })).toBe("p1");
});

test("skills is a screen and a skill a target", () => {
  expect(Screen.parse("skills")).toBe("skills");
  expect(TabTarget.parse({ kind: "skill", skillId: "a:b" })).toEqual({ kind: "skill", skillId: "a:b" });
  expect(TabTarget.safeParse({ kind: "skill", skillId: "Bad" }).success).toBe(false);
});

test("a page target may point at one question, none by default", () => {
  const page = { kind: "page", projectId: "p", pageId: "pg" };
  expect(TabTarget.parse(page)).toEqual({ kind: "page", projectId: "p", pageId: "pg" });
  expect(TabTarget.parse({ ...page, question: "q1" })).toMatchObject({ question: "q1" });
  expect(TabTarget.parse({ ...page, question: null })).toMatchObject({ question: null });
  expect(TabTarget.safeParse({ ...page, question: "" }).success).toBe(false);
  expect(TabTarget.safeParse({ ...page, question: 3 }).success).toBe(false);
});
