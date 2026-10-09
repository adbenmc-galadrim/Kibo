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

test("embed.open needs the embed capability, design.storybooks the design capability", () => {
  expect(
    permissionOfCall(ComponentCall.parse({ kind: "embed.open", url: "https://itch.io/embed-upload/1" })),
  ).toBe("cap:embed");
  expect(permissionOfCall(ComponentCall.parse({ kind: "design.storybooks" }))).toBe("cap:design");
  expect(ComponentCall.safeParse({ kind: "embed.open", url: "" }).success).toBe(false);
  expect(ComponentCall.safeParse({ kind: "embed.open", url: "a".repeat(2049) }).success).toBe(false);
});

test("delivering answers to the agent is a write of questions", () => {
  expect(permissionOfCall(ComponentCall.parse({ kind: "questions.deliver", ticketId: "t1" }))).toBe(
    "write:question",
  );
});
