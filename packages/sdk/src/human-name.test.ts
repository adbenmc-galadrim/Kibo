import { expect, test } from "bun:test";
import { assigneeLabel, humanName } from "./human-name";

test("an account id left by an old shared project never shows", () => {
  expect(humanName("2a4e8c1d-0b3f-4e5a-9c7d-6f8e9a0b1c2d", "un membre")).toBe("un membre");
  expect(humanName("1789B628-9778-4031-95AA-0DBD53D0EBF5", "un membre")).toBe("un membre");
});

test("a local user name is already readable and stays as written", () => {
  expect(humanName("adam", "un membre")).toBe("adam");
  expect(humanName("e2e", "un membre")).toBe("e2e");
});

test("an assignee is labelled by its reference", () => {
  expect(assigneeLabel({ kind: "human", ref: "adam" })).toBe("adam");
  expect(assigneeLabel({ kind: "agent", ref: "opus-dev" })).toBe("opus-dev");
});
