import { Badge } from "@kibo/sdk/ui/badge";
import { MessageCircleQuestion } from "lucide-react";
import { frQuestions } from "../i18n/fr-questions";

type Props = { count: number; onOpen(): void };

export function QuestionsBadge({ count, onOpen }: Props) {
  if (count <= 0) return null;
  return (
    <Badge
      asChild
      variant="outline"
      className="cursor-pointer gap-1 border-orange-500/40 text-orange-600 hover:bg-orange-500/10 dark:text-orange-400"
    >
      <button type="button" title={frQuestions.open} onClick={onOpen}>
        <MessageCircleQuestion aria-hidden />
        {frQuestions.badge(count)}
      </button>
    </Badge>
  );
}
