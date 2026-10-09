import { useSdk } from "@kibo/sdk";
import { useMemo, useState } from "react";
import { DeliverButton, DeliveryMessage, type DeliveryNotice } from "./DeliverButton";
import { fr } from "./fr";
import { NewQuestionDialog } from "./NewQuestionDialog";
import { QuestionCard } from "./QuestionCard";
import { QuestionsToolbar } from "./QuestionsToolbar";
import { type Scope, type ViewGroup, viewGroups } from "./questions-logic";
import { type QuestionsData, useQuestions } from "./use-questions";

const configScope = (value: unknown): Scope => (value === "all" ? "all" : "open");

function QuestionGroup({ group, data, now }: { group: ViewGroup; data: QuestionsData; now: number }) {
  const sdk = useSdk();
  const [notice, setNotice] = useState<DeliveryNotice | null>(null);
  const t = group.ticket;
  return (
    <section aria-label={fr.openTicket(t.keyLabel, t.title)} className="grid gap-2">
      <header className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className="min-w-0 truncate text-left text-sm font-semibold hover:underline"
          onClick={() => sdk.openTicket(t.id)}
        >
          <span className="mr-2 font-mono text-2xs font-normal text-muted-foreground">{t.keyLabel}</span>
          {t.title}
        </button>
        <span className="flex-1" />
        {!data.readOnly && group.undelivered.length > 0 && (
          <DeliverButton
            ticketId={t.id}
            label={fr.deliver(group.undelivered.length)}
            runLabel={data.runLabel}
            onNotice={setNotice}
          />
        )}
      </header>
      <DeliveryMessage notice={notice} />
      {group.questions.map((q) => (
        <QuestionCard
          key={q.id}
          question={q}
          now={now}
          readOnly={data.readOnly}
          viewer={data.viewer}
          runLabel={data.runLabel}
        />
      ))}
    </section>
  );
}

export function QuestionsView() {
  const sdk = useSdk();
  const data = useQuestions();
  const [scope, setScope] = useState<Scope>(() => configScope(sdk.config.scope));
  const [ticketId, setTicketId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const groups = useMemo(
    () => viewGroups(data.questions, data.tickets, scope, ticketId),
    [data.questions, data.tickets, scope, ticketId],
  );
  const asked = useMemo(
    () => data.tickets.filter((t) => data.questions.some((q) => q.ticketId === t.id)),
    [data.tickets, data.questions],
  );
  const now = Date.now();
  if (data.error) {
    return (
      <p role="alert" className="p-4 text-sm text-destructive">
        {fr.loadFailed}
      </p>
    );
  }
  return (
    <div className="flex h-full min-h-0 flex-col">
      <QuestionsToolbar
        scope={scope}
        ticket={ticketId === null ? null : data.ticketOf(ticketId)}
        tickets={asked}
        readOnly={data.readOnly}
        onScope={setScope}
        onTicket={setTicketId}
        onNew={() => setCreating(true)}
      />
      <div className="grid min-h-0 flex-1 content-start gap-6 overflow-y-auto p-4">
        {!data.loading && groups.length === 0 && (
          <p className="text-sm text-muted-foreground">{scope === "open" ? fr.emptyOpen : fr.empty}</p>
        )}
        {groups.map((g) => (
          <QuestionGroup key={g.ticket.id} group={g} data={data} now={now} />
        ))}
      </div>
      {creating && <NewQuestionDialog tickets={data.tickets} onOpenChange={setCreating} />}
    </div>
  );
}
