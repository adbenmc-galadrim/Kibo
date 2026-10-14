import { z } from "zod";
import { KiboError } from "./errors";
import { ImportRef } from "./git-branch";
import { NodeId } from "./ids";
import {
  Actor,
  ANSWER_TEXT_MAX,
  AnswerKind,
  QUESTION_CONTEXT_MAX,
  QUESTION_OPTION_MAX,
  QUESTION_OPTIONS_MAX,
  QUESTION_TITLE_MAX,
  QuestionAnswer,
  QuestionOption,
  QuestionOptions,
  QuestionTitle,
} from "./question-fields";
import { QUESTION_HISTORY_MAX, QuestionEvent } from "./question-history";
import { AskImages, QuestionImages, QuestionKind } from "./question-image";
import { ME_RECIPIENT, RECIPIENT_ID_MAX } from "./question-recipient";
import type { RunView } from "./run";

export {
  Actor,
  ANSWER_TEXT_MAX,
  AnswerKind,
  QUESTION_CONTEXT_MAX,
  QUESTION_OPTION_MAX,
  QUESTION_OPTIONS_MAX,
  QUESTION_TITLE_MAX,
  QuestionAnswer,
  QuestionOption,
  QuestionTitle,
} from "./question-fields";

export const OPEN_PER_RUN_MAX = 50;
export const QUESTIONS_PER_TICKET_MAX = 500;

type QuestionShape = {
  options: string[];
  provisional: string | null;
  answer: QuestionAnswer | null;
  archivedAt: number | null;
  archivedBy: Actor | null;
};

function answerProblem(q: QuestionShape, answer: QuestionAnswer): string | null {
  if ((answer.deliveredAt === null) !== (answer.deliveredRunId === null)) {
    return "a delivery needs both its date and its run";
  }
  switch (answer.kind) {
    case "option":
      return answer.option !== null && q.options.includes(answer.option) ? null : "answer cites no option";
    case "confirm":
      return q.provisional !== null && answer.option === q.provisional
        ? null
        : "confirm needs the provisional choice";
    case "text":
      return answer.text.length > 0 ? null : "text answer is empty";
  }
}

function questionProblem(q: QuestionShape): string | null {
  if (q.provisional !== null && q.options.length > 0 && !q.options.includes(q.provisional)) {
    return "provisional choice is not an option";
  }
  if ((q.archivedAt === null) !== (q.archivedBy === null))
    return "an archive needs both its date and its actor";
  return q.answer === null ? null : answerProblem(q, q.answer);
}

export const Question = z
  .object({
    id: NodeId,
    ticketId: NodeId,
    runId: z.string().nullable(),
    title: QuestionTitle,
    context: z.string().max(QUESTION_CONTEXT_MAX),
    options: QuestionOptions,
    provisional: QuestionOption.nullable(),
    blocking: z.boolean(),
    createdBy: Actor,
    createdAt: z.number().int(),
    importRef: ImportRef.nullable().default(null),
    answer: QuestionAnswer.nullable(),
    recipient: z.string().max(RECIPIENT_ID_MAX).default(ME_RECIPIENT),
    sentAt: z.number().int().nullable().default(null),
    history: z.array(QuestionEvent).max(QUESTION_HISTORY_MAX).default([]),
    archivedAt: z.number().int().nullable().default(null),
    archivedBy: Actor.nullable().default(null),
    kind: QuestionKind.default("question"),
    images: QuestionImages.default([]),
  })
  .superRefine((q, ctx) => {
    const problem = questionProblem(q);
    if (problem) ctx.addIssue({ code: z.ZodIssueCode.custom, message: problem });
  });
export type Question = z.infer<typeof Question>;

export const AnswerInput = z.object({
  kind: AnswerKind,
  option: QuestionOption.optional(),
  text: z.string().optional(),
});
export type AnswerInput = z.infer<typeof AnswerInput>;

