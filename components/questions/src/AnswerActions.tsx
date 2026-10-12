import { isAnswered, isDelivered, isEditableAnswer, type Question } from "@kibo/schema";
import { useSdk } from "@kibo/sdk";
import { Button } from "@kibo/sdk/ui/button";
import { ConfirmDialog } from "@kibo/sdk/ui/confirm-dialog";
import { Pencil, RotateCcw, Undo2 } from "lucide-react";
import { useState } from "react";
import { fr } from "./fr";
import { QuestionAnswerForm } from "./QuestionAnswerForm";

type Props = { question: Question };

const ACTION = "h-6 px-2 text-2xs text-muted-foreground";

export function AnswerActions({ question: q }: Props) {
  const sdk = useSdk();
  const [editing, setEditing] = useState(false);
  const [reopening, setReopening] = useState(false);
  const by = { kind: "human", ref: sdk.viewer } as const;
  if (!isAnswered(q) || q.answer === null) return null;
  const delivered = isDelivered(q);
  if (editing && isEditableAnswer(q))
    return (
      <QuestionAnswerForm
        question={q}
        initial={q.answer}
        onCancel={() => setEditing(false)}
        onSubmit={async (answer) => {
          await sdk.run({ method: "updateAnswer", questionId: q.id, answer, by });
          setEditing(false);
        }}
      />
    );
  return (
    <div className="flex flex-wrap justify-end gap-1">
      {!delivered && (
        <Button variant="ghost" size="sm" className={ACTION} onClick={() => setEditing(true)}>
          <Pencil aria-hidden />
          {fr.answerEdit}
        </Button>
      )}
      <Button variant="ghost" size="sm" className={ACTION} onClick={() => setReopening(true)}>
        {delivered ? <RotateCcw aria-hidden /> : <Undo2 aria-hidden />}
        {delivered ? fr.reopen : fr.answerRemove}
      </Button>
      <ConfirmDialog
        open={reopening}
        onOpenChange={setReopening}
        title={delivered ? fr.reopenTitle(q.title) : fr.answerRemoveTitle(q.title)}
        description={delivered ? fr.reopenHelp : fr.answerRemoveHelp}
        confirmLabel={delivered ? fr.reopen : fr.answerRemove}
        cancelLabel={fr.cancel}
        describeError={() => fr.reopenFailed}
        onConfirm={async () => {
          await sdk.run({ method: "reopenQuestion", questionId: q.id, by });
        }}
      />
    </div>
  );
}
