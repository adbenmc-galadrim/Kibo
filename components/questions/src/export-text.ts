import { type Question, questionLabel } from "@kibo/schema";
import { fr } from "./fr";
import type { Impact } from "./ticket-feature";

export type ExportEntry = { question: Question; impact: Impact };

const t = fr.exportText;
const INDENT = "   ";
const DATE = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", year: "numeric" });

export const exportDate = (at: number): string => DATE.format(at);

export const impactLine = (q: Pick<Question, "blocking">, impact: Impact): string =>
  `${q.blocking ? t.blocks(impact.feature) : t.for(impact.feature)}, ${
    impact.sprint === null ? t.unplanned : t.planned(impact.sprint)
  }`;

export function exportQuestionText({ question: q, impact }: ExportEntry): string {
  const context = q.context.trim();
  const details = [
    impactLine(q, impact),
    ...(context === "" ? [] : [`${t.context} : ${context}`]),
    ...(q.options.length === 0 ? [] : [`${t.options} : ${q.options.join(" · ")}`]),
    ...(q.provisional === null ? [] : [`${t.provisional} : ${q.provisional}`]),
  ];
  return [`${questionLabel(q)} · ${q.title}`, ...details.map((line) => `${INDENT}${line}`)].join("\n");
}

export function exportAll(recipient: string, date: string, entries: readonly ExportEntry[]): string {
  return [t.header(recipient, date), ...entries.map(exportQuestionText)].join("\n\n");
}

const DAY_MONTH = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short" });

export const dayMonth = (at: number): string => DAY_MONTH.format(at);

export function exportLabels(
  recipientId: string,
  name: string,
  count: number,
): { label: string; summary: string } {
  return recipientId === "client"
    ? { label: fr.exporting.forClient(count), summary: fr.exporting.clientCount(count) }
    : { label: fr.exporting.forRecipient(name, count), summary: fr.exporting.recipientCount(name, count) };
}
