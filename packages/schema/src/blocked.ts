import { isOpen as isOpenQuestion, type Question } from "./question";
import type { Ticket } from "./ticket";

type Openable = Pick<Ticket, "statusId"> | Question;

export const blockingQuestion = (
  ticket: Pick<Ticket, "id">,
  questions: readonly Question[],
): Question | null =>
  questions.find((q) => q.ticketId === ticket.id && q.blocking && isOpenQuestion(q)) ?? null;

export const isBlocked = (ticket: Pick<Ticket, "id" | "statusId">, questions: readonly Question[]): boolean =>
  ticket.statusId === "blocked" || blockingQuestion(ticket, questions) !== null;

export const isOpen = (item: Openable): boolean =>
  "statusId" in item ? item.statusId !== "done" : isOpenQuestion(item);

export const openCount = (tickets: readonly Pick<Ticket, "statusId">[]): number =>
  tickets.filter(isOpen).length;

export const blockedCount = (
  tickets: readonly Pick<Ticket, "id" | "statusId">[],
  questions: readonly Question[],
): number => tickets.filter((t) => isBlocked(t, questions)).length;
