import type { ProjectSnapshot, Question, QuestionRecipient, TicketView } from "@kibo/schema";
import { QuestionPreview } from "@kibo/sdk";
import { createContext, useContext } from "react";

export type QuestionLinks = {
  questions: readonly Question[];
  recipients: readonly QuestionRecipient[];
  ticketOf(question: Question): Pick<TicketView, "id" | "keyLabel" | "title">;
  runLabel(runId: string): string;
  open(questionId: string): void;
};

export const QuestionLinksContext = createContext<QuestionLinks | null>(null);

export const projectQuestionLinks = (
  project: ProjectSnapshot,
  open: (questionId: string) => void,
): QuestionLinks => ({
  questions: project.questions,
  recipients: project.questionRecipients,
  ticketOf: (q) =>
    project.tickets.find((t) => t.id === q.ticketId) ?? { id: q.ticketId, keyLabel: "", title: "" },
  runLabel: (runId) => runId,
  open,
});

export function QuestionText({ questionId, text }: { questionId: string; text: string }) {
  const links = useContext(QuestionLinksContext);
  const question = links?.questions.find((q) => q.id === questionId);
  if (!links || !question) return text;
  return (
    <QuestionPreview
      mode="question"
      questions={[question]}
      recipients={links.recipients}
      ticket={links.ticketOf(question)}
      runLabel={links.runLabel}
      onOpen={links.open}
    >
      <button
        type="button"
        className="rounded-sm text-left hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        onClick={() => links.open(questionId)}
      >
        {text}
      </button>
    </QuestionPreview>
  );
}
