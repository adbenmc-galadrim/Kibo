import { featureLabel, type ProjectSnapshot, questionLabel, type TicketView } from "@kibo/schema";
import { frProjectAgent } from "../i18n/fr-project-agent";

const t = frProjectAgent.reminder;

function rootOf(tickets: readonly TicketView[], ticket: TicketView): TicketView {
  let current = ticket;
  for (let parent = tickets.find((x) => x.id === current.parentId); parent; ) {
    current = parent;
    parent = tickets.find((x) => x.id === current.parentId);
  }
  return current;
}

function featureLine(project: ProjectSnapshot, ticketId: string, blocking: boolean): string | null {
  const ticket = project.tickets.find((x) => x.id === ticketId);
  if (!ticket) return null;
  const feature = rootOf(project.tickets, ticket);
  const name = `${featureLabel(feature)} · ${feature.title}`;
  const sprint = project.sprints.find((s) => s.id === feature.sprintId)?.code ?? null;
  return `${blocking ? t.blocks(name) : t.concerns(name)}${sprint ? t.planned(sprint) : ""}.`;
}

export function reminderText(project: ProjectSnapshot, questionId: string): string | null {
  const question = project.questions.find((q) => q.id === questionId);
  if (!question) return null;
  const feature = featureLine(project, question.ticketId, question.blocking);
  return [
    t.greeting,
    t.about(`${questionLabel(question)} · ${question.title}`),
    ...(feature ? [feature] : []),
    t.closing,
  ].join("\n");
}
