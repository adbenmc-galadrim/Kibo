import {
  type Actor,
  type DeliveryResult,
  deliveryPrompt,
  KiboError,
  mainSessionOf,
  type RunView,
} from "@kibo/schema";
import { assertTicketExecution, isTicketRun, type TicketExecution } from "./execution-removed";
import type { AgentDataPort } from "./orchestrator-types";

export type DeliveryDeps = {
  ticketExecution: TicketExecution;
  runs: () => RunView[];
  answer: (runId: string, text: string) => RunView;
  data: Pick<AgentDataPort, "undeliveredAnswers" | "markAnswersDelivered" | "answerRunQuestion">;
};

export function deliverAnswers(deps: DeliveryDeps, projectId: string, ticketId: string): DeliveryResult {
  assertTicketExecution(deps.ticketExecution, "deliverAnswers");
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

export function answerFromDrawer(deps: DeliveryDeps, run: RunView, text: string, by: Actor): RunView {
  if (isTicketRun(run)) assertTicketExecution(deps.ticketExecution, "answerRun");
  const question =
    run.state === "waiting_input" && run.projectId
      ? deps.data.answerRunQuestion(run.projectId, run.id, text, by)
      : null;
  const answered = deps.answer(run.id, text);
  if (question && run.projectId)
    deps.data.markAnswersDelivered(run.projectId, question.ticketId, [question.id], run.id);
  return answered;
}
