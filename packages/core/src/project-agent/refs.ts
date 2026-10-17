import { NewRef, type ProposedAction, type SignalRef } from "@kibo/schema";

export const isNewRef = (ref: string): boolean => NewRef.safeParse(ref).success;

export function ticketRefsOf(action: ProposedAction): string[] {
  switch (action.type) {
    case "createTicket":
      return action.parent === undefined ? [] : [action.parent];
    case "updateTicket":
      return typeof action.parent === "string" ? [action.ticket, action.parent] : [action.ticket];
    case "setStatus":
    case "setSprint":
    case "assignAgent":
    case "deliverAnswers":
    case "createQuestion":
      return [action.ticket];
    case "updateQuestion":
      return action.ticket === undefined ? [] : [action.ticket];
    case "link":
    case "unlink":
      return [action.from, action.to];
    case "cancelRun":
    case "answerQuestion":
    case "reopenQuestion":
    case "deleteQuestion":
    case "addRecipient":
    case "createNote":
    case "updateNote":
    case "dismissSignal":
    case "createSprint":
    case "remindQuestion":
      return [];
  }
}

export const signalRefsOf = (action: ProposedAction): SignalRef[] => [
  ...(action.signals ?? []),
  ...(action.type === "dismissSignal" ? [action.signal] : []),
];
