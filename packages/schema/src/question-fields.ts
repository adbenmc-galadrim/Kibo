import { z } from "zod";

export const QUESTION_TITLE_MAX = 200;
export const QUESTION_CONTEXT_MAX = 8000;
export const QUESTION_OPTIONS_MAX = 6;
export const QUESTION_OPTION_MAX = 120;
export const ANSWER_TEXT_MAX = 4000;

export const QuestionTitle = z.string().trim().min(1).max(QUESTION_TITLE_MAX);
export const QuestionContext = z.string().max(QUESTION_CONTEXT_MAX);
export const QuestionOption = z.string().trim().min(1).max(QUESTION_OPTION_MAX);
export const QuestionOptions = z
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
  deliveredAt: z.number().int().nullable().default(null),
  deliveredRunId: z.string().min(1).nullable().default(null),
});
export type QuestionAnswer = z.infer<typeof QuestionAnswer>;
