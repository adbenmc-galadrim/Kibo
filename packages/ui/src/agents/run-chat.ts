import { isTerminal, type RunView, type StatusId } from "@kibo/schema";

export type ChatBox = { mode: "answer" | "write"; pending: boolean };

const REVIEWABLE: readonly StatusId[] = ["backlog", "todo", "in_progress"];

export function chatBox(run: RunView, resumable: boolean): ChatBox | null {
  if (run.state === "waiting_input") return { mode: "answer", pending: false };
  if (run.ticketId === null) return null;
  if (!isTerminal(run.state)) return { mode: "write", pending: true };
  return resumable ? { mode: "write", pending: false } : null;
}

export const canSendToReview = (status: StatusId | null): boolean =>
  status !== null && REVIEWABLE.includes(status);
