import { MessageCircleQuestion } from "lucide-react";
import { type KeyboardEvent, type MouseEvent, type PointerEvent, useCallback } from "react";
import { cn } from "./lib/utils";
import { QuestionPreview, type QuestionPreviewProps } from "./question-preview";
import { firstOpenQuestion } from "./question-preview-text";
import { useEntities, useQuestionRecipients, useSdk } from "./react";

const QUESTIONS_CHIP =
  "inline-flex shrink-0 items-center gap-1 rounded-md border border-orange-500/40 px-1.5 py-0.5 text-3xs font-medium text-orange-600 outline-none hover:bg-orange-500/10 focus-visible:ring-2 focus-visible:ring-ring dark:text-orange-400";

export type QuestionsChipProps = Omit<QuestionPreviewProps, "mode" | "onOpen" | "children"> & {
  text: string;
  label?: string;
  title?: string;
  className?: string;
  onOpen(questionId: string | null): void;
};

const stop = (e: PointerEvent | MouseEvent) => e.stopPropagation();
const stopKeys = (e: KeyboardEvent) => {
  if (e.key === "Enter" || e.key === " ") e.stopPropagation();
};

export function QuestionsChip({ text, label, title, className, onOpen, ...preview }: QuestionsChipProps) {
  return (
    <QuestionPreview mode="ticket" {...preview} onOpen={onOpen}>
      <button
        type="button"
        aria-label={label}
        title={title}
        data-dnd-ignore="true"
        className={cn(QUESTIONS_CHIP, className)}
        onPointerDown={stop}
        onKeyDown={stopKeys}
        onClick={(e) => {
          stop(e);
          onOpen(firstOpenQuestion(preview.questions, preview.ticket.id));
        }}
      >
        <MessageCircleQuestion aria-hidden className="size-3" />
        {text}
      </button>
    </QuestionPreview>
  );
}

export type QuestionsChipData = Pick<QuestionsChipProps, "questions" | "recipients" | "onOpen">;

export function useQuestionsChipData(): QuestionsChipData {
  const sdk = useSdk();
  const questions = useEntities("question").data;
  const recipients = useQuestionRecipients();
  const onOpen = useCallback(
    (questionId: string | null) =>
      sdk.openView("questions", questionId === null ? undefined : { question: questionId }),
    [sdk],
  );
  return { questions, recipients, onOpen };
}
