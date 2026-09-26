import type { CommitDefaults, ProjectSnapshot } from "@kibo/schema";

export type MessageTicket = { key: string | null; title: string };

const TRAILING_PAREN = /\s*\([^()]*\)\s*$/;

export function ticketKeyFromBranch(branch: string | null, projectKey: string): string | null {
  if (!branch) return null;
  const match = new RegExp(`(?:^|[/_.-])(${projectKey})-(\\d+)(?=$|[/_.-])`, "i").exec(branch);
  return match ? `${projectKey}-${Number(match[2])}` : null;
}

function lowerFirst(title: string): string {
  const [first, second] = [...title];
  if (!first) return title;
  const secondIsUpper = second !== undefined && second !== second.toLowerCase();
  return secondIsUpper ? title : first.toLowerCase() + title.slice(first.length);
}

function bulletList(items: string[]): string {
  return items.map((item) => `- ${item}`).join("\n");
}

export function commitSubject(ticket: MessageTicket, scope: string | null): string {
  const stripped = ticket.title.replace(TRAILING_PAREN, "").trim();
  const title = lowerFirst(stripped || ticket.title.trim());
  return `feat${scope ? `(${scope})` : ""}: ${title} (${ticket.key ?? "…"})`;
}

export function commitMessage(input: {
  ticket: MessageTicket | null;
  scope: string | null;
  doneChildren: string[];
}): string {
  if (!input.ticket) return "";
  const subject = commitSubject(input.ticket, input.scope);
  if (input.doneChildren.length === 0) return subject;
  return `${subject}\n\n${bulletList(input.doneChildren)}`;
}

export function prBody(input: {
  ticket: MessageTicket | null;
  commitSubjects: string[];
  children: { key: string; done: boolean }[];
  mockupUrl: string | null;
}): string {
  const sections: string[] = [];
  if (input.ticket) sections.push(`## Ticket\n${input.ticket.key ?? "…"} · ${input.ticket.title}`);
  if (input.commitSubjects.length > 0) sections.push(`## Changements\n${bulletList(input.commitSubjects)}`);
  if (input.children.length > 0)
    sections.push(
      `## Sous-tickets\n${input.children.map((c) => `- [${c.done ? "x" : " "}] ${c.key}`).join("\n")}`,
    );
  if (input.mockupUrl) sections.push(`## Maquette\n${input.mockupUrl}`);
  return sections.join("\n\n");
}

export function commitDefaults(
  snapshot: ProjectSnapshot,
  branch: string | null,
  commitSubjects: string[],
): CommitDefaults {
  const key = ticketKeyFromBranch(branch, snapshot.meta.key);
  const ticket = key ? (snapshot.tickets.find((t) => t.key === key) ?? null) : null;
  const children = ticket ? snapshot.tickets.filter((t) => t.parentId === ticket.id) : [];
  return {
    ticketId: ticket?.id ?? null,
    ticketKey: ticket?.key ?? null,
    message: commitMessage({
      ticket,
      scope: null,
      doneChildren: children.filter((c) => c.statusId === "done").map((c) => c.title),
    }),
    prTitle: ticket ? commitSubject(ticket, null) : (commitSubjects[0] ?? ""),
    prBody: prBody({
      ticket,
      commitSubjects,
      children: children.map((c) => ({ key: c.keyLabel, done: c.statusId === "done" })),
      mockupUrl: null,
    }),
  };
}
