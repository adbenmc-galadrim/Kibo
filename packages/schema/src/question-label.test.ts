import { expect, test } from "bun:test";
import { Question } from "./question";
import { questionLabel } from "./question-label";

const ref = (source: string, id: string) => ({ kind: "import_ref" as const, source, id });

test("a question is named Qn by its import, else by its number", () => {
  expect(questionLabel({ number: null, importRef: ref("plan", "Q14") })).toBe("Q14");
  expect(questionLabel({ number: 3, importRef: ref("plan", "Q14") })).toBe("Q14");
  expect(questionLabel({ number: 3, importRef: null })).toBe("Q3");
  expect(questionLabel({ number: 7, importRef: ref("todo", "DATA-1") })).toBe("Q7");
  expect(questionLabel({ number: null, importRef: ref("todo", "DATA-1") })).toBe("Q?");
  expect(questionLabel({ number: null, importRef: null })).toBe("Q?");
});

test("a question without a number reads as null, a number is positive", () => {
  const base = {
    id: "q1",
    ticketId: "t1",
    runId: null,
    title: "Format des PDF ?",
    context: "",
    options: [],
    provisional: null,
    blocking: true,
    createdBy: { kind: "human", ref: "adam" },
    createdAt: 1,
    answer: null,
  };
  expect(Question.parse(base).number).toBeNull();
  expect(Question.parse({ ...base, number: 4 }).number).toBe(4);
  expect(Question.safeParse({ ...base, number: 0 }).success).toBe(false);
  expect(Question.safeParse({ ...base, number: 1.5 }).success).toBe(false);
});
