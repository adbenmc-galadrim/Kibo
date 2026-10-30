import type { Question, QuestionAnswer, QuestionEvent, QuestionRecipient } from "@kibo/schema";
import { fr } from "./fr";
import { actorName, recipientName, relativeAge } from "./questions-logic";

type QuestionState = Required<QuestionEvent["previous"]>;
type HistoryEntry = { event: QuestionEvent; after: QuestionState; position: number };
export type HistoryContext = {
  recipients: readonly QuestionRecipient[];
  ticketLabel(ticketId: string): string;
  now: number;
};

const t = fr.historyLine;

const stateOf = (q: Question): QuestionState => ({
  title: q.title,
  context: q.context,
  options: q.options,
  provisional: q.provisional,
  ticketId: q.ticketId,
  recipient: q.recipient,
  answer: q.answer,
});

const withPrevious = (state: QuestionState, previous: QuestionEvent["previous"]): QuestionState => {
  const next: QuestionState = { ...state };
  for (const [field, value] of Object.entries(previous)) {
    if (value !== undefined) Object.assign(next, { [field]: value });
  }
  return next;
};

export function historyEntries(q: Question): HistoryEntry[] {
  const entries: HistoryEntry[] = [];
  let after = stateOf(q);
  for (let position = q.history.length - 1; position >= 0; position--) {
    const event = q.history[position];
    if (event === undefined) continue;
    entries.push({ event, after, position });
    after = withPrevious(after, event.previous);
  }
  return entries;
}

const answerText = (a: QuestionAnswer | null): string =>
  a === null ? t.noAnswer : a.kind === "text" ? a.text : (a.option ?? "");

function changes(entry: HistoryEntry, ctx: HistoryContext): string {
  const { previous } = entry.event;
  const after = entry.after;
  const parts: string[] = [];
  if (previous.title !== undefined) parts.push(t.title(previous.title, after.title));
  if (previous.context !== undefined) parts.push(t.context);
  if (previous.options !== undefined)
    parts.push(t.change(t.fields.options, previous.options.join(" · "), after.options.join(" · ")));
  if (previous.provisional !== undefined)
    parts.push(t.change(t.fields.provisional, previous.provisional ?? t.none, after.provisional ?? t.none));
  if (previous.ticketId !== undefined)
    parts.push(
      t.change(t.fields.ticket, ctx.ticketLabel(previous.ticketId), ctx.ticketLabel(after.ticketId)),
    );
  if (previous.recipient !== undefined) {
    const name = (id: string) => recipientName(ctx.recipients, id);
    parts.push(t.change(t.fields.recipient, name(previous.recipient), name(after.recipient)));
  }
  return parts.join(" ; ");
}

function what(entry: HistoryEntry, ctx: HistoryContext): string {
  const { event } = entry;
  switch (event.kind) {
    case "updated":
      return t.updated(changes(entry, ctx));
    case "reopened":
      return t.reopened(answerText(event.previous.answer ?? null));
    case "answer_edited":
      return t.answerEdited(answerText(event.previous.answer ?? null), answerText(entry.after.answer));
    case "archived":
      return t.archived;
    case "restored":
      return t.restored;
    case "reminded":
      return t.reminded;
    case "exported":
      return t.exported;
  }
}

export const historyLine = (entry: HistoryEntry, ctx: HistoryContext): string =>
  t.line(relativeAge(entry.event.at, ctx.now), actorName(entry.event.by), what(entry, ctx));
