import { expect, test } from "bun:test";
import type { StatusId } from "@kibo/schema";
import { boardColumn } from "./board-column";

const WITH_BLOCKED = new Set<StatusId>(["backlog", "todo", "in_progress", "blocked", "done"]);

test("a blocked ticket sits in Bloqué, whatever its status", () => {
  expect(boardColumn({ statusId: "todo" }, true, WITH_BLOCKED)).toBe("blocked");
  expect(boardColumn({ statusId: "in_progress" }, true, WITH_BLOCKED)).toBe("blocked");
  expect(boardColumn({ statusId: "blocked" }, true, WITH_BLOCKED)).toBe("blocked");
});

test("a ticket that is not blocked stays in its status column", () => {
  expect(boardColumn({ statusId: "todo" }, false, WITH_BLOCKED)).toBe("todo");
});

test("a done ticket stays done, and a workflow without Bloqué keeps the status", () => {
  expect(boardColumn({ statusId: "done" }, true, WITH_BLOCKED)).toBe("done");
  expect(boardColumn({ statusId: "todo" }, true, new Set<StatusId>(["todo", "done"]))).toBe("todo");
});
