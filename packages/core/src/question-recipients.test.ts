import { expect, test } from "bun:test";
import { type Actor, DEFAULT_RECIPIENTS, KiboError, RECIPIENTS_MAX } from "@kibo/schema";
import { createProjectDoc } from "./project";
import {
  addQuestionRecipient,
  listQuestionRecipients,
  markQuestionSent,
  removeQuestionRecipient,
  renameQuestionRecipient,
  setQuestionRecipient,
} from "./question-recipients";
import { answerQuestion, createQuestion, listQuestions } from "./questions";
import { archiveQuestion } from "./questions-edit";
import { createTicket } from "./tickets";

const AGENT: Actor = { kind: "agent", ref: "kibo-dev" };
const HUMAN: Actor = { kind: "human", ref: "adam" };

const newDoc = () =>
  createProjectDoc({
    id: "p1",
    key: "KIB",
    name: "Kibo",
    folder: null,
    color: "#F97316",
    worktree: null,
    storybook: null,
    delivery: null,
    tracking: null,
    description: null,
    client: null,
  });

const code = (work: () => unknown): string | null => {
  try {
    work();
    return null;
  } catch (e) {
    return e instanceof KiboError ? e.code : "UNKNOWN";
  }
};

function withQuestion() {
  const doc = newDoc();
  const ticket = createTicket(doc, { title: "Formulaire" });
  const question = createQuestion(doc, { ticketId: ticket.id, title: "Quelle base ?", createdBy: AGENT });
  return { doc, question };
}

test("a project without recipients reads the defaults without writing", () => {
  const doc = newDoc();
  expect(listQuestionRecipients(doc)).toEqual([...DEFAULT_RECIPIENTS]);
  expect(doc.getMap("questionRecipients").size).toBe(0);
});

test("adding a recipient keeps the defaults first", () => {
  const doc = newDoc();
  const added = addQuestionRecipient(doc, "  Juridique ", "r-legal");
  expect(added).toEqual({ id: "r-legal", name: "Juridique" });
  expect(listQuestionRecipients(doc)).toEqual([...DEFAULT_RECIPIENTS, added]);
  expect(code(() => addQuestionRecipient(doc, " ", "r-empty"))).toBe("INVALID_INPUT");
});

test("a project holds at most twenty recipients", () => {
  const doc = newDoc();
  for (let i = DEFAULT_RECIPIENTS.length; i < RECIPIENTS_MAX; i += 1)
    addQuestionRecipient(doc, `R${i}`, `r${i}`);
  expect(listQuestionRecipients(doc)).toHaveLength(RECIPIENTS_MAX);
  expect(code(() => addQuestionRecipient(doc, "Trop", "r-extra"))).toBe("QUOTA_EXCEEDED");
});

test("renaming a recipient", () => {
  const doc = newDoc();
  expect(renameQuestionRecipient(doc, "client", "Client final")).toEqual({
    id: "client",
    name: "Client final",
  });
  expect(listQuestionRecipients(doc).map((r) => r.name)).toEqual([
    "Moi (technique)",
    "Produit",
    "Client final",
  ]);
  expect(code(() => renameQuestionRecipient(doc, "nobody", "X"))).toBe("NOT_FOUND");
});

test("removing a recipient spares me and the open questions", () => {
  const { doc, question } = withQuestion();
  expect(code(() => removeQuestionRecipient(doc, "me"))).toBe("INVALID_INPUT");
  setQuestionRecipient(doc, question.id, "client");
  expect(code(() => removeQuestionRecipient(doc, "client"))).toBe("CONFLICT");
  answerQuestion(doc, question.id, { kind: "text", text: "Postgres" }, HUMAN, 5);
  expect(removeQuestionRecipient(doc, "client")).toBeNull();
  expect(listQuestionRecipients(doc).map((r) => r.id)).toEqual(["me", "product"]);
  expect(listQuestions(doc)[0]?.recipient).toBe("client");
  expect(code(() => removeQuestionRecipient(doc, "client"))).toBe("NOT_FOUND");
});

test("a question is addressed to a known recipient", () => {
  const { doc, question } = withQuestion();
  expect(question.recipient).toBe("me");
  expect(setQuestionRecipient(doc, question.id, "product").recipient).toBe("product");
  expect(code(() => setQuestionRecipient(doc, question.id, "juridique"))).toBe("NOT_FOUND");
  expect(code(() => setQuestionRecipient(doc, "missing", "me"))).toBe("NOT_FOUND");
});

test("marking a question as sent is idempotent", () => {
  const { doc, question } = withQuestion();
  expect(markQuestionSent(doc, question.id, 10).sentAt).toBe(10);
  expect(markQuestionSent(doc, question.id, 20).sentAt).toBe(10);
  expect(code(() => markQuestionSent(doc, "missing", 1))).toBe("NOT_FOUND");
});

test("a recipient used by archived questions only can be removed", () => {
  const { doc, question } = withQuestion();
  setQuestionRecipient(doc, question.id, "client");
  archiveQuestion(doc, { method: "archiveQuestion", questionId: question.id, by: HUMAN });
  expect(removeQuestionRecipient(doc, "client")).toBeNull();
});
