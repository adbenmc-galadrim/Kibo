import {
  branchRefOf,
  type ExternalRef,
  type GithubPrRef,
  type ProjectSnapshot,
  type Question,
  type Ticket,
} from "@kibo/schema";

export const assigneeOf = (ticket: Pick<Ticket, "assignee">): string | null => ticket.assignee?.ref ?? null;

export const branchOf = (refs: readonly ExternalRef[]): string | null => branchRefOf(refs)?.branch ?? null;

export function prOf(refs: readonly ExternalRef[]): string | null {
  const prs = refs.filter((r): r is GithubPrRef => r.kind === "github_pr");
  const last = prs.at(-1);
  return last ? `#${last.number} (${last.state})` : null;
}

export const truncate = (text: string, max: number): string =>
  text.length <= max ? text : `${text.slice(0, max - 1)}…`;

export function answerText(q: Question): string | null {
  if (q.answer === null) return null;
  return q.answer.kind === "text" ? q.answer.text : (q.answer.option ?? "");
}

export const ticketKeyOf = (project: ProjectSnapshot, ticketId: string): string =>
  project.tickets.find((t) => t.id === ticketId)?.keyLabel ?? ticketId;
