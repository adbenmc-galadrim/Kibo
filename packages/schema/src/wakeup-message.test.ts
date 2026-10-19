import { describe, expect, test } from "bun:test";
import type { QuestionAnswer } from "./question-fields";
import { WAKEUP_PREFIX, wakeupCount } from "./signal";
import { ANSWER_QUOTE_MAX, answeredLine, answerQuote, wakeupAnswers } from "./wakeup-message";

const answer = (over: Partial<QuestionAnswer>): QuestionAnswer => ({
  kind: "text",
  option: null,
  text: "",
  by: { kind: "human", ref: "adam" },
  at: 0,
  deliveredAt: null,
  deliveredRunId: null,
  ...over,
});

describe("answerQuote", () => {
  test("quotes the chosen or confirmed option", () => {
    expect(answerQuote(answer({ kind: "option", option: "5 Go", text: "" }))).toBe("5 Go");
    expect(answerQuote(answer({ kind: "confirm", option: "2 Go", text: "" }))).toBe("2 Go");
  });

  test("folds the blanks of a free text", () => {
    expect(answerQuote(answer({ text: "  Oui,\n 5 Go  (par client) " }))).toBe("Oui, 5 Go (par client)");
  });

  test("an empty answer is quoted as empty", () => {
    expect(answerQuote(answer({ text: "" }))).toBe("(vide)");
    expect(answerQuote(answer({ kind: "option", option: null, text: " " }))).toBe("(vide)");
  });

  test("bounds the quote", () => {
    const quote = answerQuote(answer({ text: "a".repeat(130) }));
    expect(quote).toBe(`${"a".repeat(ANSWER_QUOTE_MAX - 1)}…`);
    expect([...quote]).toHaveLength(ANSWER_QUOTE_MAX);
    expect(answerQuote(answer({ text: "a".repeat(ANSWER_QUOTE_MAX) }))).toBe("a".repeat(ANSWER_QUOTE_MAX));
  });
});

describe("answeredLine", () => {
  test("names the question and quotes its answer", () => {
    expect(answeredLine({ label: "Q16", quote: "5 Go" })).toBe("- Q16 répondue : « 5 Go »");
  });
});

describe("wakeupAnswers", () => {
  const lines = [
    { label: "Q16", quote: "5 Go" },
    { label: "Q17", quote: "oui « vraiment » (sans - doute)" },
  ];
  const message = [
    `${WAKEUP_PREFIX}2 réponses à lire.`,
    ...lines.map(answeredLine),
    "Lis chaque réponse.",
  ].join("\n");

  test("reads the answered lines back from the message", () => {
    expect(wakeupAnswers(message)).toEqual(lines);
  });

  test("reads nothing from another message", () => {
    expect(wakeupAnswers("Où en est-on ?")).toEqual([]);
    expect(wakeupAnswers("- Q16 répondue : « 5 Go »")).toEqual([]);
    expect(
      wakeupAnswers(`${WAKEUP_PREFIX}1 signal à traiter (1 blocage). Lis « Signaux à traiter ».`),
    ).toEqual([]);
  });

  test("the signal count survives the answers", () => {
    expect(wakeupCount(message)).toBeNull();
    expect(
      wakeupCount(
        `${WAKEUP_PREFIX}2 signaux à traiter (1 ticket à créer, 1 blocage) et 1 réponse à lire.\n- Q16 répondue : « 5 Go »`,
      ),
    ).toBe(2);
  });
});
