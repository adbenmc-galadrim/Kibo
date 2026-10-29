import { describe, expect, test } from "bun:test";
import { answerInputOf } from "./answer-input";

describe("answerInputOf", () => {
  test("a text equal to an option is an option answer", () => {
    expect(answerInputOf({ options: ["A", "B"] }, "B")).toEqual({ kind: "option", option: "B" });
  });

  test("any other text is a text answer", () => {
    expect(answerInputOf({ options: ["A", "B"] }, "C plutôt")).toEqual({ kind: "text", text: "C plutôt" });
    expect(answerInputOf({ options: [] }, "A")).toEqual({ kind: "text", text: "A" });
  });
});
