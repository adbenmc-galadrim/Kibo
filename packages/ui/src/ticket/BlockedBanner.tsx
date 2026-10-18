import {
  blockingQuestion,
  findRecipient,
  isBlocked,
  type Question,
  type QuestionRecipient,
  questionLabel,
  type TicketView,
} from "@kibo/schema";
import { cn } from "@kibo/sdk/lib/utils";
import { Button } from "@kibo/sdk/ui/button";
import { MessageCircleQuestion, OctagonAlert } from "lucide-react";
import { frFeature } from "../i18n/fr-group";
import { frTicketTracking } from "../i18n/fr-ticket-tracking";

type Props = {
  ticket: Pick<TicketView, "id" | "statusId" | "parentId">;
  questions: readonly Question[];
  recipients: readonly QuestionRecipient[];
  onOpen(questionId: string): void;
};

const t = frTicketTracking.blocked;
const BOX = "flex items-center gap-2 rounded-lg border px-3 py-2 text-[13px]";

const dayOf = (at: number): string => {
  const d = new Date(at);
  return `${d.getDate()} ${frFeature.month(d.getMonth())}`;
};

function detailOf(question: Question, recipients: readonly QuestionRecipient[]): string {
  const recipient = findRecipient(recipients, question.recipient)?.name ?? question.recipient;
  return question.sentAt === null
    ? t.asked(recipient, dayOf(question.createdAt))
    : t.sent(recipient, dayOf(question.sentAt));
}

export function BlockedBanner({ ticket, questions, recipients, onOpen }: Props) {
  const question = blockingQuestion(ticket, questions);
  if (question === null) return null;
  const blocked = isBlocked(ticket, questions);
  const detail = detailOf(question, recipients);
  const Icon = blocked ? OctagonAlert : MessageCircleQuestion;
  const content = (
    <>
      <Icon
        aria-hidden
        className={cn("size-3.5 shrink-0", blocked ? "text-(--tracking-red)" : "text-(--tracking-amber)")}
      />
      <p
        className={cn(
          "min-w-0 flex-1 font-medium",
          blocked ? "text-(--tracking-red)" : "text-(--tracking-amber)",
        )}
      >
        {blocked ? t.by(questionLabel(question), detail) : t.mention(questionLabel(question), detail)}
      </p>
      <Button
        variant="ghost"
        size="sm"
        className="h-6 shrink-0 px-2 text-xs"
        onClick={() => onOpen(question.id)}
      >
        {t.open}
      </Button>
    </>
  );
  if (blocked)
    return (
      <div
        role="alert"
        aria-label={t.label}
        className={cn(BOX, "border-(--tracking-red)/30 bg-(--tracking-red-soft)")}
      >
        {content}
      </div>
    );
  return (
    <output
      aria-label={t.mentionLabel}
      className={cn(BOX, "border-(--tracking-amber)/30 bg-(--tracking-amber-soft)")}
    >
      {content}
    </output>
  );
}
