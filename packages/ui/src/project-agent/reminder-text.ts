import type { ProjectSnapshot } from "@kibo/schema";
import { clientImpact, impactLine } from "@kibo/sdk";
import { frProjectAgent } from "../i18n/fr-project-agent";

const t = frProjectAgent.reminder;

function impactSentence(project: ProjectSnapshot, ticketId: string, blocking: boolean): string | null {
  const ticket = project.tickets.find((x) => x.id === ticketId);
  if (!ticket) return null;
  const ticketOf = (id: string) => project.tickets.find((x) => x.id === id) ?? null;
  const line = impactLine({ blocking }, clientImpact(ticket, ticketOf, project.sprints));
  return blocking ? t.blocks(line) : t.concerns(line);
}

export function reminderText(project: ProjectSnapshot, questionId: string): string | null {
  const question = project.questions.find((q) => q.id === questionId);
  if (!question) return null;
  const impact = impactSentence(project, question.ticketId, question.blocking);
  return [t.greeting, t.about(question.title), ...(impact ? [impact] : []), t.closing].join("\n");
}
