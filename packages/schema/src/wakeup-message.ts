import type { QuestionAnswer } from "./question-fields";
import { isWakeupMessage, WAKEUP_PREFIX } from "./signal";

export const ANSWER_QUOTE_MAX = 120;

export type AnsweredLine = { label: string; quote: string };

const ANSWERED_LINE = /^- (Q\d+|Q\?) répondue : « (.*) »$/;

function bounded(text: string): string {
  const points = [...text];
  return points.length > ANSWER_QUOTE_MAX ? `${points.slice(0, ANSWER_QUOTE_MAX - 1).join("")}…` : text;
}

export function answerQuote(answer: QuestionAnswer): string {
  const raw = answer.kind === "text" ? answer.text : (answer.option ?? answer.text);
  const folded = raw.replace(/\s+/g, " ").trim();
  return folded ? bounded(folded) : "(vide)";
}

export const answeredLine = (line: AnsweredLine): string => `- ${line.label} répondue : « ${line.quote} »`;

export function wakeupAnswers(text: string): AnsweredLine[] {
  if (!isWakeupMessage(text)) return [];
  return text
    .slice(WAKEUP_PREFIX.length)
    .split("\n")
    .flatMap((line) => {
      const match = ANSWERED_LINE.exec(line);
      const label = match?.[1];
      const quote = match?.[2];
      return label === undefined || quote === undefined ? [] : [{ label, quote }];
    });
}
