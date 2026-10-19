import type { ChangeMessage, ProjectCommand } from "@kibo/schema";
import type { CommandEvent } from "../docs";
import type { QuestionImagesPort } from "./question-images-port";

const TOUCHING: ReadonlySet<ProjectCommand["method"]> = new Set([
  "createQuestion",
  "answerQuestion",
  "removeQuestion",
  "updateQuestion",
  "updateAnswer",
  "reopenQuestion",
  "archiveQuestion",
  "restoreQuestion",
  "remindQuestion",
  "markAnswersDelivered",
  "deleteTicket",
]);

export type QuestionEventDeps = {
  emit(message: ChangeMessage): void;
  images: Pick<QuestionImagesPort, "remove"> | null;
};

const removedIds = (done: readonly CommandEvent[]): string[] =>
  done.flatMap((e) => (e.command.method === "removeQuestion" ? [e.command.questionId] : []));

export function afterQuestionCommands(done: readonly CommandEvent[], deps: QuestionEventDeps): void {
  if (!done.some((e) => TOUCHING.has(e.command.method))) return;
  deps.emit({ topic: "agents" });
  for (const questionId of removedIds(done)) deps.images?.remove(questionId);
}
