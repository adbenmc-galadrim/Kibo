import { featureLabel } from "@kibo/schema";
import { useSdk } from "@kibo/sdk";
import { Lock, Package } from "lucide-react";
import { useMemo, useState } from "react";
import { ActionToast } from "./ActionToast";
import { DeliverButton, DeliveryMessage, type DeliveryNotice } from "./DeliverButton";
import { ExportButton } from "./ExportButton";
import { byExportOrder, type ExportEntry, exportLabels } from "./export-text";
import { fr } from "./fr";
import { NewQuestionDialog } from "./NewQuestionDialog";
import { QuestionCard } from "./QuestionCard";
import { QuestionsToolbar } from "./QuestionsToolbar";
import {
  blockingSummary,
  CLIENT_RECIPIENT,
  filterQuestions,
  recipientCounts,
  recipientName,
  type Scope,
  type ViewGroup,
  viewGroups,
} from "./questions-logic";
import { RecipientFilters } from "./RecipientFilters";
import { featureOf, impactOf } from "./ticket-feature";
import { useNewQuestionIntent } from "./use-new-question-intent";
import { type QuestionsData, useQuestions } from "./use-questions";
import { useSpotlightFilters } from "./use-spotlight-filters";
import { useUnblockToast } from "./use-unblock-toast";

const configScope = (value: unknown): Scope => (value === "all" ? "all" : "open");

const keyOf = (data: QuestionsData) => (id: string) => data.ticketOf(id)?.keyLabel ?? id;

function FeatureChip({ label }: { label: string }) {
  return (
    <span
      title={fr.feature(label)}
      className="inline-flex items-center gap-1 rounded-[4px] border px-1.5 py-px font-mono text-xs font-medium text-muted-foreground"
    >
      <Package aria-hidden className="size-3" />
      {label}
    </span>
  );
}

function BlockingLine({ blocking, open }: { blocking: number; open: number }) {
  if (blocking === 0) return null;
  return (
    <p className="flex items-center gap-2 text-[12.5px] leading-[1.2] text-muted-foreground">
      <Lock aria-hidden className="size-3.25 text-destructive" />
      {fr.blockingSummary(blocking, open)}
    </p>
  );
}

function QuestionGroup({ group, data, now }: { group: ViewGroup; data: QuestionsData; now: number }) {
  const sdk = useSdk();
  const [notice, setNotice] = useState<DeliveryNotice | null>(null);
  const t = group.ticket;
  const feature = featureOf(t, data.ticketOf);
  const impact = impactOf(t, data.ticketOf, data.sprints);
  return (
    <section aria-label={fr.openTicket(t.keyLabel, t.title)} className="grid gap-2">
      <header className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className="min-w-0 truncate text-left text-[13px] leading-[1.2] font-semibold hover:underline"
          onClick={() => sdk.openTicket(t.id)}
        >
          <span className="mr-2 font-mono text-xs font-normal text-muted-foreground">{t.keyLabel}</span>
          {t.title}
        </button>
        {feature !== null && feature.id !== t.id && <FeatureChip label={featureLabel(feature)} />}
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
          impact={impact}
          client={data.client}
          recipients={data.recipients}
          now={now}
          readOnly={data.readOnly}
          viewer={data.viewer}
          runLabel={data.runLabel}
          runOf={data.runOf}
          ticketLabel={keyOf(data)}
        />
      ))}
    </section>
  );
}

function exportEntries(data: QuestionsData, ticketId: string | null, recipient: string): ExportEntry[] {
  const open = filterQuestions(data.questions, "open", ticketId, recipient).sort(byExportOrder);
  return open.flatMap((question) => {
    const ticket = data.ticketOf(question.ticketId);
    return ticket ? [{ question, impact: impactOf(ticket, data.ticketOf, data.sprints) }] : [];
  });
}

export function QuestionsView() {
  const sdk = useSdk();
  const data = useQuestions();
  const [scope, setScope] = useState<Scope>(() => configScope(sdk.config.scope));
  const [ticketId, setTicketId] = useState<string | null>(null);
  const [recipient, setRecipient] = useState<string | null>(null);
  const [creating, setCreating] = useState<string | null>(null);
  useNewQuestionIntent(data.readOnly, setCreating);
  useSpotlightFilters(data.questions, { scope, ticketId, recipient }, (shown) => {
    setScope(shown.scope);
    setTicketId(shown.ticketId);
    setRecipient(shown.recipient);
  });
  const groups = useMemo(
    () => viewGroups(data.questions, data.tickets, scope, ticketId, recipient),
    [data.questions, data.tickets, scope, ticketId, recipient],
  );
  const counts = useMemo(() => recipientCounts(data.questions), [data.questions]);
  const target = recipient ?? CLIENT_RECIPIENT;
  const toExport = useMemo(() => exportEntries(data, ticketId, target), [data, ticketId, target]);
  const targetName = recipientName(data.recipients, target, data.client);
  const exportText = exportLabels(target, targetName, toExport.length);
  const summary = useMemo(() => blockingSummary(groups.flatMap((g) => g.questions)), [groups]);
  const { unblocked, dismiss } = useUnblockToast(data.loading, data.questions, data.tickets, data.ticketOf);
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
        onNew={() => setCreating("")}
        filters={
          <RecipientFilters
            recipients={data.recipients}
            client={data.client}
            counts={counts}
            value={recipient}
            readOnly={data.readOnly}
            onChange={setRecipient}
          />
        }
        actions={
          !data.readOnly &&
          toExport.length > 0 && (
            <ExportButton
              label={exportText.label}
              recipient={targetName}
              summary={exportText.summary}
              entries={toExport}
            />
          )
        }
      />
      <div className="grid min-h-0 flex-1 content-start gap-5 overflow-y-auto px-6 py-4.5">
        <BlockingLine blocking={summary.blocking} open={summary.open} />
        {!data.loading && groups.length === 0 && (
          <p className="text-sm text-muted-foreground">{scope === "open" ? fr.emptyOpen : fr.empty}</p>
        )}
        {groups.map((g) => (
          <QuestionGroup key={g.ticket.id} group={g} data={data} now={now} />
        ))}
      </div>
      {unblocked !== null && (
        <ActionToast
          key={unblocked.ticketId}
          message={unblocked.message}
          actionLabel={fr.seeFeature(unblocked.label)}
          onAction={() => {
            sdk.openTicket(unblocked.ticketId);
            dismiss();
          }}
          onClose={dismiss}
        />
      )}
      {creating !== null && (
        <NewQuestionDialog
          tickets={data.tickets}
          recipients={data.recipients}
          client={data.client}
          initialTicketId={creating}
          onOpenChange={(open) => !open && setCreating(null)}
        />
      )}
    </div>
  );
}
