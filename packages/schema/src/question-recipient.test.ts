import { expect, test } from "bun:test";
import { askInputFromTool, Question } from "./question";
import {
  DEFAULT_RECIPIENTS,
  ME_RECIPIENT,
  openCountByRecipient,
  QuestionRecipient,
  RECIPIENTS_MAX,
  resolveRecipient,
} from "./question-recipient";

const QUESTION = {
  id: "11111111-1111-4111-8111-111111111111",
  ticketId: "1@1",
  runId: null,
  title: "Quelle base ?",
  context: "",
  options: [],
  provisional: null,
  blocking: false,
  createdBy: { kind: "agent", ref: "kibo-dev" },
  createdAt: 1,
  answer: null,
} as const;

test("the default recipients", () => {
  expect(DEFAULT_RECIPIENTS.map((r) => r.id)).toEqual(["me", "product", "client"]);
  expect(DEFAULT_RECIPIENTS[0]?.name).toBe("Moi (technique)");
  expect(ME_RECIPIENT).toBe("me");
  expect(RECIPIENTS_MAX).toBe(20);
  expect(QuestionRecipient.safeParse({ id: "x", name: "y".repeat(41) }).success).toBe(false);
  expect(QuestionRecipient.safeParse({ id: "x", name: "   " }).success).toBe(false);
});

test("a recipient is resolved by id, then by name, else me", () => {
  expect(resolveRecipient(DEFAULT_RECIPIENTS, "Client")).toBe("client");
  expect(resolveRecipient(DEFAULT_RECIPIENTS, "  produit ")).toBe("product");
  expect(resolveRecipient(DEFAULT_RECIPIENTS, "product")).toBe("product");
  expect(resolveRecipient(DEFAULT_RECIPIENTS, "juridique")).toBe("me");
  expect(resolveRecipient(DEFAULT_RECIPIENTS, undefined)).toBe("me");
  expect(resolveRecipient(DEFAULT_RECIPIENTS, null)).toBe("me");
  expect(resolveRecipient([{ id: "abc", name: "Client" }, ...DEFAULT_RECIPIENTS], "client")).toBe("client");
});

test("open questions are counted by recipient", () => {
  const questions = [
    Question.parse(QUESTION),
    Question.parse({ ...QUESTION, id: "22222222-2222-4222-8222-222222222222", recipient: "client" }),
    Question.parse({
      ...QUESTION,
      id: "33333333-3333-4333-8333-333333333333",
      recipient: "client",
      answer: { kind: "text", option: null, text: "ok", by: { kind: "human", ref: "adam" }, at: 2 },
    }),
  ];
  expect(openCountByRecipient(questions)).toEqual(
    new Map([
      ["me", 1],
      ["client", 1],
    ]),
  );
});

test("an older question reads as addressed to me and not sent", () => {
  const question = Question.parse(QUESTION);
  expect(question.recipient).toBe("me");
  expect(question.sentAt).toBeNull();
});

test("the agent's proposed recipient is kept raw and cut", () => {
  expect(askInputFromTool({ question: "Quelle base ?", recipient: "Client" }, true)?.recipient).toBe(
    "Client",
  );
  expect(askInputFromTool({ question: "Quelle base ?" }, true)?.recipient).toBeNull();
  expect(askInputFromTool({ question: "Quelle base ?", recipient: "x".repeat(41) }, true)?.recipient).toBe(
    "x".repeat(40),
  );
});
