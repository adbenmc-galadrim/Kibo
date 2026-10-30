import type {
  AnswerInput,
  KiboError,
  Question,
  QuestionRecipient,
  SprintView,
  TicketView,
} from "@kibo/schema";
import { useEntities, useQuestionRecipients, useSdk } from "@kibo/sdk";
import { useCallback, useMemo } from "react";
import { useProjectClient } from "./use-project-client";

export type QuestionsData = {
  questions: Question[];
  tickets: TicketView[];
  sprints: SprintView[];
  client: string | null;
  recipients: QuestionRecipient[];
  loading: boolean;
  error: KiboError | null;
  viewer: string;
  ticketOf(id: string): TicketView | null;
};

export function useQuestions(): QuestionsData {
  const sdk = useSdk();
  const questions = useEntities("question");
  const tickets = useEntities("ticket");
  const sprints = useEntities("sprint");
  const client = useProjectClient();
  const recipients = useQuestionRecipients();
  const byId = useMemo(() => new Map(tickets.data.map((t) => [t.id, t])), [tickets.data]);
  const ticketOf = useCallback((id: string) => byId.get(id) ?? null, [byId]);
  return {
    questions: questions.data,
    tickets: tickets.data,
    sprints: sprints.data,
    client,
    recipients,
    loading: questions.loading || tickets.loading,
    error: questions.error ?? tickets.error,
    viewer: sdk.viewer,
    ticketOf,
  };
}

export function useAnswer(): (question: Question, answer: AnswerInput) => Promise<void> {
  const sdk = useSdk();
  return useCallback(
    async (question, answer) => {
      await sdk.run({
        method: "answerQuestion",
        questionId: question.id,
        answer,
        by: { kind: "human", ref: sdk.viewer },
      });
    },
    [sdk],
  );
}
