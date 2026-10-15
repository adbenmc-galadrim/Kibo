import { expect, test } from "bun:test";
import { type Actor, KiboError, type ProjectCommand, type Question } from "@kibo/schema";
import { createProjectDoc } from "./project";
import { addQuestionRecipient } from "./question-recipients";
import { answerQuestion, createQuestion, getQuestion, markAnswersDelivered } from "./questions";
import {
  archiveQuestion,
  reopenQuestion,
  restoreQuestion,
  updateAnswer,
  updateQuestion,
} from "./questions-edit";
import { createTicket } from "./tickets";

const ADAM: Actor = { kind: "human", ref: "adam" };
const THEO: Actor = { kind: "human", ref: "theo" };

function setup() {
  const doc = createProjectDoc({
    id: "p1",
    key: "KIB",
    name: "Kibo",
    folder: null,
    color: "#F97316",
    worktree: null,
    storybook: null,
    duplication: null,
    delivery: null,
  });
  const ticket = createTicket(doc, { title: "Stockage" });
  const other = createTicket(doc, { title: "Exports" });
  const ask = (title: string, options: string[] = ["A", "B"]) =>
    createQuestion(doc, { ticketId: ticket.id, title, options, createdBy: ADAM, at: 1 });
  const answer = (q: Question) => answerQuestion(doc, q.id, { kind: "option", option: "A" }, ADAM, 2);
  return { doc, ticket, other, ask, answer };
}

function code(run: () => unknown): string {
  try {
    run();
  } catch (error) {
    if (error instanceof KiboError) return error.code;
    throw error;
  }
  return "OK";
}

type UpdateCommand = Extract<ProjectCommand, { method: "updateQuestion" }>;

const update = (
  questionId: string,
  patch: Omit<Partial<UpdateCommand>, "method" | "questionId">,
): UpdateCommand => ({
  method: "updateQuestion",
  questionId,
  by: THEO,
  at: 10,
  ...patch,
});
const edit = <M extends "reopenQuestion" | "archiveQuestion" | "restoreQuestion">(
  method: M,
  questionId: string,
) => ({ method, questionId, by: THEO, at: 20 }) as const;

test("updating a question records the previous values of the changed fields only", () => {
  const { doc, ask } = setup();
  const q = ask("A");
  const updated = updateQuestion(doc, update(q.id, { title: "B", context: "" }));
  expect(updated).toMatchObject({ id: q.id, title: "B", createdAt: q.createdAt });
  expect(updated.history).toEqual([{ kind: "updated", at: 10, by: THEO, previous: { title: "A" } }]);
  expect(getQuestion(doc, q.id)).toEqual(updated);
});

test("an update without any change writes nothing and returns the question as is", () => {
  const { doc, ask } = setup();
  const q = ask("A");
  expect(updateQuestion(doc, update(q.id, { title: "A", options: ["A", "B"] }))).toEqual(q);
  expect(getQuestion(doc, q.id).history).toEqual([]);
});

test("an update checks the ticket, its quota, the recipient and the provisional choice", () => {
  const { doc, ask, other } = setup();
  const q = ask("A");
  expect(code(() => updateQuestion(doc, update(q.id, { ticketId: "9@9" })))).toBe("NOT_FOUND");
  expect(code(() => updateQuestion(doc, update(q.id, { recipient: "nope" })))).toBe("NOT_FOUND");
  expect(code(() => updateQuestion(doc, update(q.id, { provisional: "C" })))).toBe("INVALID_INPUT");
  for (let i = 0; i < 500; i += 1)
    createQuestion(doc, { ticketId: other.id, title: `Q${i}`, createdBy: ADAM });
  expect(code(() => updateQuestion(doc, update(q.id, { ticketId: other.id })))).toBe("QUOTA_EXCEEDED");
  const galadrim = addQuestionRecipient(doc, "Galadrim", "galadrim");
  expect(updateQuestion(doc, update(q.id, { recipient: galadrim.id })).history[0]?.previous).toEqual({
    recipient: "me",
  });
});

test("an answered question keeps its options until reopened, a delivered or archived one is frozen", () => {
  const { doc, ask, answer, ticket } = setup();
  const waiting = answer(ask("A"));
  expect(updateQuestion(doc, update(waiting.id, { title: "A bis" })).title).toBe("A bis");
  expect(code(() => updateQuestion(doc, update(waiting.id, { options: ["A", "C"] })))).toBe(
    "INVALID_TRANSITION",
  );
  expect(code(() => updateQuestion(doc, update(waiting.id, { provisional: "B" })))).toBe(
    "INVALID_TRANSITION",
  );
  const delivered = answer(ask("D"));
  markAnswersDelivered(doc, { ticketId: ticket.id, questionIds: [delivered.id], runId: "r1", at: 3 });
  expect(code(() => updateQuestion(doc, update(delivered.id, { title: "E" })))).toBe("INVALID_TRANSITION");
  const archived = archiveQuestion(doc, edit("archiveQuestion", ask("F").id));
  expect(code(() => updateQuestion(doc, update(archived.id, { title: "G" })))).toBe("INVALID_TRANSITION");
});

