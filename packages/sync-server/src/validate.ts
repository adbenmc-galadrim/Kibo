import { KiboError } from "@kibo/schema";
import type { z } from "zod";

export function validate<T extends z.ZodTypeAny>(schema: T, value: unknown): z.infer<T> {
  const parsed = schema.safeParse(value);
  if (!parsed.success) throw new KiboError("INVALID_INPUT", `invalid input: ${parsed.error.message}`);
  return parsed.data;
}
