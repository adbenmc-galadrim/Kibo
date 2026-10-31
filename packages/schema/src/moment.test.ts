import { expect, test } from "bun:test";
import { ActionKind, PartialReason, RunActionOutcome } from "./moment";

test("the action kinds, outcomes and partial reasons named by the run texts parse", () => {
  expect(ActionKind.parse("skill")).toBe("skill");
  expect(ActionKind.safeParse("teleport").success).toBe(false);
  expect(RunActionOutcome.options).toEqual(["ok", "error", "denied"]);
  expect(PartialReason.safeParse("unreadable").success).toBe(true);
});
