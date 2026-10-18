import { type Question, questionLabel, type TicketView } from "@kibo/schema";
import { frTicketTracking as t } from "../i18n/fr-ticket-tracking";

type Props = {
  ticket: Pick<TicketView, "id">;
  questions: readonly Question[];
  onOpen(questionId: string): void;
};

const openOf = (questions: readonly Question[], ticketId: string): Question[] =>
  questions.filter((q) => q.ticketId === ticketId && q.answer === null && q.archivedAt === null);

export function QuestionsSection({ ticket, questions, onOpen }: Props) {
  const open = openOf(questions, ticket.id);
  return (
    <section aria-labelledby={`questions-${ticket.id}`} className="grid gap-2.5 text-[12.5px]">
      <p className="flex items-baseline gap-2">
        <span id={`questions-${ticket.id}`} className="text-[13px] font-semibold">
          {t.questions}
        </span>
        <span className="font-mono text-xs text-muted-foreground">{open.length}</span>
      </p>
      {open.length === 0 && <p className="text-muted-foreground">{t.noQuestion}</p>}
      {open.length > 0 && (
        <ul className="grid gap-1">
          {open.map((q) => (
            <li key={q.id}>
              <button
                type="button"
                className="flex w-full items-baseline gap-2 rounded-md px-1 py-0.5 text-left hover:bg-accent"
                onClick={() => onOpen(q.id)}
              >
                <span className="shrink-0 font-mono text-xs text-muted-foreground">{questionLabel(q)}</span>
                <span className="min-w-0 truncate">{q.title}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
