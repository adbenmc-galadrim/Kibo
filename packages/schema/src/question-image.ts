import { z } from "zod";
import type { AskInput } from "./question";

export const QuestionKind = z.enum(["question", "validation"]);
export type QuestionKind = z.infer<typeof QuestionKind>;
export const VALIDATION_OPTIONS = ["Valider", "Demander une correction"] as const;
export const QUESTION_IMAGE_LIMITS = {
  count: 6,
  bytes: 5_242_880,
  extensions: ["png", "jpg", "jpeg", "webp"],
} as const;

export const QuestionImage = z.object({
  id: z.string().min(1),
  name: z.string().max(200),
  bytes: z.number().int().nonnegative(),
  width: z.number().int().nullable(),
  height: z.number().int().nullable(),
});
export type QuestionImage = z.infer<typeof QuestionImage>;

export const AskImages = z.array(z.string().min(1).max(4096)).max(QUESTION_IMAGE_LIMITS.count);
export const QuestionImages = z.array(QuestionImage).max(QUESTION_IMAGE_LIMITS.count);

export const validationAsk = (input: AskInput): AskInput => ({
  ...input,
  kind: "validation",
  options: [...VALIDATION_OPTIONS],
  provisional: null,
  blocking: true,
});

export const correctionAnswer = (text: string): string => `${VALIDATION_OPTIONS[1]} : ${text.trim()}`;