export const AskInput = z.object({
  title: QuestionTitle,
  context: z.string().max(QUESTION_CONTEXT_MAX),
  options: QuestionOptions,
  provisional: QuestionOption.nullable(),
  blocking: z.boolean(),
  recipient: z.string().max(RECIPIENT_ID_MAX).nullable().default(null),
  kind: QuestionKind.default("question"),
  images: AskImages.default([]),
});
export type AskInput = z.infer<typeof AskInput>;

export type RunQuestions = { runId: string; open: number; undelivered: number; latestTitle: string | null };

export const DeliveryResult = z.object({
  sent: z.number().int().nonnegative(),
  runId: z.string().nullable(),
});
export type DeliveryResult = z.infer<typeof DeliveryResult>;

export type AnswerChoice = Omit<QuestionAnswer, "by" | "at" | "deliveredAt" | "deliveredRunId">;

export const isArchived = (q: Question): boolean => q.archivedAt !== null;
export const isOpen = (q: Question): boolean => q.answer === null && !isArchived(q);
export const isAnswered = (q: Question): boolean => q.answer !== null && !isArchived(q);
export const isDelivered = (q: Question): boolean => q.answer !== null && q.answer.deliveredAt !== null;
export const isEditableAnswer = (q: Question): boolean => isAnswered(q) && !isDelivered(q);
const isUndelivered = isEditableAnswer;

export function openQuestions(questions: readonly Question[], ticketId: string): Question[] {
  return questions.filter((q) => q.ticketId === ticketId && isOpen(q));
}

export function questionsOfRun(questions: readonly Question[], runId: string): Question[] {
  return questions.filter((q) => q.runId === runId);
}

type RunTally = { open: number; undelivered: number; newestOpen: Question | null };

function tally(known: RunTally | undefined, q: Question): RunTally {
  const current = known ?? { open: 0, undelivered: 0, newestOpen: null };
  if (isOpen(q)) {
    const newer = current.newestOpen === null || q.createdAt >= current.newestOpen.createdAt;
    return { ...current, open: current.open + 1, newestOpen: newer ? q : current.newestOpen };
  }
  return isUndelivered(q) ? { ...current, undelivered: current.undelivered + 1 } : current;
}

export function countOpenByRun(questions: readonly Question[]): RunQuestions[] {
  const runs = new Map<string, RunTally>();
  for (const q of questions) {
    if (q.runId === null || (!isOpen(q) && !isUndelivered(q))) continue;
    runs.set(q.runId, tally(runs.get(q.runId), q));
  }
  return [...runs]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([runId, { open, undelivered, newestOpen }]) => ({
      runId,
      open,
      undelivered,
      latestTitle: newestOpen?.title ?? null,
    }));
}

export function undeliveredAnswers(questions: readonly Question[], ticketId: string): Question[] {
  return questions
    .filter((q) => q.ticketId === ticketId && isUndelivered(q))
    .sort((a, b) => (a.answer?.at ?? 0) - (b.answer?.at ?? 0) || a.id.localeCompare(b.id));
}

export const awaitsDelivery = (q: Question): boolean => isUndelivered(q) && q.answer?.by.kind !== "import";

export function answersToDeliver(questions: readonly Question[], ticketId: string): Question[] {
  return undeliveredAnswers(questions, ticketId).filter(awaitsDelivery);
}

export function resolveAnswer(q: Question, input: AnswerInput): AnswerChoice {
  switch (input.kind) {
    case "option":
      if (input.option === undefined || !q.options.includes(input.option)) {
        throw new KiboError("INVALID_INPUT", "the answer cites no option of the question");
      }
      return { kind: "option", option: input.option, text: "" };
    case "confirm":
      if (q.provisional === null) throw new KiboError("INVALID_INPUT", "no provisional choice to confirm");
      return { kind: "confirm", option: q.provisional, text: "" };
    case "text": {
      const text = input.text?.trim() ?? "";
      if (!text) throw new KiboError("INVALID_INPUT", "the answer text is empty");
      if (text.length > ANSWER_TEXT_MAX) throw new KiboError("INVALID_INPUT", "the answer text is too long");
      return { kind: "text", option: null, text };
    }
  }
}

