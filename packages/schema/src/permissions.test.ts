import { expect, test } from "bun:test";
import { ComponentCall } from "./call";
import { NO_PERMISSIONS, permissionList, permissionOfCall } from "./permissions";

test("design.frame needs the design capability", () => {
  expect(
    permissionOfCall({
      kind: "design.frame",
      url: "https://www.figma.com/design/AbC123xyz/K?node-id=1-2",
      refresh: false,
    }),
  ).toBe("cap:design");
  expect(permissionList({ ...NO_PERMISSIONS, capabilities: ["design"] })).toEqual(["cap:design"]);
});

test("delivering answers to the agent is no longer a component call", () => {
  expect(ComponentCall.safeParse({ kind: "questions.deliver", ticketId: "t1" }).success).toBe(false);
});

test("reading the question recipients is a read of questions", () => {
  expect(permissionOfCall(ComponentCall.parse({ kind: "questions.recipients" }))).toBe("read:question");
});

test("reading the project needs read:ticket", () => {
  expect(permissionOfCall(ComponentCall.parse({ kind: "project.get" }))).toBe("read:ticket");
});
