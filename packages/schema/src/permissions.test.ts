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

test("reading the question recipients is a read of questions", () => {
  expect(permissionOfCall(ComponentCall.parse({ kind: "questions.recipients" }))).toBe("read:question");
});

test("peeking at a run is a read of runs", () => {
  expect(permissionOfCall(ComponentCall.parse({ kind: "run.peek", runId: "r1" }))).toBe("read:run");
  expect(permissionOfCall(ComponentCall.parse({ kind: "run.deliveryAgent" }))).toBe("read:run");
  expect(ComponentCall.safeParse({ kind: "run.peek", runId: "" }).success).toBe(false);
});

test("reading the project needs read:ticket", () => {
  expect(permissionOfCall(ComponentCall.parse({ kind: "project.get" }))).toBe("read:ticket");
});
