import { blockingQuestion, type Question, questionLabel, type StatusId, type Ticket } from "@kibo/schema";

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

export function heldBy(
  ticket: Pick<Ticket, "id">,
  column: StatusId,
  target: StatusId,
  questions: readonly Question[],
): Question | null {
  const question = blockingQuestion(ticket, questions);
  if (question === null) return null;
  return heldByQuestion(column, target, questionLabel(question)) === null ? null : question;
}
