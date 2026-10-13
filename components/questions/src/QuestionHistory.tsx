import type { Question } from "@kibo/schema";
import { History } from "lucide-react";
import { fr } from "./fr";
import { type HistoryContext, historyEntries, historyLine } from "./question-history-text";

type Props = { question: Question; context: HistoryContext };

export function QuestionHistory({ question, context }: Props) {
  if (question.history.length === 0) return null;
  return (
    <details className="group text-2xs text-muted-foreground">
      <summary className="inline-flex cursor-pointer select-none items-center gap-1 rounded-sm hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <History aria-hidden className="size-3" />
        {fr.history(question.history.length)}
      </summary>
      <ul className="mt-1.5 grid gap-1 border-l pl-3">
        {historyEntries(question).map((entry) => (
          <li key={entry.position}>{historyLine(entry, context)}</li>
        ))}
      </ul>
    </details>
  );
}
