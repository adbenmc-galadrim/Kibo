import { type ChangeMessage, type ProjectCommand, Question } from "@kibo/schema";
import { deliverBlockingAnswer } from "../agents/question-delivery";
import { type AgentQuestions, type AgentsPort, deliveryDeps } from "../agents-rpc";
import type { CommandEvent } from "../docs";

const TOUCHING: ReadonlySet<ProjectCommand["method"]> = new Set([
  "createQuestion",
  "answerQuestion",
  "removeQuestion",
  "markAnswersDelivered",
  "deleteTicket",
]);

export type QuestionEventDeps = {
  emit(message: ChangeMessage): void;
  agents: AgentsPort | null;
  questions: AgentQuestions;
};

const answeredByUser = (done: readonly CommandEvent[]): Question[] =>
  done.flatMap((e) =>
    e.command.method === "answerQuestion" && e.meta.origin === "user" ? [Question.parse(e.result)] : [],
  );

export function afterQuestionCommands(done: readonly CommandEvent[], deps: QuestionEventDeps): void {
  if (!done.some((e) => TOUCHING.has(e.command.method))) return;
  deps.emit({ topic: "agents" });
  const { agents } = deps;
  if (!agents) return;
  for (const question of answeredByUser(done))
    deliverBlockingAnswer(deliveryDeps(agents, deps.questions), question);
}
