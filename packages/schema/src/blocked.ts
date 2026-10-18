import { isOpen as isOpenQuestion, type Question } from "./question";
import { FINAL_STATUSES, NOT_STARTED_STATUSES } from "./startable";
import type { Ticket } from "./ticket";

type Openable = Pick<Ticket, "statusId"> | Question;
type Held = Pick<Ticket, "id"> & Partial<Pick<Ticket, "parentId" | "statusId">>;
type Blockable = Pick<Ticket, "id" | "statusId"> & Partial<Pick<Ticket, "parentId">>;

const ownQuestion = (ticketId: string, questions: readonly Question[]): Question | null =>
  questions.find((q) => q.ticketId === ticketId && q.blocking && isOpenQuestion(q)) ?? null;

const featureQuestion = (ticket: Held, questions: readonly Question[]): Question | null => {
  const parentId = ticket.parentId ?? null;
  if (parentId === null || (ticket.statusId !== undefined && FINAL_STATUSES.includes(ticket.statusId)))
    return null;
  return ownQuestion(parentId, questions);
};

export const blockingQuestion = (ticket: Held, questions: readonly Question[]): Question | null =>
  ownQuestion(ticket.id, questions) ?? featureQuestion(ticket, questions);

export const isBlocked = (ticket: Blockable, questions: readonly Question[]): boolean =>
  ticket.statusId === "blocked" ||
  ownQuestion(ticket.id, questions) !== null ||
  (NOT_STARTED_STATUSES.includes(ticket.statusId) && featureQuestion(ticket, questions) !== null);

export const isOpen = (item: Openable): boolean =>
  "statusId" in item ? item.statusId !== "done" : isOpenQuestion(item);

export const openCount = (tickets: readonly Pick<Ticket, "statusId">[]): number =>
  tickets.filter(isOpen).length;

export const blockedCount = (tickets: readonly Blockable[], questions: readonly Question[]): number =>
  tickets.filter((t) => isBlocked(t, questions)).length;