function answerText(answer: QuestionAnswer): string {
  switch (answer.kind) {
    case "option":
      return answer.option ?? "";
    case "confirm":
      return `choix provisoire confirmé (${answer.option ?? ""}).`;
    case "text":
      return answer.text;
  }
}

export function answerPrompt(q: Question): string {
  if (q.answer === null) throw new KiboError("INVALID_INPUT", `question ${q.id} is not answered`);
  return `Réponse à ta question « ${q.title} » : ${answerText(q.answer)}`;
}

export function deliveryPrompt(questions: readonly Question[]): string {
  return questions.map((q) => answerPrompt(q)).join("\n");
}

const cut = (value: string, max: number): string => value.trim().slice(0, max).trim();

function stringField(input: Record<string, unknown>, key: string): string | null | undefined {
  const value = input[key];
  if (value === undefined || value === null) return undefined;
  return typeof value === "string" ? value : null;
}

function toolOptions(raw: unknown): string[] | null {
  if (raw === undefined || raw === null) return [];
  if (!Array.isArray(raw) || !raw.every((o): o is string => typeof o === "string")) return null;
  const options = raw.map((o) => cut(o, QUESTION_OPTION_MAX)).filter((o) => o.length > 0);
  return [...new Set(options)].slice(0, QUESTION_OPTIONS_MAX);
}

function toolProvisional(
  raw: string | undefined,
  options: string[],
  blocking: boolean,
): string | null | undefined {
  const provisional = raw === undefined ? "" : cut(raw, QUESTION_OPTION_MAX);
  if (provisional && (options.length === 0 || options.includes(provisional))) return provisional;
  return blocking ? null : undefined;
}

export function askInputFromTool(
  toolInput: Record<string, unknown> | null,
  blocking: boolean,
): AskInput | null {
  if (toolInput === null || typeof toolInput !== "object") return null;
  const question = stringField(toolInput, "question");
  const context = stringField(toolInput, "context");
  const provisionalRaw = stringField(toolInput, "provisional");
  const options = toolOptions(toolInput.options);
  if (!question || context === null || provisionalRaw === null || options === null) return null;
  const provisional = toolProvisional(provisionalRaw, options, blocking);
  if (provisional === undefined) return null;
  const recipient = stringField(toolInput, "recipient");
  const parsed = AskInput.safeParse({
    title: cut(question, QUESTION_TITLE_MAX),
    context: (context ?? "").slice(0, QUESTION_CONTEXT_MAX),
    options,
    provisional,
    blocking,
    recipient: recipient ? cut(recipient, RECIPIENT_ID_MAX) || null : null,
  });
  return parsed.success ? parsed.data : null;
}

export type NoticeText = { title: string; body: string };
type NoticeRun = Pick<RunView, "id" | "label" | "state" | "ticketKey">;

export function askedNotice(run: Pick<RunView, "label" | "ticketKey">, title: string): NoticeText {
  return {
    title: `${run.label} a posé une question`,
    body: run.ticketKey ? `${run.ticketKey} · ${title}` : title,
  };
}

export function questionNotices(
  previous: readonly RunQuestions[],
  next: readonly RunQuestions[],
  runs: readonly NoticeRun[],
): NoticeText[] {
  const before = new Map(previous.map((q) => [q.runId, q.open]));
  return next.flatMap((q) => {
    const run = runs.find((r) => r.id === q.runId);
    if (!run || run.state === "waiting_input" || q.open <= (before.get(q.runId) ?? 0)) return [];
    return [askedNotice(run, q.latestTitle ?? "")];
  });
}
