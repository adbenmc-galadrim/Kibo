import { cn } from "@kibo/sdk/lib/utils";
import { MessageCircleQuestion } from "lucide-react";
import { fr } from "./fr";
import { CARD, CardHeader, FeatureChip, Pill, ROW_LINE } from "./parts";
import type { QuestionRow } from "./review-model";

type Props = { rows: readonly QuestionRow[]; onOpenQuestion(id: string): void };

export function QuestionsCard({ rows, onOpenQuestion }: Props) {
  return (
    <section aria-label={fr.questions.title} className={CARD}>
      <CardHeader icon={MessageCircleQuestion} title={fr.questions.title} count={rows.length} />
      {rows.length === 0 ? (
        <p className={cn("px-[16px] py-[12px] text-(--tracking-mfg) text-[12.5px]", ROW_LINE)}>
          {fr.questions.none}
        </p>
      ) : (
        <ul>
          {rows.map((q) => (
            <li key={q.id} className={cn("flex flex-col gap-[5px] px-[16px] py-[10px]", ROW_LINE)}>
              <button
                type="button"
                className="cursor-pointer text-left text-(--tracking-fg) text-[13px] leading-[1.35] hover:underline"
                onClick={() => onOpenQuestion(q.id)}
              >
                {q.title}
              </button>
              <span className="flex min-h-[17px] flex-wrap items-center gap-[6px]">
                {q.feature !== null && <FeatureChip shortKey={q.feature} />}
                <span className="text-(--tracking-mfg) text-[12px] leading-[15px]">{q.meta}</span>
                {q.blocking && <Pill tone="red">{fr.questions.blocking}</Pill>}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
