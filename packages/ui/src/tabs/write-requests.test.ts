import { expect, test } from "bun:test";
import type { ComponentCall } from "@kibo/schema";
import { isCodeWrite, isProjectWrite, projectIdOf } from "./write-requests";

const command = {
  method: "command" as const,
  projectId: "p1",
  command: { method: "createTicket" as const, title: "x" },
};

test("project commands and code writes count, reads and component data do not", () => {
  expect(isProjectWrite(command)).toBe(true);
  expect(isProjectWrite({ method: "getTabs" })).toBe(false);
  expect(
    isProjectWrite({
      method: "componentCall",
      projectId: "p1",
      instanceId: "i1",
      call: { kind: "data.set", key: "k", value: 1 },
    }),
  ).toBe(false);
  expect(
    isProjectWrite({
      method: "componentCall",
      projectId: "p1",
      instanceId: "i1",
      call: { kind: "run", command: command.command },
    }),
  ).toBe(true);
  const notes = (call: ComponentCall) => ({
    method: "componentCall" as const,
    projectId: "p1",
    instanceId: "i1",
    call,
  });
  expect(
    isProjectWrite(notes({ kind: "notes.write", path: "a.md", markdown: "x", expectedMtime: null })),
  ).toBe(true);
  expect(isProjectWrite(notes({ kind: "notes.create", path: "a.md", markdown: "" }))).toBe(true);
  expect(isProjectWrite(notes({ kind: "notes.read", path: "a.md" }))).toBe(false);
  expect(isProjectWrite(notes({ kind: "action", name: "x", input: null }))).toBe(false);
  const hash = "0".repeat(40);
  expect(
    isCodeWrite({
      method: "writeFile",
      projectId: "p1",
      worktree: "/wt",
      path: "a.md",
      content: "x",
      baseHash: hash,
    }),
  ).toBe(true);
  expect(isCodeWrite({ method: "stageAll", projectId: "p1", worktree: "/wt" })).toBe(true);
  expect(isCodeWrite({ method: "status", projectId: "p1", worktree: "/wt" })).toBe(false);
  expect(projectIdOf(command)).toBe("p1");
  expect(projectIdOf({ method: "status", projectId: "p2", worktree: "/wt" })).toBe("p2");
  expect(projectIdOf({ method: "getTabs" })).toBeNull();
});
