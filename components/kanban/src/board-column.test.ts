import { expect, test } from "bun:test";
import { Question, type StatusId } from "@kibo/schema";
import { boardColumn, heldByQuestion, holdMessage } from "./board-column";
import { fr } from "./fr";

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

test("a card held in Bloqué by a question cannot be dropped in another column, its own included", () => {
  expect(heldByQuestion("blocked", "in_progress", "Q14")).toBe("Q14");
  expect(heldByQuestion("blocked", "todo", "Q14")).toBe("Q14");
  expect(heldByQuestion("blocked", "blocked", "Q14")).toBeNull();
});

test("a card blocked only by its status, or not blocked, moves freely", () => {
  expect(heldByQuestion("blocked", "in_progress", null)).toBeNull();
  expect(heldByQuestion("todo", "in_progress", null)).toBeNull();
  expect(heldByQuestion("done", "todo", "Q14")).toBeNull();
});

test("the refusal names the question and asks to answer it first", () => {
  expect(fr.heldByQuestion("Q14")).toBe("Bloqué par Q14 : réponds d'abord à la question.");
});

test("the hold message comes from the open blocking question of the ticket", () => {
  const question = Question.parse({
    id: "1@1",
    ticketId: "2@1",
    runId: null,
    title: "Quel format pour l'import Excel ?",
    context: "",
    options: [],
    provisional: null,
    blocking: true,
    createdBy: { kind: "human", ref: "adam" },
    createdAt: 0,
    number: 14,
    answer: null,
  });
  expect(holdMessage({ id: "2@1" }, "blocked", "in_progress", [question])).toBe(
    "Bloqué par Q14 : réponds d'abord à la question.",
  );
  expect(holdMessage({ id: "2@1" }, "blocked", "blocked", [question])).toBeNull();
  expect(holdMessage({ id: "3@1" }, "blocked", "in_progress", [question])).toBeNull();
});
