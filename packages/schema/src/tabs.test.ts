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
