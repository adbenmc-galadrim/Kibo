import { z } from "zod";
import type { Question } from "./question";

export const RECIPIENTS_MAX = 20;
export const RECIPIENT_ID_MAX = 40;
export const ME_RECIPIENT = "me";

export const RecipientId = z.string().min(1).max(RECIPIENT_ID_MAX);

export const QuestionRecipient = z.object({
  id: RecipientId,
  name: z.string().trim().min(1).max(40),
});
export type QuestionRecipient = z.infer<typeof QuestionRecipient>;

export const DEFAULT_RECIPIENTS: readonly QuestionRecipient[] = [
  { id: ME_RECIPIENT, name: "Moi (technique)" },
  { id: "product", name: "Produit" },
  { id: "client", name: "Client" },
];

const folded = (value: string): string => value.trim().toLocaleLowerCase("fr");

export function findRecipient(
  recipients: readonly QuestionRecipient[],
  raw: string | null | undefined,
): QuestionRecipient | null {
  if (!raw) return null;
  const byId = recipients.find((r) => r.id === raw);
  if (byId) return byId;
  const wanted = folded(raw);
  return recipients.find((r) => folded(r.name) === wanted) ?? null;
}

export function resolveRecipient(
  recipients: readonly QuestionRecipient[],
  raw: string | null | undefined,
): string {
  return findRecipient(recipients, raw)?.id ?? ME_RECIPIENT;
}

export function openCountByRecipient(questions: readonly Question[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const q of questions)
    if (q.answer === null && q.archivedAt === null)
      counts.set(q.recipient, (counts.get(q.recipient) ?? 0) + 1);
  return counts;
}
