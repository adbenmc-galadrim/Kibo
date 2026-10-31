import type { Question } from "@kibo/schema";
import { PageActions, useSdk } from "@kibo/sdk";
import { Button } from "@kibo/sdk/ui/button";
import { Lock, Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { ActionToast } from "./ActionToast";
import { EmptyPage } from "./EmptyPage";
import { ExportButton, PAGE_ACTION } from "./ExportButton";
import { byExportOrder, type ExportEntry, exportLabels } from "./export-text";
import { fr } from "./fr";
import { NewQuestionDialog } from "./NewQuestionDialog";
import { QuestionsTable } from "./QuestionsTable";
import { QuestionsToolbar } from "./QuestionsToolbar";
import {
  blockingSummary,
  CLIENT_RECIPIENT,
  filterQuestions,
  recipientCounts,
  recipientName,
  type Scope,
} from "./questions-logic";
import { RecipientFilters } from "./RecipientFilters";
import { impactOf } from "./ticket-feature";
import { useNewQuestionIntent } from "./use-new-question-intent";
import { type QuestionsData, useQuestions } from "./use-questions";
import { useSpotlightFilters } from "./use-spotlight-filters";
import { useUnblockToast } from "./use-unblock-toast";

const configScope = (value: unknown): Scope => (value === "all" ? "all" : "open");

function Summary({ scope, shown }: { scope: Scope; shown: readonly Question[] }) {
  const { blocking, open } = blockingSummary(shown);
  if (scope === "answered" && shown.length > 0)
    return <p className="text-xs leading-[1.2] text-muted-foreground">{fr.answeredSummary(shown.length)}</p>;
  if (blocking === 0) return null;
  return (
    <p className="flex items-center gap-1.5 text-xs leading-[1.2] text-muted-foreground">
      <Lock aria-hidden className="size-3.25 text-destructive" />
      {fr.blockingSummary(blocking, open)}
    </p>
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
  useNewQuestionIntent(setCreating);
  useSpotlightFilters(data.questions, { scope, ticketId, recipient }, (shown) => {
    setScope(shown.scope);
    setTicketId(shown.ticketId);
    setRecipient(shown.recipient);
  });
  const shown = useMemo(
    () =>
      filterQuestions(data.questions, scope, ticketId, recipient)
        .filter((q) => data.ticketOf(q.ticketId) !== null)
        .sort(byExportOrder),
    [data, scope, ticketId, recipient],
  );
  const counts = useMemo(() => recipientCounts(data.questions), [data.questions]);
  const target = recipient ?? CLIENT_RECIPIENT;
  const toExport = useMemo(() => exportEntries(data, ticketId, target), [data, ticketId, target]);
  const targetName = recipientName(data.recipients, target, data.client);
  const exportText = exportLabels(target, targetName, toExport.length);
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
        openCount={counts.total}
        onScope={setScope}
        onTicket={setTicketId}
        filters={
          <RecipientFilters
            recipients={data.recipients}
            client={data.client}
            counts={counts}
            value={recipient}
            onChange={setRecipient}
          />
        }
        summary={<Summary scope={scope} shown={shown} />}
        actions={
          <PageActions inline>
            <div className="flex items-center gap-3">
              {toExport.length > 0 && (
                <ExportButton
                  label={exportText.label}
                  recipient={targetName}
                  summary={exportText.summary}
                  entries={toExport}
                />
              )}
              <Button className={PAGE_ACTION} onClick={() => setCreating("")}>
                <Plus aria-hidden />
                {fr.newQuestion}
              </Button>
            </div>
          </PageActions>
        }
      />
      <div className="grid min-h-0 flex-1 content-start gap-5 overflow-y-auto px-6 py-4.5">
        {!data.loading && data.questions.length === 0 ? (
          <EmptyPage onNew={() => setCreating("")} />
        ) : (
          !data.loading &&
          shown.length === 0 && (
            <p className="text-sm text-muted-foreground">{scope === "open" ? fr.emptyOpen : fr.empty}</p>
          )
        )}
        {shown.length > 0 && <QuestionsTable questions={shown} data={data} now={now} />}
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
