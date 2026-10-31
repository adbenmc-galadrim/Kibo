import { isAnswered, isArchived, isOpen, type Question, type TicketView } from "@kibo/schema";
import { AgentBadge, useSdk } from "@kibo/sdk";
import { Button } from "@kibo/sdk/ui/button";
import { ConfirmDialog } from "@kibo/sdk/ui/confirm-dialog";
import { Archive, ArchiveRestore, ClipboardPaste, History, Send } from "lucide-react";
import { useState } from "react";
import { AnswerActionButtons, AnswerEditForm } from "./AnswerActions";
import { CardMenu } from "./CardMenu";
import { EditQuestionDialog } from "./EditQuestionDialog";
import { ExportSurface, useExportFlow } from "./ExportButton";
import { dayMonth, exportLabels } from "./export-text";
import { fr } from "./fr";
import { PasteAnswerForm } from "./PasteAnswerForm";
import { QuestionAnswerForm } from "./QuestionAnswerForm";
import { HistoryToggle, QuestionHistory } from "./QuestionHistory";
import { QuestionImages } from "./QuestionImages";
import { QuestionAnswerLine } from "./QuestionMeta";
import {
  actorName,
  askedAge,
  canArchive,
  lastExportedAt,
  lastReminder,
  recipientName,
  relativeAge,
} from "./questions-logic";
import { RecipientMenu } from "./RecipientMenu";
import { renderContext } from "./render-context";
import { impactOf } from "./ticket-feature";
import type { QuestionsData } from "./use-questions";
import { isScreenValidation, ValidationActions } from "./ValidationActions";

type Props = { question: Question; ticket: TicketView; data: QuestionsData; now: number };

const META = "text-xs text-muted-foreground";

function AskedLine({ question: q, now }: { question: Question; now: number }) {
  const age = askedAge(q.createdAt, now);
  if (q.createdBy.kind === "agent")
    return (
      <span className={`inline-flex items-center gap-1 ${META}`}>
        {fr.askedBy}
        <AgentBadge agent={q.createdBy.ref} />
        {`· ${age}`}
      </span>
    );
  return <span className={META}>{`${fr.askedBy} ${actorName(q.createdBy)} · ${age}`}</span>;
}

function SentLine({ question }: { question: Question }) {
  const at = lastExportedAt(question);
  if (at === null) return null;
  return (
    <span className={`inline-flex items-center gap-1 ${META}`}>
      <Send aria-hidden className="size-3" />
      {fr.exporting.sentOn(dayMonth(at))}
    </span>
  );
}

function RemindedLine({ question, now }: { question: Question; now: number }) {
  const at = lastReminder(question);
  if (at === null) return null;
  return <span className={META}>{fr.reminded(relativeAge(at, now))}</span>;
}

