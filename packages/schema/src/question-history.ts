import { z } from "zod";
import { NodeId } from "./ids";
import {
  Actor,
  QuestionAnswer,
  QuestionContext,
  QuestionOption,
  QuestionOptions,
  QuestionTitle,
} from "./question-fields";
import { RecipientId } from "./question-recipient";

export const QUESTION_HISTORY_MAX = 20;

export const QuestionEventKind = z.enum([
  "updated",
  "answer_edited",
  "reopened",
  "archived",
  "restored",
  "reminded",
]);
export type QuestionEventKind = z.infer<typeof QuestionEventKind>;

export const QuestionPrevious = z
  .object({
    title: QuestionTitle,
    context: QuestionContext,
    options: QuestionOptions,
    provisional: QuestionOption.nullable(),
    ticketId: NodeId,
    recipient: RecipientId,
    answer: QuestionAnswer.nullable(),
  })
  .partial();
export type QuestionPrevious = z.infer<typeof QuestionPrevious>;

export const QuestionEvent = z.object({
  kind: QuestionEventKind,
  at: z.number().int(),
  by: Actor,
  previous: QuestionPrevious,
});
export type QuestionEvent = z.infer<typeof QuestionEvent>;

export function pushEvent(history: readonly QuestionEvent[], event: QuestionEvent): QuestionEvent[] {
  return [...history, event].slice(-QUESTION_HISTORY_MAX);
}
