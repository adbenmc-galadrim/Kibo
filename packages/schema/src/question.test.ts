import { expect, test } from "bun:test";
import fc from "fast-check";
import { isReservedCommand, ProjectCommand } from "./command";
import { KiboError } from "./errors";
import {
  AnswerInput,
  answerPrompt,
  askInputFromTool,
  countOpenByRun,
  DeliveryResult,
  deliveryPrompt,
  isOpen,
  Question,
  resolveAnswer,
  undeliveredAnswers,
} from "./question";
import { RpcRequest } from "./rpc";

const HUMAN_TEXT = {
  kind: "text",
  option: null,
  text: "",
  by: { kind: "human", ref: "adam" },
  at: 2,
  deliveredAt: null,
  deliveredRunId: null,
} as const;

const base = {
  id: "q1",
  ticketId: "t1",
  runId: "r1",
  title: "Bloquer le dépôt sur une affaire archivée ?",
  context: "",
  options: ["Oui", "Non"],
  provisional: "Non",
  blocking: false,
  createdBy: { kind: "agent", ref: "emis-livraison" },
  createdAt: 1,
  importRef: null,
  answer: null,
};

test("a question validates its options, provisional and answer shape", () => {
  expect(Question.parse(base)).toMatchObject({ importRef: null });
  expect(Question.safeParse({ ...base, provisional: "Peut-être" }).success).toBe(false);
  expect(Question.safeParse({ ...base, options: ["Oui", "Oui"] }).success).toBe(false);
  expect(
    Question.safeParse({ ...base, options: Array.from({ length: 7 }, (_, i) => `o${i}`), provisional: null })
      .success,
  ).toBe(false);
  expect(Question.safeParse({ ...base, title: "" }).success).toBe(false);
  const answered = {
    ...base,
    answer: { kind: "confirm", option: "Non", text: "", by: { kind: "human", ref: "adam" }, at: 2 },
  };
  expect(isOpen(Question.parse(answered))).toBe(false);
  expect(
    Question.safeParse({ ...answered, answer: { ...answered.answer, kind: "option", option: "Jamais" } })
      .success,
  ).toBe(false);
  expect(
    Question.safeParse({ ...answered, answer: { ...answered.answer, kind: "text", option: null, text: "" } })
      .success,
  ).toBe(false);
});

test("resolveAnswer normalizes the three kinds and refuses the impossible ones", () => {
  const q = Question.parse(base);
  expect(resolveAnswer(q, { kind: "option", option: "Oui" })).toEqual({
    kind: "option",
    option: "Oui",
    text: "",
  });
  expect(resolveAnswer(q, { kind: "confirm" })).toEqual({ kind: "confirm", option: "Non", text: "" });
  expect(resolveAnswer(q, { kind: "text", text: " Seulement les admins " })).toEqual({
    kind: "text",
    option: null,
    text: "Seulement les admins",
  });
  expect(() => resolveAnswer({ ...q, provisional: null }, { kind: "confirm" })).toThrow(
    new KiboError("INVALID_INPUT", "no provisional choice to confirm"),
  );
  expect(() => resolveAnswer(q, { kind: "option", option: "Jamais" })).toThrow(KiboError);
  fc.assert(
    fc.property(fc.constantFrom(...base.options), (option) => {
      const built = resolveAnswer(q, { kind: "option", option });
      return Question.safeParse({ ...base, answer: { ...built, by: base.createdBy, at: 3 } }).success;
    }),
  );
});

test("the tool input of ask_user and ask_question is reduced and bounded", () => {
  expect(
    askInputFromTool(
      { question: "Quel port ?", options: ["80", "443"], provisional: "443", context: "# Détail" },
      false,
    ),
  ).toEqual({
    title: "Quel port ?",
    context: "# Détail",
    options: ["80", "443"],
    provisional: "443",
    blocking: false,
  });
  expect(askInputFromTool({ question: "Quel port ?" }, true)).toEqual({
    title: "Quel port ?",
    context: "",
    options: [],
    provisional: null,
    blocking: true,
  });
  expect(askInputFromTool({ question: "" }, true)).toBeNull();
  expect(askInputFromTool({ question: "x", provisional: "Oui" }, false)).toBeNull();
  expect(askInputFromTool({ question: "x".repeat(300) }, true)?.title).toHaveLength(200);
  expect(askInputFromTool(null, true)).toBeNull();
});

