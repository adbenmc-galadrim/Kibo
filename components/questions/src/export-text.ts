import { DAY_MS, dayNumber, type Question, questionLabel } from "@kibo/schema";
import { fr } from "./fr";
import { plainText } from "./plain-text";
import { isOpenBlocking } from "./questions-logic";
import type { Impact } from "./ticket-feature";

export type ExportEntry = { question: Question; impact: Impact };

const t = fr.exportText;
const INDENT = "   ";
const DATE = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", year: "numeric" });

export const exportDate = (at: number): string => DATE.format(at);

const WEEK_DAY = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", timeZone: "UTC" });

const weekDay = (date: string): string => WEEK_DAY.format(dayNumber(date) * DAY_MS);

export const impactLine = (q: Pick<Question, "blocking">, impact: Impact): string =>
  `${q.blocking ? t.blocks(impact.feature) : t.for(impact.feature)}, ${
    impact.week === null ? t.unplanned : t.planned(weekDay(impact.week))
  }`;

const QN = /^Q(\d+)$/;

const rankOf = (q: Question): number => Number(QN.exec(questionLabel(q))?.[1] ?? Number.POSITIVE_INFINITY);

export const byExportOrder = (a: Question, b: Question): number =>
  Number(isOpenBlocking(b)) - Number(isOpenBlocking(a)) || rankOf(a) - rankOf(b) || a.createdAt - b.createdAt;

function contextLines(context: string): string[] {
  const [first, ...rest] = plainText(context);
  return first === undefined ? [] : [`${t.context} : ${first}`, ...rest];
}

export function exportQuestionText({ question: q, impact }: ExportEntry): string {
  const details = [
    impactLine(q, impact),
    ...contextLines(q.context),
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
