import { isAnswered, type Question, type QuestionAnswer } from "@kibo/schema";
import { useSdk } from "@kibo/sdk";
import { Button } from "@kibo/sdk/ui/button";
import { ConfirmDialog } from "@kibo/sdk/ui/confirm-dialog";
import { Pencil, Undo2 } from "lucide-react";
import { useState } from "react";
import { fr } from "./fr";
import { QuestionAnswerForm } from "./QuestionAnswerForm";

const ACTION = "h-6 px-2 text-2xs text-muted-foreground";

export function AnswerActionButtons({ question: q, onEdit }: { question: Question; onEdit(): void }) {
  const sdk = useSdk();
  const [reopening, setReopening] = useState(false);
  if (!isAnswered(q) || q.answer === null) return null;
  return (
    <>
      <Button variant="ghost" size="sm" className={ACTION} onClick={onEdit}>
        <Pencil aria-hidden />
        {fr.answerEdit}
      </Button>
      <Button variant="ghost" size="sm" className={ACTION} onClick={() => setReopening(true)}>
        <Undo2 aria-hidden />
        {fr.answerRemove}
      </Button>
      <ConfirmDialog
        open={reopening}
        onOpenChange={setReopening}
        title={fr.answerRemoveTitle(q.title)}
        description={fr.answerRemoveHelp}
        confirmLabel={fr.answerRemove}
        cancelLabel={fr.cancel}
        describeError={() => fr.reopenFailed}
        onConfirm={async () => {
          await sdk.run({
            method: "reopenQuestion",
            questionId: q.id,
            by: { kind: "human", ref: sdk.viewer },
          });
        }}
      />
    </>
  );
}

type EditProps = { question: Question; answer: QuestionAnswer; onClose(): void };

export function AnswerEditForm({ question: q, answer, onClose }: EditProps) {
  const sdk = useSdk();
  return (
    <QuestionAnswerForm
      question={q}
      initial={answer}
      onCancel={onClose}
      onSubmit={async (next) => {
        await sdk.run({
          method: "updateAnswer",
          questionId: q.id,
          answer: next,
          by: { kind: "human", ref: sdk.viewer },
        });
        onClose();
      }}
    />
  );
}
