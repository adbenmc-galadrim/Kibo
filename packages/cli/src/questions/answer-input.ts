import type { AnswerInput, Question } from "@kibo/schema";

export function answerInputOf(question: Pick<Question, "options">, text: string): AnswerInput {
  return question.options.includes(text) ? { kind: "option", option: text } : { kind: "text", text };
}
