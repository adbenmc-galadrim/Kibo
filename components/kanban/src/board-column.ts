import { blockingQuestion, type Question, questionLabel, type StatusId, type Ticket } from "@kibo/schema";
import { fr } from "./fr";

export function boardColumn(
  ticket: Pick<Ticket, "statusId">,
  blocked: boolean,
  columns: ReadonlySet<StatusId>,
): StatusId {
  if (!blocked || ticket.statusId === "done" || !columns.has("blocked")) return ticket.statusId;
  return "blocked";
}

export const heldByQuestion = (column: StatusId, target: StatusId, question: string | null): string | null =>
  column === "blocked" && target !== "blocked" ? question : null;

export function holdMessage(
  ticket: Pick<Ticket, "id">,
  column: StatusId,
  target: StatusId,
  questions: readonly Question[],
): string | null {
  const question = blockingQuestion(ticket, questions);
  const held = heldByQuestion(column, target, question === null ? null : questionLabel(question));
  return held === null ? null : fr.heldByQuestion(held);
}
