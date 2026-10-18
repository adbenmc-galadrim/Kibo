import {
  blockingQuestion,
  findRecipient,
  type Question,
  type QuestionRecipient,
  questionLabel,
  type TicketView,
} from "@kibo/schema";
import { Button } from "@kibo/sdk/ui/button";
import { OctagonAlert } from "lucide-react";
import { frFeature } from "../i18n/fr-group";
import { frTicketTracking } from "../i18n/fr-ticket-tracking";

type Props = {
  ticket: Pick<TicketView, "id">;
  questions: readonly Question[];
  recipients: readonly QuestionRecipient[];
  onOpen(questionId: string): void;
};

const t = frTicketTracking.blocked;

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
  return (
    <div
      role="alert"
      aria-label={t.label}
      className="flex items-center gap-2 rounded-lg border border-(--tracking-red)/30 bg-(--tracking-red-soft) px-3 py-2 text-[13px]"
    >
      <OctagonAlert aria-hidden className="size-3.5 shrink-0 text-(--tracking-red)" />
      <p className="min-w-0 flex-1 font-medium text-(--tracking-red)">
        {t.by(questionLabel(question), detailOf(question, recipients))}
      </p>
      <Button
        variant="ghost"
        size="sm"
        className="h-6 shrink-0 px-2 text-xs"
        onClick={() => onOpen(question.id)}
      >
        {t.open}
      </Button>
    </div>
  );
}
