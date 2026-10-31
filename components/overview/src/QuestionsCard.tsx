import { cn } from "@kibo/sdk/lib/utils";
import { MessageCircleQuestion } from "lucide-react";
import { useState } from "react";
import { fr } from "./fr";
import { CARD, CardHeader, FeatureChip, Pill, ROW_LINE } from "./parts";
import { QUESTION_PAGE, type QuestionRow, questionPage } from "./review-model";

type Props = {
  rows: readonly QuestionRow[];
  onOpenQuestion(id: string): void;
  onOpenQuestions(): void;
};

const FOOTER_BUTTON = "cursor-pointer text-(--tracking-mfg) text-[12.5px] leading-[15px] hover:underline";

function QuestionItem({ q, onOpen }: { q: QuestionRow; onOpen(id: string): void }) {
  return (
    <li className={cn("flex flex-col gap-[5px] px-[16px] py-[10px]", ROW_LINE)}>
      <button
        type="button"
        className="cursor-pointer text-left text-(--tracking-fg) text-[13px] leading-[1.35] hover:underline"
        onClick={() => onOpen(q.id)}
      >
        {q.title}
      </button>
      <span className="flex min-h-[17px] flex-wrap items-center gap-[6px]">
        {q.feature !== null && <FeatureChip shortKey={q.feature} />}
        <span className="text-(--tracking-mfg) text-[12px] leading-[15px]">{q.meta}</span>
        {q.blocking && <Pill tone="red">{fr.questions.blocking}</Pill>}
      </span>
    </li>
  );
}

function BlockingCount({ count }: { count: number }) {
  return (
    <span className="flex items-center gap-[8px]">
      <span aria-hidden className="size-[6px] rounded-full bg-(--tracking-red)" />
      <span className="font-medium text-(--tracking-red) text-[12px] leading-[15px]">
        {fr.questions.blockingCount(count)}
      </span>
    </span>
  );
}

export function QuestionsCard({ rows, onOpenQuestion, onOpenQuestions }: Props) {
  const [shown, setShown] = useState(QUESTION_PAGE);
  const page = questionPage(rows, shown);
  const blocking = rows.filter((q) => q.blocking).length;
  return (
    <section aria-label={fr.questions.title} className={CARD}>
      <CardHeader
        icon={MessageCircleQuestion}
        title={fr.questions.title}
        count={rows.length}
        {...(blocking > 0 && { aside: <BlockingCount count={blocking} /> })}
      />
      {rows.length === 0 ? (
        <p className={cn("px-[16px] py-[12px] text-(--tracking-mfg) text-[12.5px]", ROW_LINE)}>
          {fr.questions.none}
        </p>
      ) : (
        <ul>
          {page.rows.map((q) => (
            <QuestionItem key={q.id} q={q} onOpen={onOpenQuestion} />
          ))}
        </ul>
      )}
      {rows.length > QUESTION_PAGE && (
        <div className={cn("flex items-center gap-[12px] px-[16px] py-[10px]", ROW_LINE)}>
          {page.more > 0 && (
            <button
              type="button"
              className={FOOTER_BUTTON}
              onClick={() => setShown((n) => n + QUESTION_PAGE)}
            >
              {fr.questions.more(page.more)}
            </button>
          )}
          <button type="button" className={cn(FOOTER_BUTTON, "ml-auto")} onClick={onOpenQuestions}>
            {fr.questions.all(rows.length)}
          </button>
        </div>
      )}
    </section>
  );
}
