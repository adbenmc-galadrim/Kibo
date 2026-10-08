import {
  type Actor,
  answerPrompt,
  type DeliveryResult,
  deliveryPrompt,
  KiboError,
  mainSessionOf,
  type Question,
  type RunView,
} from "@kibo/schema";
import type { AgentDataPort } from "./orchestrator-types";

export type DeliveryDeps = {
  runs: () => RunView[];
  answer: (runId: string, text: string) => RunView;
  data: Pick<AgentDataPort, "undeliveredAnswers" | "markAnswersDelivered" | "answerRunQuestion">;
};

export function deliverAnswers(deps: DeliveryDeps, projectId: string, ticketId: string): DeliveryResult {
  const answers = deps.data.undeliveredAnswers(projectId, ticketId);
  if (answers.length === 0) return { sent: 0, runId: null };
  const main = mainSessionOf(deps.runs(), ticketId);
  if (!main) throw new KiboError("INVALID_TRANSITION", `ticket ${ticketId} has no session to resume`);
  const run = deps.answer(main.id, deliveryPrompt(answers));
  deps.data.markAnswersDelivered(
    projectId,
    ticketId,
    answers.map((q) => q.id),
    run.id,
  );
  return { sent: answers.length, runId: run.id };
}

export function deliverBlockingAnswer(deps: DeliveryDeps, question: Question): boolean {
  if (!question.blocking || question.answer === null || question.answer.deliveredAt !== null) return false;
  const run = deps.runs().find((r) => r.id === question.runId);
  if (!run?.projectId || run.state !== "waiting_input") return false;
  deps.answer(run.id, answerPrompt(question));
  deps.data.markAnswersDelivered(run.projectId, question.ticketId, [question.id], run.id);
  return true;
}

export function answerFromDrawer(deps: DeliveryDeps, run: RunView, text: string, by: Actor): RunView {
  if (run.state === "waiting_input" && run.projectId) {
    const question = deps.data.answerRunQuestion(run.projectId, run.id, text, by);
    if (question) deps.data.markAnswersDelivered(run.projectId, question.ticketId, [question.id], run.id);
  }
  return deps.answer(run.id, text);
}
