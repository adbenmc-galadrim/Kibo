import type { Question } from "@kibo/schema";
import { useAutoAnimate } from "@kibo/sdk/ui/auto-animate";
import { TooltipProvider } from "@kibo/sdk/ui/tooltip";
import { useState } from "react";
import { fr } from "./fr";
import { QuestionRow, ROW_GRID } from "./QuestionRow";
import type { QuestionsData } from "./use-questions";

const TITLE_TOOLTIP_DELAY_MS = 300;

type Props = { questions: readonly Question[]; data: QuestionsData; now: number };

export function QuestionsTable({ questions, data, now }: Props) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [body] = useAutoAnimate<HTMLDivElement>();
  const c = fr.columns;
  return (
    <TooltipProvider delayDuration={TITLE_TOOLTIP_DELAY_MS}>
      <div className="overflow-hidden rounded-[10px] border bg-card">
        <div className={`${ROW_GRID} h-8 text-[11.5px] text-muted-foreground`}>
          <span>{c.number}</span>
          <span>{c.question}</span>
          <span>{c.recipient}</span>
          <span />
          <span>{c.ticket}</span>
          <span>{c.age}</span>
          <span />
        </div>
        <div ref={body}>
          {questions.flatMap((q) => {
            const ticket = data.ticketOf(q.ticketId);
            if (ticket === null) return [];
            return [
              <QuestionRow
                key={q.id}
                question={q}
                ticket={ticket}
                data={data}
                now={now}
                expanded={expanded === q.id}
                onToggle={() => setExpanded((id) => (id === q.id ? null : q.id))}
                onExpand={() => setExpanded(q.id)}
              />,
            ];
          })}
        </div>
      </div>
    </TooltipProvider>
  );
}
