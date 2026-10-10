import type { Question, TicketView } from "@kibo/schema";
import { fr } from "./fr";

export type ExportTicket = Pick<TicketView, "keyLabel" | "title">;
export type ExportEntry = { question: Question; ticket: ExportTicket; recipient: string };

const t = fr.exportText;

export function exportQuestionText(q: Question, ticket: ExportTicket, recipient: string): string {
  const context = q.context.trim();
  return [
    `[${ticket.keyLabel}] ${ticket.title}`,
    `${t.question} : ${q.title}`,
    ...(context === "" ? [] : [`${t.context} : ${context}`]),
    ...(q.options.length === 0 ? [] : [`${t.options} : ${q.options.join(" · ")}`]),
    ...(q.provisional === null ? [] : [`${t.provisional} : ${q.provisional}`]),
    `${t.recipient} : ${recipient}`,
  ].join("\n");
}

export function exportAll(entries: readonly ExportEntry[]): string {
  return entries.map((e) => exportQuestionText(e.question, e.ticket, e.recipient)).join("\n\n");
}
