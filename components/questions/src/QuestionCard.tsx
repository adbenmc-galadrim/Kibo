import { isOpen, type Question } from "@kibo/schema";
import { useSdk } from "@kibo/sdk";
import { Button } from "@kibo/sdk/ui/button";
import { ConfirmDialog } from "@kibo/sdk/ui/confirm-dialog";
import { Trash2 } from "lucide-react";
import { useState } from "react";
import { fr } from "./fr";
import { QuestionAnswerForm } from "./QuestionAnswerForm";
import { QuestionAnswerLine, QuestionAuthor } from "./QuestionMeta";
import { relativeAge } from "./questions-logic";
import { renderContext } from "./render-context";

type Props = {
  question: Question;
  now: number;
  readOnly: boolean;
  viewer: string;
  runLabel(runId: string): string;
};

export const canRemove = (q: Question, viewer: string): boolean =>
  !isOpen(q) || (q.createdBy.kind === "human" && q.createdBy.ref === viewer);

export function QuestionCard({ question: q, now, readOnly, viewer, runLabel }: Props) {
  const sdk = useSdk();
  const [removing, setRemoving] = useState(false);
  const context = renderContext(q.context);
  return (
    <article aria-label={q.title} className="grid gap-2 rounded-md border bg-card p-3 text-sm">
      <header className="flex flex-wrap items-center gap-2">
        <h4 className="min-w-0 flex-1 font-medium">{q.title}</h4>
        <QuestionAuthor actor={q.createdBy} />
        <span className="text-2xs text-muted-foreground">{relativeAge(q.createdAt, now)}</span>
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
      {context !== null && <div className="grid gap-1.5 text-xs text-muted-foreground">{context}</div>}
      {(q.options.length > 0 || q.provisional !== null) && (
        <p className="flex flex-wrap gap-x-3 text-2xs text-muted-foreground">
          {q.options.length > 0 && <span>{`${fr.options} : ${q.options.join(" · ")}`}</span>}
          {q.provisional !== null && <span>{fr.provisional(q.provisional)}</span>}
        </p>
      )}
      <QuestionAnswerLine question={q} now={now} runLabel={runLabel} />
      {isOpen(q) && !readOnly && <QuestionAnswerForm question={q} />}
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