test("answer prompts are deterministic and run counts split open from undelivered", () => {
  const confirmed = Question.parse({
    ...base,
    answer: { kind: "confirm", option: "Non", text: "", by: { kind: "human", ref: "adam" }, at: 2 },
  });
  expect(answerPrompt(confirmed)).toBe(
    "Réponse à ta question « Bloquer le dépôt sur une affaire archivée ? » : choix provisoire confirmé (Non).",
  );
  expect(
    answerPrompt({
      ...confirmed,
      answer: { ...HUMAN_TEXT, text: "Jamais" },
    }),
  ).toBe("Réponse à ta question « Bloquer le dépôt sur une affaire archivée ? » : Jamais");
  expect(
    countOpenByRun([Question.parse(base), confirmed, Question.parse({ ...base, id: "q2", runId: null })]),
  ).toEqual([{ runId: "r1", open: 1, undelivered: 1, latestTitle: base.title }]);
  expect(AnswerInput.safeParse({ kind: "option" }).success).toBe(true);
});

const HUMAN = { kind: "human", ref: "adam" } as const;
const answeredAt = (id: string, at: number, deliveredAt: number | null = null) =>
  Question.parse({
    ...base,
    id,
    title: `Question ${id}`,
    answer: {
      kind: "text",
      option: null,
      text: `Réponse ${id}`,
      by: HUMAN,
      at,
      deliveredAt,
      deliveredRunId: deliveredAt === null ? null : "r9",
    },
  });

test("an answer stored before delivery tracking parses as not delivered", () => {
  const legacy = Question.parse({
    ...base,
    answer: { kind: "confirm", option: "Non", text: "", by: HUMAN, at: 2 },
  });
  expect(legacy.answer).toMatchObject({ deliveredAt: null, deliveredRunId: null });
  expect(
    Question.safeParse({
      ...base,
      answer: { kind: "confirm", option: "Non", text: "", by: HUMAN, at: 2, deliveredAt: 3 },
    }).success,
  ).toBe(false);
});

test("undelivered answers of a ticket come in answer order, open and delivered ones aside", () => {
  const late = answeredAt("q3", 30);
  const early = answeredAt("q2", 20);
  const delivered = answeredAt("q4", 10, 11);
  const open = Question.parse({ ...base, id: "q1" });
  const other = { ...answeredAt("q5", 5), ticketId: "t2" };
  expect(undeliveredAnswers([late, open, delivered, early, other], "t1").map((q) => q.id)).toEqual([
    "q2",
    "q3",
  ]);
  expect(deliveryPrompt([early, late])).toBe(`${answerPrompt(early)}\n${answerPrompt(late)}`);
  expect(DeliveryResult.parse({ sent: 2, runId: "r1" })).toEqual({ sent: 2, runId: "r1" });
});

test("run counts carry the answers still to deliver", () => {
  const open = Question.parse({ ...base, id: "q1", createdAt: 1 });
  const waiting = { ...answeredAt("q2", 20), runId: "r2" };
  const delivered = { ...answeredAt("q3", 30, 31), runId: "r3" };
  expect(countOpenByRun([open, waiting, delivered, answeredAt("q4", 40)])).toEqual([
    { runId: "r1", open: 1, undelivered: 1, latestTitle: base.title },
    { runId: "r2", open: 0, undelivered: 1, latestTitle: null },
  ]);
});

test("marking answers delivered is reserved to the daemon, delivering them is an rpc", () => {
  expect(isReservedCommand("markAnswersDelivered")).toBe(true);
  expect(
    ProjectCommand.parse({
      method: "markAnswersDelivered",
      ticketId: "t1",
      questionIds: ["q1"],
      runId: "r1",
      at: 5,
    }),
  ).toMatchObject({ method: "markAnswersDelivered" });
  expect(RpcRequest.parse({ method: "deliverAnswers", projectId: "p1", ticketId: "t1" })).toEqual({
    method: "deliverAnswers",
    projectId: "p1",
    ticketId: "t1",
  });
});