test("two questions of a ticket may share a title after an update", () => {
  const { doc, ask } = setup();
  ask("A");
  expect(updateQuestion(doc, update(ask("B").id, { title: "A" })).title).toBe("A");
});

test("an undelivered answer is replaced, born undelivered, by the given actor", () => {
  const { doc, ask, answer, ticket } = setup();
  const q = answer(ask("A"));
  const edited = updateAnswer(doc, {
    method: "updateAnswer",
    questionId: q.id,
    answer: { kind: "text", text: "Plutôt C" },
    by: THEO,
    at: 30,
  });
  expect(edited.answer).toEqual({
    kind: "text",
    option: null,
    text: "Plutôt C",
    by: THEO,
    at: 30,
    deliveredAt: null,
    deliveredRunId: null,
  });
  expect(edited.history).toEqual([
    { kind: "answer_edited", at: 30, by: THEO, previous: { answer: q.answer } },
  ]);
  const empty = {
    method: "updateAnswer",
    questionId: q.id,
    answer: { kind: "text", text: "" },
    by: THEO,
  } as const;
  expect(code(() => updateAnswer(doc, empty))).toBe("INVALID_INPUT");
  expect(code(() => updateAnswer(doc, { ...empty, questionId: ask("B").id }))).toBe("INVALID_TRANSITION");
  markAnswersDelivered(doc, { ticketId: ticket.id, questionIds: [q.id], runId: "r1", at: 40 });
  expect(code(() => updateAnswer(doc, { ...empty, answer: { kind: "text", text: "x" } }))).toBe(
    "INVALID_TRANSITION",
  );
});

test("reopening keeps the withdrawn answer with its delivery mark", () => {
  const { doc, ask, answer, ticket } = setup();
  const q = answer(ask("A"));
  const [delivered] = markAnswersDelivered(doc, {
    ticketId: ticket.id,
    questionIds: [q.id],
    runId: "r1",
    at: 3,
  });
  const reopened = reopenQuestion(doc, edit("reopenQuestion", q.id));
  expect(reopened.answer).toBeNull();
  expect(reopened.history[0]).toEqual({
    kind: "reopened",
    at: 20,
    by: THEO,
    previous: { answer: delivered?.answer ?? null },
  });
  expect(reopened.history[0]?.previous.answer).toMatchObject({ deliveredAt: 3, deliveredRunId: "r1" });
  expect(code(() => reopenQuestion(doc, edit("reopenQuestion", q.id)))).toBe("INVALID_TRANSITION");
  const archived = archiveQuestion(doc, edit("archiveQuestion", answer(ask("B")).id));
  expect(code(() => reopenQuestion(doc, edit("reopenQuestion", archived.id)))).toBe("INVALID_TRANSITION");
});

test("archiving hides open and answered questions, restoring brings them back", () => {
  const { doc, ask, answer } = setup();
  for (const q of [ask("A"), answer(ask("B"))]) {
    const archived = archiveQuestion(doc, edit("archiveQuestion", q.id));
    expect(archived).toMatchObject({ archivedAt: 20, archivedBy: THEO });
    expect(archived.history.at(-1)).toEqual({ kind: "archived", at: 20, by: THEO, previous: {} });
    expect(code(() => archiveQuestion(doc, edit("archiveQuestion", q.id)))).toBe("INVALID_TRANSITION");
    const restored = restoreQuestion(doc, edit("restoreQuestion", q.id));
    expect(restored).toMatchObject({ archivedAt: null, archivedBy: null, answer: q.answer });
    expect(restored.history.at(-1)?.kind).toBe("restored");
    expect(code(() => restoreQuestion(doc, edit("restoreQuestion", q.id)))).toBe("INVALID_TRANSITION");
  }
});

test("the history keeps the last twenty changes", () => {
  const { doc, ask } = setup();
  const q = ask("T0");
  for (let i = 1; i <= 21; i += 1) updateQuestion(doc, update(q.id, { title: `T${i}`, at: i }));
  const { history } = getQuestion(doc, q.id);
  expect(history).toHaveLength(20);
  expect(history[0]?.previous).toEqual({ title: "T1" });
});
