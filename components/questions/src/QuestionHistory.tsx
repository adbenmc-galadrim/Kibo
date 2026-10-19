import type { Question } from "@kibo/schema";
import { useMembers } from "@kibo/sdk";
import { History } from "lucide-react";
import { fr } from "./fr";
import { type HistoryContext, historyEntries, historyLine } from "./question-history-text";

type ToggleProps = { question: Question; open: boolean; onToggle(): void };

export function HistoryToggle({ question, open, onToggle }: ToggleProps) {
  if (question.history.length === 0) return null;
  return (
    <button
      type="button"
      aria-expanded={open}
      onClick={onToggle}
      className="inline-flex cursor-pointer select-none items-center gap-1 rounded-sm text-2xs text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <History aria-hidden className="size-3" />
      {fr.history(question.history.length)}
    </button>
  );
}

type HistoryProps = { question: Question; context: Omit<HistoryContext, "members"> };

export function QuestionHistory({ question, context }: HistoryProps) {
  const members = useMembers();
  return (
    <ul className="grid gap-1 border-l pl-3 text-2xs text-muted-foreground">
      {historyEntries(question).map((entry) => (
        <li key={entry.position}>{historyLine(entry, { ...context, members })}</li>
      ))}
    </ul>
  );
}
