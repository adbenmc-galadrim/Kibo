import { isTerminal, type RunView, type StatusId } from "@kibo/schema";

export type ChatBox = { mode: "answer" | "write"; busy: boolean };

const REVIEWABLE: readonly StatusId[] = ["backlog", "todo", "in_progress"];

export function chatBox(run: RunView, resumable: boolean): ChatBox | null {
  if (run.state === "waiting_input") return { mode: "answer", busy: false };
  if (run.ticketId === null) return null;
  if (!isTerminal(run.state)) return { mode: "write", busy: true };
  return resumable ? { mode: "write", busy: false } : null;
}

export const canSendToReview = (status: StatusId | null): boolean =>
  status !== null && REVIEWABLE.includes(status);
