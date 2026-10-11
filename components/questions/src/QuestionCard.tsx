import { isOpen, type Question, type QuestionRecipient, type TicketRun, type TicketView } from "@kibo/schema";
import { useSdk } from "@kibo/sdk";
import { Button } from "@kibo/sdk/ui/button";
import { ConfirmDialog } from "@kibo/sdk/ui/confirm-dialog";
import { Send, Trash2 } from "lucide-react";
import { useState } from "react";
import { ExportButton } from "./ExportButton";
import { fr } from "./fr";
import { PasteAnswerForm } from "./PasteAnswerForm";
import { QuestionAnswerForm } from "./QuestionAnswerForm";
import { QuestionAnswerLine, QuestionAuthor } from "./QuestionMeta";
import { recipientName, relativeAge } from "./questions-logic";
import { RecipientMenu } from "./RecipientMenu";
import { renderContext } from "./render-context";

type Props = {
  question: Question;
  ticket: TicketView;
  recipients: readonly QuestionRecipient[];
  now: number;
  readOnly: boolean;
  viewer: string;
  runLabel(runId: string): string;
  runOf(runId: string | null): TicketRun | null;
};

export const canRemove = (q: Question, viewer: string): boolean =>
  !isOpen(q) || (q.createdBy.kind === "human" && q.createdBy.ref === viewer);

function SentLine({ at, now }: { at: number; now: number }) {
  return (
    <span className="inline-flex items-center gap-1 text-2xs text-muted-foreground">
      <Send aria-hidden className="size-3" />
      {fr.exporting.sent(relativeAge(at, now))}
    </span>
  );
}

export function QuestionCard(props: Props) {
  const { question: q, ticket, recipients, now, readOnly, viewer, runLabel, runOf } = props;
  const sdk = useSdk();
  const [removing, setRemoving] = useState(false);
  const context = renderContext(q.context);
  return (
    <article aria-label={q.title} className="grid gap-2 rounded-md border bg-card p-3 text-sm">
      <header className="flex flex-wrap items-center gap-2">
        <h4 className="min-w-0 flex-1 font-medium">{q.title}</h4>
        {!readOnly && canRemove(q, viewer) && (
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-2xs text-muted-foreground"
            onClick={() => setRemoving(true)}
          >
            <Trash2 aria-hidden />
            {fr.remove}
          </Button>
        )}
      </header>
      <div className="flex flex-wrap items-center gap-2">
        <RecipientMenu question={q} recipients={recipients} readOnly={readOnly} />
        <span className="text-2xs text-muted-foreground">{fr.askedBy}</span>
        <QuestionAuthor actor={q.createdBy} run={runOf(q.runId)} />
        <span className="text-2xs text-muted-foreground">{relativeAge(q.createdAt, now)}</span>
        {q.sentAt !== null && <SentLine at={q.sentAt} now={now} />}
      </div>
      {context !== null && <div className="grid gap-1.5 text-xs text-muted-foreground">{context}</div>}
      {(q.options.length > 0 || q.provisional !== null) && (
        <p className="flex flex-wrap gap-x-3 text-2xs text-muted-foreground">
          {q.options.length > 0 && <span>{`${fr.options} : ${q.options.join(" · ")}`}</span>}
          {q.provisional !== null && <span>{fr.provisional(q.provisional)}</span>}
        </p>
      )}
      <QuestionAnswerLine question={q} now={now} runLabel={runLabel} />
      {isOpen(q) && !readOnly && <QuestionAnswerForm question={q} />}
      {isOpen(q) && !readOnly && (
        <div className="flex flex-wrap justify-end gap-2">
          <ExportButton
            label={fr.exporting.one}
            entries={[{ question: q, ticket, recipient: recipientName(recipients, q.recipient) }]}
          />
          <PasteAnswerForm question={q} />
        </div>
      )}
      <ConfirmDialog
        open={removing}
        onOpenChange={setRemoving}
        title={fr.removeTitle(q.title)}
        description={fr.removeHelp}
        confirmLabel={fr.remove}
        cancelLabel={fr.cancel}
        describeError={() => fr.removeFailed}
        onConfirm={async () => {
          await sdk.run({ method: "removeQuestion", questionId: q.id });
        }}
      />
    </article>
  );
}
