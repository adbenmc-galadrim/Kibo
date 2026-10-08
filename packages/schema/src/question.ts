import { z } from "zod";
import { KiboError } from "./errors";
import { ImportRef } from "./git-branch";
import { NodeId } from "./ids";

export const QUESTION_TITLE_MAX = 200;
export const QUESTION_CONTEXT_MAX = 8000;
export const QUESTION_OPTIONS_MAX = 6;
export const QUESTION_OPTION_MAX = 120;
export const ANSWER_TEXT_MAX = 4000;
export const OPEN_PER_RUN_MAX = 50;
export const QUESTIONS_PER_TICKET_MAX = 500;

export const QuestionTitle = z.string().trim().min(1).max(QUESTION_TITLE_MAX);
export const QuestionOption = z.string().trim().min(1).max(QUESTION_OPTION_MAX);
const QuestionOptions = z
  .array(QuestionOption)
  .max(QUESTION_OPTIONS_MAX)
  .refine((options) => new Set(options).size === options.length, "options must be unique");

export const Actor = z.object({ kind: z.enum(["human", "agent", "import"]), ref: z.string().min(1).max(80) });
export type Actor = z.infer<typeof Actor>;

export const AnswerKind = z.enum(["option", "confirm", "text"]);
export type AnswerKind = z.infer<typeof AnswerKind>;

export const QuestionAnswer = z.object({
  kind: AnswerKind,
  option: QuestionOption.nullable(),
  text: z.string().trim().max(ANSWER_TEXT_MAX),
  by: Actor,
  at: z.number().int(),
});
export type QuestionAnswer = z.infer<typeof QuestionAnswer>;

type QuestionShape = {
  options: string[];
  provisional: string | null;
  answer: QuestionAnswer | null;
};

function answerProblem(q: QuestionShape, answer: QuestionAnswer): string | null {
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
});
export type AskInput = z.infer<typeof AskInput>;

export type RunQuestions = { runId: string; open: number; latestTitle: string | null };

export const isOpen = (q: Question): boolean => q.answer === null;

export function openQuestions(questions: readonly Question[], ticketId: string): Question[] {
  return questions.filter((q) => q.ticketId === ticketId && isOpen(q));
}

export function questionsOfRun(questions: readonly Question[], runId: string): Question[] {
  return questions.filter((q) => q.runId === runId);
}

export function countOpenByRun(questions: readonly Question[]): RunQuestions[] {
  const latest = new Map<string, { open: number; newest: Question }>();
  for (const q of questions) {
    if (q.runId === null || !isOpen(q)) continue;
    const known = latest.get(q.runId);
    if (!known) latest.set(q.runId, { open: 1, newest: q });
    else
      latest.set(q.runId, {
        open: known.open + 1,
        newest: q.createdAt >= known.newest.createdAt ? q : known.newest,
      });
  }
  return [...latest]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([runId, { open, newest }]) => ({ runId, open, latestTitle: newest.title }));
}

export function resolveAnswer(q: Question, input: AnswerInput): Omit<QuestionAnswer, "by" | "at"> {
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
  if (provisional && options.includes(provisional)) return provisional;
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
  const parsed = AskInput.safeParse({
    title: cut(question, QUESTION_TITLE_MAX),
    context: (context ?? "").slice(0, QUESTION_CONTEXT_MAX),
    options,
    provisional,
    blocking,
  });
  return parsed.success ? parsed.data : null;
}
