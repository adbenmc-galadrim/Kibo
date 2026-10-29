import { type Actor, KiboError, type RunView } from "@kibo/schema";
import type { AgentDataPort } from "../runs/orchestrator-types";

export type DeliveryDeps = {
  answer: (runId: string, text: string) => RunView;
  data: Pick<AgentDataPort, "undeliveredAnswers" | "markAnswersDelivered" | "answerRunQuestion">;
};

const removed = (what: string) =>
  new KiboError("AGENT_EXECUTION_REMOVED", `${what}: Kibo no longer runs ticket agents`);

export function deliverAnswers(): never {
  throw removed("deliverAnswers");
}

export function answerFromDrawer(deps: DeliveryDeps, run: RunView, text: string, by: Actor): RunView {
  if (run.kind === "ticket" && run.ticketId !== null) throw removed("answerRun");
  const question =
    run.state === "waiting_input" && run.projectId
      ? deps.data.answerRunQuestion(run.projectId, run.id, text, by)
      : null;
  const answered = deps.answer(run.id, text);
  if (question && run.projectId)
    deps.data.markAnswersDelivered(run.projectId, question.ticketId, [question.id], run.id);
  return answered;
}
