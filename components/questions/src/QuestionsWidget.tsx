import { isOpen, type Question, type TicketView, undeliveredAnswers } from "@kibo/schema";
import { TicketKeyLabel, useSdk } from "@kibo/sdk";
import { useMemo, useState } from "react";
import { DeliverButton, DeliveryMessage, type DeliveryNotice } from "./DeliverButton";
import { fr } from "./fr";
import { QuestionAnswerForm } from "./QuestionAnswerForm";
import { QuestionAnswerLine, QuestionAuthor } from "./QuestionMeta";
import { byNewest, filterQuestions, relativeAge } from "./questions-logic";
import { type QuestionsData, useQuestions } from "./use-questions";

type RowProps = { question: Question; ticket: TicketView | null; data: QuestionsData; now: number };

function QuestionRow({ question: q, ticket, data, now }: RowProps) {
  const [open, setOpen] = useState(false);
  return (
    <li className="grid gap-2 border-b py-2 last:border-b-0">
      <button
        type="button"
        aria-expanded={open}
        className="grid gap-1 text-left"
        onClick={() => setOpen((o) => !o)}
      >
        <span className="text-sm font-medium">{q.title}</span>
        <span className="flex flex-wrap items-center gap-2 text-2xs text-muted-foreground">
          {ticket && <TicketKeyLabel ticket={ticket} className="font-mono" />}
          <QuestionAuthor actor={q.createdBy} />
          {q.provisional !== null && <span>{fr.provisional(q.provisional)}</span>}
          <span>{relativeAge(q.createdAt, now)}</span>
        </span>
      </button>
      {open &&
        (isOpen(q) ? (
          !data.readOnly && <QuestionAnswerForm question={q} />
        ) : (
          <QuestionAnswerLine question={q} now={now} runLabel={data.runLabel} />
        ))}
    </li>
  );
}

function PendingDeliveries({ data }: { data: QuestionsData }) {
  const [notice, setNotice] = useState<DeliveryNotice | null>(null);
  const pending = data.tickets
    .map((ticket) => ({ ticket, count: undeliveredAnswers(data.questions, ticket.id).length }))
    .filter((p) => p.count > 0);
  return (
    <div className="grid gap-1.5">
      {!data.readOnly && pending.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {pending.map(({ ticket, count }) => (
            <DeliverButton
              key={ticket.id}
              ticketId={ticket.id}
              label={fr.deliverFor(ticket.keyLabel, count)}
              runLabel={data.runLabel}
              onNotice={setNotice}
            />
          ))}
        </div>
      )}
      <DeliveryMessage notice={notice} />
    </div>
  );
}

export function QuestionsWidget() {
  const sdk = useSdk();
  const data = useQuestions();
  const scope = sdk.config.scope === "all" ? "all" : "open";
  const shown = useMemo(
    () => filterQuestions(data.questions, scope, null).sort(byNewest),
    [data.questions, scope],
  );
  const openCount = data.questions.filter(isOpen).length;
  const now = Date.now();
  if (data.error) {
    return (
      <p role="alert" className="p-4 text-sm text-destructive">
        {fr.loadFailed}
      </p>
    );
  }
  return (
    <div className="flex h-full min-h-0 flex-col gap-2 p-3">
      <header className="flex items-center gap-2">
        <h3 aria-live="polite" className="text-sm font-semibold">
          {fr.widgetTitle(openCount)}
        </h3>
        <span className="flex-1" />
        {data.readOnly && <span className="text-2xs text-muted-foreground">{fr.readOnly}</span>}
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {!data.loading && shown.length === 0 ? (
          <p className="text-sm text-muted-foreground">{fr.emptyOpen}</p>
        ) : (
          <ul>
            {shown.map((q) => (
              <QuestionRow key={q.id} question={q} ticket={data.ticketOf(q.ticketId)} data={data} now={now} />
            ))}
          </ul>
        )}
      </div>
      <PendingDeliveries data={data} />
      <button
        type="button"
        className="w-fit text-xs text-muted-foreground hover:text-foreground hover:underline"
        onClick={() => sdk.openView("questions")}
      >
        {fr.openView}
      </button>
    </div>
  );
}
