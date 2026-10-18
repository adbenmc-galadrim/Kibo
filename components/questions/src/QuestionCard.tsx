import {
  isArchived,
  isEditableAnswer,
  isOpen,
  type Question,
  type QuestionRecipient,
  questionLabel,
  type TicketRun,
} from "@kibo/schema";
import { useSdk } from "@kibo/sdk";
import { Button } from "@kibo/sdk/ui/button";
import { ConfirmDialog } from "@kibo/sdk/ui/confirm-dialog";
import { Archive, ArchiveRestore, ClipboardPaste, Lock, Send } from "lucide-react";
import { useState } from "react";
import { AnswerActionButtons, AnswerEditForm } from "./AnswerActions";
import { DenialProposals } from "./DenialProposals";
import { isDenialQuestion } from "./denial-logic";
import { ExportButton } from "./ExportButton";
import { dayMonth, exportLabels } from "./export-text";
import { fr } from "./fr";
import { PasteAnswerForm } from "./PasteAnswerForm";
import { AGENT_ACCENT, QuestionAnswerForm } from "./QuestionAnswerForm";
import { HistoryToggle, QuestionHistory } from "./QuestionHistory";
import { QuestionImages } from "./QuestionImages";
import { QuestionAnswerLine, QuestionAuthor } from "./QuestionMeta";
import {
  canArchive,
  isOpenBlocking,
  lastExportedAt,
  lastReminder,
  recipientName,
  relativeAge,
} from "./questions-logic";
import { RecipientMenu } from "./RecipientMenu";
import { renderContext } from "./render-context";
import type { Impact } from "./ticket-feature";
import { useSpotlightCard } from "./use-spotlight-card";
import { isScreenValidation, ValidationActions } from "./ValidationActions";

type Props = {
  question: Question;
  impact: Impact;
  client: string | null;
  recipients: readonly QuestionRecipient[];
  now: number;
  readOnly: boolean;
  viewer: string;
  runLabel(runId: string): string;
  runOf(runId: string | null): TicketRun | null;
  ticketLabel(ticketId: string): string;
};

const HEADER_ACTION = "h-5 px-2 text-2xs text-muted-foreground";

function SentLine({ question }: { question: Question }) {
  const at = lastExportedAt(question);
  if (at === null) return null;
  return (
    <span className="inline-flex items-center gap-1 text-2xs text-muted-foreground">
      <Send aria-hidden className="size-3" />
      {fr.exporting.sentOn(dayMonth(at))}
    </span>
  );
}

function BlockingPill() {
  return (
    <span className="inline-flex items-center gap-1.25 rounded-full bg-destructive/12 px-2 py-0.5 text-xs font-medium text-destructive">
      <Lock aria-hidden className="size-3" />
      {fr.blocking}
    </span>
  );
}

function ExportOne({ question: q, impact, name }: { question: Question; impact: Impact; name: string }) {
  const { summary } = exportLabels(q.recipient, name, 1);
  return (
    <ExportButton
      label={fr.exporting.one}
      recipient={name}
      summary={summary}
      entries={[{ question: q, impact }]}
      variant="ghost"
      className={HEADER_ACTION}
    />
  );
}

function ArchivedLine({ question: q, now }: { question: Question; now: number }) {
  if (q.archivedAt === null || q.archivedBy === null) return null;
  return (
    <p className="inline-flex items-center gap-1 text-2xs text-muted-foreground">
      <Archive aria-hidden className="size-3" />
      {fr.archived(q.archivedBy.ref, relativeAge(q.archivedAt, now))}
    </p>
  );
}

function AnswerArea({
  question: q,
  readOnly,
  run,
}: {
  question: Question;
  readOnly: boolean;
  run: TicketRun | null;
}) {
  if (!isOpen(q)) return null;
  const form = readOnly ? null : isScreenValidation(q) ? (
    <ValidationActions question={q} />
  ) : (
    <QuestionAnswerForm question={q} />
  );
  if (!isDenialQuestion(q)) return form;
  return <DenialProposals question={q} run={run} readOnly={readOnly} fallback={form} />;
}

function RestoreButton({ questionId }: { questionId: string }) {
  const sdk = useSdk();
  const [failed, setFailed] = useState(false);
  const restore = async () => {
    setFailed(false);
    try {
      await sdk.run({ method: "restoreQuestion", questionId, by: { kind: "human", ref: sdk.viewer } });
    } catch (e) {
      console.error(e);
      setFailed(true);
    }
  };
  return (
    <>
      {failed && (
        <span role="alert" className="text-2xs text-destructive">
          {fr.restoreFailed}
        </span>
      )}
      <Button variant="outline" size="sm" className="h-6 px-2 text-2xs" onClick={() => void restore()}>
        <ArchiveRestore aria-hidden />
        {fr.restore}
      </Button>
    </>
  );
}

