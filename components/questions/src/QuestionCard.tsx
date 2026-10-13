import {
  isArchived,
  isEditableAnswer,
  isOpen,
  type Question,
  type QuestionRecipient,
  type TicketRun,
  type TicketView,
} from "@kibo/schema";
import { useSdk } from "@kibo/sdk";
import { Button } from "@kibo/sdk/ui/button";
import { ConfirmDialog } from "@kibo/sdk/ui/confirm-dialog";
import { Archive, ArchiveRestore, Send } from "lucide-react";
import { useState } from "react";
import { AnswerActionButtons, AnswerEditForm } from "./AnswerActions";
import { ExportButton } from "./ExportButton";
import { fr } from "./fr";
import { PasteAnswerForm } from "./PasteAnswerForm";
import { QuestionAnswerForm } from "./QuestionAnswerForm";
import { QuestionHistory } from "./QuestionHistory";
import { QuestionAnswerLine, QuestionAuthor } from "./QuestionMeta";
import { canArchive, recipientName, relativeAge } from "./questions-logic";
import { RecipientMenu } from "./RecipientMenu";
import { renderContext } from "./render-context";
import { useSpotlightCard } from "./use-spotlight-card";

type Props = {
  question: Question;
  ticket: TicketView;
  recipients: readonly QuestionRecipient[];
  now: number;
  readOnly: boolean;
  viewer: string;
  runLabel(runId: string): string;
  runOf(runId: string | null): TicketRun | null;
  ticketLabel(ticketId: string): string;
};

const HEADER_ACTION = "h-6 px-2 text-2xs text-muted-foreground";

function SentLine({ at, now }: { at: number; now: number }) {
  return (
    <span className="inline-flex items-center gap-1 text-2xs text-muted-foreground">
      <Send aria-hidden className="size-3" />
      {fr.exporting.sent(relativeAge(at, now))}
    </span>
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

export function QuestionCard(props: Props) {
  const { question: q, ticket, recipients, now, readOnly, viewer, runLabel, runOf } = props;
  const sdk = useSdk();
  const [archiving, setArchiving] = useState(false);
  const [editing, setEditing] = useState(false);
  const spotlight = useSpotlightCard(q.id);
  const archived = isArchived(q);
  const open = isOpen(q) && !readOnly;
  const by = { kind: "human", ref: sdk.viewer } as const;
  const context = renderContext(q.context);
  const editedAnswer = !readOnly && editing && isEditableAnswer(q) ? q.answer : null;
  return (
    <article
      ref={spotlight.ref}
      tabIndex={-1}
      data-spotlight={spotlight.spotlit ?? undefined}
      aria-label={q.title}
      className="grid scroll-my-4 gap-2 rounded-md border bg-card p-3 text-sm outline-none"
    >
      <header className="flex flex-wrap items-center gap-2">
        <h4 className="min-w-48 flex-1 break-words font-medium">{q.title}</h4>
        <div className="ml-auto flex flex-wrap items-center justify-end gap-1">
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
        <RecipientMenu question={q} recipients={recipients} readOnly={readOnly || archived} />
        <span className="text-2xs text-muted-foreground">{fr.askedBy}</span>
        <QuestionAuthor actor={q.createdBy} run={runOf(q.runId)} />
        <span className="text-2xs text-muted-foreground">{relativeAge(q.createdAt, now)}</span>
        {q.sentAt !== null && <SentLine at={q.sentAt} now={now} />}
      </div>
      <ArchivedLine question={q} now={now} />
      {context !== null && <div className="grid gap-1.5 text-xs text-muted-foreground">{context}</div>}
      {(q.options.length > 0 || q.provisional !== null) && (
        <p className="flex flex-wrap gap-x-3 text-2xs text-muted-foreground">
          {q.options.length > 0 && <span>{`${fr.options} : ${q.options.join(" · ")}`}</span>}
          {q.provisional !== null && <span>{fr.provisional(q.provisional)}</span>}
        </p>
      )}
      <QuestionAnswerLine question={q} now={now} runLabel={runLabel} />
      {editedAnswer !== null && (
        <AnswerEditForm question={q} answer={editedAnswer} onClose={() => setEditing(false)} />
      )}
      {open && <QuestionAnswerForm question={q} />}
      {open && (
        <div className="flex flex-wrap justify-end gap-2">
          <ExportButton
            label={fr.exporting.one}
            entries={[{ question: q, ticket, recipient: recipientName(recipients, q.recipient) }]}
          />
          <PasteAnswerForm question={q} />
        </div>
      )}
      <QuestionHistory question={q} context={{ recipients, runLabel, ticketLabel: props.ticketLabel, now }} />
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
