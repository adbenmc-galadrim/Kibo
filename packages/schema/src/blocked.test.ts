import { expect, test } from "bun:test";
import { blockedCount, blockingQuestion, isBlocked, isOpen, openCount } from "./blocked";
import { Question } from "./question";
import type { StatusId } from "./status";

const question = (id: string, ticketId: string, over: Partial<Question> = {}): Question =>
  Question.parse({
    id,
    ticketId,
    runId: null,
    title: `Question ${id}`,
    context: "",
    options: [],
    provisional: null,
    blocking: true,
    createdBy: { kind: "human", ref: "adam" },
    createdAt: 1,
    answer: null,
    ...over,
  });

const answered = {
  kind: "text",
  option: null,
  text: "Oui",
  by: { kind: "human", ref: "adam" },
  at: 2,
} as const;
const ticket = (id: string, statusId: StatusId) => ({ id, statusId });

const QUESTIONS = [
  question("q14", "t5"),
  question("q15", "t6", { blocking: false }),
  question("q16", "t7", { answer: { ...answered, deliveredAt: null, deliveredRunId: null } }),
  question("q17", "t8", { archivedAt: 3, archivedBy: { kind: "human", ref: "adam" } }),
];

test("a ticket is blocked by its status or by an open blocking question", () => {
  expect(isBlocked(ticket("t1", "blocked"), [])).toBe(true);
  expect(isBlocked(ticket("t5", "in_progress"), QUESTIONS)).toBe(true);
  expect(isBlocked(ticket("t6", "in_progress"), QUESTIONS)).toBe(false);
  expect(isBlocked(ticket("t7", "in_progress"), QUESTIONS)).toBe(false);
  expect(isBlocked(ticket("t8", "todo"), QUESTIONS)).toBe(false);
  expect(isBlocked(ticket("t9", "todo"), QUESTIONS)).toBe(false);
});

test("the blocking question is the open blocking one of the ticket", () => {
  expect(blockingQuestion({ id: "t5" }, QUESTIONS)?.id).toBe("q14");
  expect(blockingQuestion({ id: "t6" }, QUESTIONS)).toBeNull();
  expect(blockingQuestion({ id: "t7" }, QUESTIONS)).toBeNull();
  expect(blockingQuestion({ id: "t8" }, QUESTIONS)).toBeNull();
});

test("a ticket is open until it is done, a question until it is answered", () => {
  for (const status of ["backlog", "todo", "in_progress", "in_review", "blocked"] as const)
    expect(isOpen(ticket("t", status))).toBe(true);
  expect(isOpen(ticket("t", "done"))).toBe(false);
  expect(QUESTIONS.map((q) => isOpen(q))).toEqual([true, true, false, false]);
});

test("four blocked tickets and one blocking question count five", () => {
  const tickets = [
    ticket("t1", "blocked"),
    ticket("t2", "blocked"),
    ticket("t3", "blocked"),
    ticket("t4", "blocked"),
    ticket("t5", "in_progress"),
    ticket("t6", "todo"),
    ticket("t7", "done"),
  ];
  expect(blockedCount(tickets, QUESTIONS)).toBe(5);
  expect(openCount(tickets)).toBe(6);
});
