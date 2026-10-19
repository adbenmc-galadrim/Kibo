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

export type AnswerWake = (projectId: string, questionId: string) => void;

export type QuestionEventDeps = {
  emit(message: ChangeMessage): void;
  images: Pick<QuestionImagesPort, "remove"> | null;
  wake: AnswerWake | null;
};

const removedIds = (done: readonly CommandEvent[]): string[] =>
  done.flatMap((e) => (e.command.method === "removeQuestion" ? [e.command.questionId] : []));

function humanAnswer(e: CommandEvent): string | null {
  if (e.meta.origin !== "user") return null;
  const { command } = e;
  if (command.method !== "answerQuestion" && command.method !== "updateAnswer") return null;
  return command.by.kind === "human" ? command.questionId : null;
}

export function afterQuestionCommands(done: readonly CommandEvent[], deps: QuestionEventDeps): void {
  if (!done.some((e) => TOUCHING.has(e.command.method))) return;
  deps.emit({ topic: "agents" });
  for (const questionId of removedIds(done)) deps.images?.remove(questionId);
  for (const e of done) {
    const questionId = humanAnswer(e);
    if (questionId !== null) deps.wake?.(e.projectId, questionId);
  }
}
