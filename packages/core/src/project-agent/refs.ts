import { NewRef, type ProposedAction } from "@kibo/schema";

export const isNewRef = (ref: string): boolean => NewRef.safeParse(ref).success;

export function ticketRefsOf(action: ProposedAction): string[] {
  switch (action.type) {
    case "createTicket":
      return action.parent === undefined ? [] : [action.parent];
    case "updateTicket":
      return typeof action.parent === "string" ? [action.ticket, action.parent] : [action.ticket];
    case "setStatus":
    case "assignAgent":
    case "deliverAnswers":
    case "createQuestion":
      return [action.ticket];
    case "link":
    case "unlink":
      return [action.from, action.to];
    case "cancelRun":
    case "answerQuestion":
    case "createNote":
    case "updateNote":
      return [];
  }
}
