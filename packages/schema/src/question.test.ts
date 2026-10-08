import { expect, test } from "bun:test";
import fc from "fast-check";
import { KiboError } from "./errors";
import {
  AnswerInput,
  answerPrompt,
  askInputFromTool,
  countOpenByRun,
  isOpen,
  Question,
  resolveAnswer,
} from "./question";

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

test("answer prompts are deterministic and run counts ignore answered questions", () => {
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
      answer: { kind: "text", option: null, text: "Jamais", by: { kind: "human", ref: "adam" }, at: 2 },
    }),
  ).toBe("Réponse à ta question « Bloquer le dépôt sur une affaire archivée ? » : Jamais");
  expect(
    countOpenByRun([Question.parse(base), confirmed, Question.parse({ ...base, id: "q2", runId: null })]),
  ).toEqual([{ runId: "r1", open: 1, latestTitle: base.title }]);
  expect(AnswerInput.safeParse({ kind: "option" }).success).toBe(true);
});