function ArchivedLine({ question: q, now }: { question: Question; now: number }) {
  if (q.archivedAt === null || q.archivedBy === null) return null;
  return (
    <p className={`inline-flex items-center gap-1 ${META}`}>
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

function ChoicesLine({ question: q }: { question: Question }) {
  const options = isOpen(q) ? [] : q.options;
  if (isScreenValidation(q) || (options.length === 0 && q.provisional === null)) return null;
  return (
    <p className={`flex flex-wrap gap-x-3 ${META}`}>
      {options.length > 0 && <span>{`${fr.options} : ${options.join(" · ")}`}</span>}
      {q.provisional !== null && <span>{fr.provisional(q.provisional)}</span>}
    </p>
  );
}

function HistoryEntry(props: { question: Question; open: boolean; onToggle(): void }) {
  if (props.question.history.length > 0) return <HistoryToggle {...props} />;
  return (
    <span className={`inline-flex items-center gap-1 ${META}`}>
      <History aria-hidden className="size-3" />
      {fr.historyEmpty}
    </span>
  );
}

export function QuestionRowDetail({ question: q, ticket, data, now }: Props) {
  const sdk = useSdk();
  const [dialog, setDialog] = useState<"archive" | "remove" | "edit" | null>(null);
  const [editingAnswer, setEditingAnswer] = useState(false);
  const [pasting, setPasting] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const open = isOpen(q);
  const name = recipientName(data.recipients, q.recipient, data.client);
  const flow = useExportFlow(name, [{ question: q, impact: impactOf(ticket, data.ticketOf, data.sprints) }]);
  const context = renderContext(q.context);
  const editedAnswer = editingAnswer && isAnswered(q) ? q.answer : null;
  const closeDialog = (next: boolean) => !next && setDialog(null);
  const by = { kind: "human", ref: sdk.viewer } as const;
  const paste = !pasting && (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="h-6.5 px-2.5 text-xs font-medium"
      onClick={() => setPasting(true)}
    >
      <ClipboardPaste aria-hidden />
      {fr.paste.open}
    </Button>
  );
  return (
    <div className="grid gap-2.5 pt-0.5 pr-[15px] pb-3.5 pl-[83px]">
      <div className="grid gap-1.5 text-[13px]">{context ?? <p>{q.title}</p>}</div>
      <div className="flex flex-wrap items-center gap-2.5">
        <RecipientMenu
          question={q}
          recipients={data.recipients}
          client={data.client}
          readOnly={isArchived(q)}
        />
        <AskedLine question={q} now={now} />
        <span aria-hidden className={META}>
          ·
        </span>
        <HistoryEntry question={q} open={historyOpen} onToggle={() => setHistoryOpen((o) => !o)} />
        <SentLine question={q} />
        <RemindedLine question={q} now={now} />
        <span className="flex-1" />
        {editedAnswer === null && <AnswerActionButtons question={q} onEdit={() => setEditingAnswer(true)} />}
        {isArchived(q) && <RestoreButton questionId={q.id} />}
        <ExportSurface flow={flow} summary={exportLabels(q.recipient, name, 1).summary}>
          <span className="inline-flex">
            <CardMenu
              question={q}
              canArchive={canArchive(q, data.viewer)}
              onEdit={isArchived(q) ? null : () => setDialog("edit")}
              onExport={open ? () => void flow.start() : null}
              onArchive={() => setDialog("archive")}
              onRemove={() => setDialog("remove")}
            />
          </span>
        </ExportSurface>
      </div>
      <ArchivedLine question={q} now={now} />
      <QuestionImages question={q} />
      <ChoicesLine question={q} />
      <QuestionAnswerLine question={q} now={now} />
      {editedAnswer !== null && (
        <AnswerEditForm question={q} answer={editedAnswer} onClose={() => setEditingAnswer(false)} />
      )}
      {open && isScreenValidation(q) && (
        <>
          <ValidationActions question={q} />
          {paste}
        </>
      )}
      {open && !isScreenValidation(q) && (
        <div className="mt-0.5">
          <QuestionAnswerForm question={q} inlineAction={paste} />
        </div>
      )}
      {open && pasting && <PasteAnswerForm question={q} onClose={() => setPasting(false)} />}
      {historyOpen && (
        <QuestionHistory
          question={q}
          context={{
            recipients: data.recipients,
            ticketLabel: (id) => data.ticketOf(id)?.keyLabel ?? id,
            now,
          }}
        />
      )}
      {dialog === "edit" && <EditQuestionDialog question={q} onClose={() => setDialog(null)} />}
      <ConfirmDialog
        open={dialog === "archive"}
        onOpenChange={closeDialog}
        title={fr.archiveTitle(q.title)}
        description={fr.archiveHelp}
        confirmLabel={fr.archive}
        cancelLabel={fr.cancel}
        describeError={() => fr.archiveFailed}
        onConfirm={async () => {
          await sdk.run({ method: "archiveQuestion", questionId: q.id, by });
        }}
      />
      <ConfirmDialog
        open={dialog === "remove"}
        onOpenChange={closeDialog}
        title={fr.removeTitle(q.title)}
        description={fr.removeHelp}
        confirmLabel={fr.remove}
        cancelLabel={fr.cancel}
        describeError={() => fr.removeFailed}
        onConfirm={async () => {
          await sdk.run({ method: "removeQuestion", questionId: q.id });
        }}
      />
    </div>
  );
}
