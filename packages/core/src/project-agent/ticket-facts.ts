import {
  assigneeName,
  branchRefOf,
  type ExternalRef,
  type GithubPrRef,
  isOpen,
  type ProjectSnapshot,
  type Question,
  type Ticket,
} from "@kibo/schema";

export const assigneeOf = (ticket: Pick<Ticket, "assignee">): string | null =>
  ticket.assignee ? assigneeName(ticket.assignee) : null;

export const branchOf = (refs: readonly ExternalRef[]): string | null => branchRefOf(refs)?.branch ?? null;

export function prOf(refs: readonly ExternalRef[]): string | null {
  const prs = refs.filter((r): r is GithubPrRef => r.kind === "github_pr");
  const last = prs.at(-1);
  return last ? `#${last.number} (${last.state})` : null;
}

export const truncate = (text: string, max: number): string =>
  text.length <= max ? text : `${text.slice(0, max - 1)}…`;

export function answerText(q: Pick<Question, "answer">): string | null {
  const { answer } = q;
  if (!answer) return null;
  return answer.kind === "text" ? answer.text : (answer.option ?? "");
}

export const questionState = (q: Question): "open" | "answered" => (isOpen(q) ? "open" : "answered");

export const ticketKeyOf = (project: ProjectSnapshot, ticketId: string): string =>
  project.tickets.find((t) => t.id === ticketId)?.keyLabel ?? ticketId;
