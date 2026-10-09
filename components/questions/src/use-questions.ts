import type { AnswerInput, KiboError, Question, TicketRun, TicketView } from "@kibo/schema";
import { useEntities, useReadOnly, useSdk } from "@kibo/sdk";
import { useCallback, useMemo } from "react";

export type QuestionsData = {
  questions: Question[];
  tickets: TicketView[];
  runs: TicketRun[];
  loading: boolean;
  error: KiboError | null;
  readOnly: boolean;
  viewer: string;
  runLabel(runId: string): string;
  ticketOf(id: string): TicketView | null;
};

export function useQuestions(): QuestionsData {
  const sdk = useSdk();
  const questions = useEntities("question");
  const tickets = useEntities("ticket");
  const runs = useEntities("run");
  const readOnly = useReadOnly();
  const runLabel = useCallback(
    (runId: string) => runs.data.find((r) => r.runId === runId)?.label ?? runId,
    [runs.data],
  );
  const byId = useMemo(() => new Map(tickets.data.map((t) => [t.id, t])), [tickets.data]);
  const ticketOf = useCallback((id: string) => byId.get(id) ?? null, [byId]);
  return {
    questions: questions.data,
    tickets: tickets.data,
    runs: runs.data,
    loading: questions.loading || tickets.loading,
    error: questions.error ?? tickets.error,
    readOnly,
    viewer: sdk.viewer,
    runLabel,
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
