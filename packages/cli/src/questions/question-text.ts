import { frQuestions } from "../fr-questions";
import type { QuestionSummary } from "./question-view";

export const questionLabel = (q: { number: number | null; id: string }): string => `#${q.number ?? q.id}`;

function headLine(q: QuestionSummary): string {
  const blocking = q.blocking ? ` (${frQuestions.blocking})` : "";
  return `${questionLabel(q)} [${q.state}] ${q.title} → ${q.recipient.name}${blocking}`;
}

export function questionLines(questions: readonly QuestionSummary[]): string[] {
  return questions.flatMap((q) => [headLine(q), ...q.options.map((option) => `    - ${option}`)]);
}