function RemindedLine({ question, now }: { question: Question; now: number }) {
  const at = lastReminder(question);
  if (at === null) return null;
  return <span className="text-2xs text-muted-foreground">{fr.reminded(relativeAge(at, now))}</span>;
}

export function QuestionCard(props: Props) {
  const { question: q, impact, client, recipients, now, readOnly, viewer, runLabel, runOf } = props;
  const sdk = useSdk();
  const [archiving, setArchiving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [pasting, setPasting] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const spotlight = useSpotlightCard(q.id);
  const archived = isArchived(q);
  const open = isOpen(q) && !readOnly;
  const by = { kind: "human", ref: sdk.viewer } as const;
  const context = renderContext(q.context);
  const editedAnswer = !readOnly && editing && isEditableAnswer(q) ? q.answer : null;
  const blocking = isOpenBlocking(q);
  return (
    <article
      ref={spotlight.ref}
      tabIndex={-1}
      data-spotlight={spotlight.spotlit ?? undefined}
      aria-label={q.title}
      className={`grid scroll-my-4 gap-2.5 rounded-[10px] border bg-card px-3.5 py-3 text-sm outline-none ${blocking ? "border-destructive" : ""}`}
    >
      <header className="flex flex-wrap items-center gap-2">
        <span
          className={`font-mono text-[12.5px] font-semibold ${blocking ? "text-destructive" : "text-muted-foreground"}`}
        >
          {questionLabel(q)}
        </span>
        <h4 className="min-w-0 break-words text-[13.5px] leading-[1.2] font-semibold">{q.title}</h4>
        {blocking && <BlockingPill />}
        <span className="min-w-8 flex-1" />
        <div className="ml-auto flex flex-wrap items-center justify-end gap-1">
          {open && (
            <ExportOne question={q} impact={impact} name={recipientName(recipients, q.recipient, client)} />
          )}
          {open && !pasting && (
            <Button
              variant="ghost"
              size="sm"
              className={`${HEADER_ACTION} ${AGENT_ACCENT}`}
              onClick={() => setPasting(true)}
            >
              <ClipboardPaste aria-hidden />
              {fr.paste.open}
            </Button>
          )}
          {!readOnly && editedAnswer === null && (
            <AnswerActionButtons question={q} onEdit={() => setEditing(true)} />
          )}
          {!readOnly && archived && <RestoreButton questionId={q.id} />}
          {!readOnly && canArchive(q, viewer, runOf(q.runId)) && (
            <Button variant="ghost" size="sm" className={HEADER_ACTION} onClick={() => setArchiving(true)}>
              <Archive aria-hidden />
              {fr.archive}
            </Button>
          )}
        </div>
      </header>
      <div className="flex flex-wrap items-center gap-2">
        <RecipientMenu question={q} recipients={recipients} client={client} readOnly={readOnly || archived} />
        <span className="text-2xs text-muted-foreground">{fr.askedBy}</span>
        <QuestionAuthor actor={q.createdBy} run={runOf(q.runId)} />
        <span className="text-2xs text-muted-foreground">{relativeAge(q.createdAt, now)}</span>
        <SentLine question={q} />
        <RemindedLine question={q} now={now} />
        <HistoryToggle question={q} open={historyOpen} onToggle={() => setHistoryOpen((o) => !o)} />
      </div>
      <ArchivedLine question={q} now={now} />
      {context !== null && <div className="grid gap-1.5 text-xs text-muted-foreground">{context}</div>}
      <QuestionImages question={q} />
      {!isScreenValidation(q) && (q.options.length > 0 || q.provisional !== null) && (
        <p className="flex flex-wrap gap-x-3 text-2xs text-muted-foreground">
          {q.options.length > 0 && <span>{`${fr.options} : ${q.options.join(" · ")}`}</span>}
          {q.provisional !== null && <span>{fr.provisional(q.provisional)}</span>}
        </p>
      )}
      <QuestionAnswerLine question={q} now={now} runLabel={runLabel} />
      {editedAnswer !== null && (
        <AnswerEditForm question={q} answer={editedAnswer} onClose={() => setEditing(false)} />
      )}
      <AnswerArea question={q} readOnly={readOnly} run={runOf(q.runId)} />
      {open && pasting && <PasteAnswerForm question={q} onClose={() => setPasting(false)} />}
      {historyOpen && (
        <QuestionHistory
          question={q}
          context={{ recipients, runLabel, ticketLabel: props.ticketLabel, now }}
        />
      )}
      <ConfirmDialog
        open={archiving}
        onOpenChange={setArchiving}
        title={fr.archiveTitle(q.title)}
        description={fr.archiveHelp}
        confirmLabel={fr.archive}
        cancelLabel={fr.cancel}
        describeError={() => fr.archiveFailed}
        onConfirm={async () => {
          await sdk.run({ method: "archiveQuestion", questionId: q.id, by });
        }}
      />
    </article>
  );
}
