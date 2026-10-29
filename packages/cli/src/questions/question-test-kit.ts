import { Question, type QuestionRecipient } from "@kibo/schema";

type QuestionInput = {
  id: string;
  number: number | null;
  ticketId?: string;
  title?: string;
  options?: string[];
  provisional?: string | null;
  blocking?: boolean;
  recipient?: string;
  createdAt?: number;
  answer?: { kind: "option" | "text"; option: string | null; text: string } | null;
  archived?: boolean;
};

const HUMAN = { kind: "human", ref: "u-me" } as const;

export function fakeQuestion(input: QuestionInput): Question {
  return Question.parse({
    id: input.id,
    ticketId: input.ticketId ?? "a",
    runId: null,
    title: input.title ?? `Question ${input.id}`,
    context: "",
    options: input.options ?? [],
    provisional: input.provisional ?? null,
    blocking: input.blocking ?? false,
    createdBy: HUMAN,
    createdAt: input.createdAt ?? 1_793_000_000_000,
    number: input.number,
    answer: input.answer ? { ...input.answer, by: HUMAN, at: 1_793_000_100_000 } : null,
    recipient: input.recipient,
    archivedAt: input.archived ? 1_793_000_200_000 : null,
    archivedBy: input.archived ? HUMAN : null,
  });
}

export const RECIPIENTS: QuestionRecipient[] = [
  { id: "me", name: "moi" },
  { id: "r-client", name: "client" },
];

export const QUESTIONS: Question[] = [
  fakeQuestion({
    id: "q2",
    number: 2,
    title: "Ancienne question",
    archived: true,
  }),
  fakeQuestion({
    id: "q1",
    number: 1,
    title: "Quel format ?",
    options: ["A", "B"],
    blocking: true,
    recipient: "r-client",
  }),
];
