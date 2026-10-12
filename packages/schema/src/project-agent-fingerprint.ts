import { z } from "zod";
import { isArchived, isOpen, type Question } from "./question";
import { RunState } from "./run";

export const TicketPrintSchema = z.object({
  key: z.string().nullable(),
  title: z.string(),
  statusId: z.string(),
  labels: z.array(z.string()),
  parentId: z.string().nullable(),
  assignee: z.string().nullable(),
  branch: z.string().nullable(),
  pr: z.string().nullable(),
  blockedBy: z.array(z.string()).default([]),
});
export type TicketPrint = z.infer<typeof TicketPrintSchema>;

export const QuestionPrintSchema = z.union([
  z.enum(["open", "answered"]),
  z.object({ state: z.enum(["open", "answered", "archived"]), title: z.string(), recipient: z.string() }),
]);
export type QuestionPrint = z.infer<typeof QuestionPrintSchema>;

export function questionPrintOf(q: Question): QuestionPrint {
  const state = isArchived(q) ? "archived" : isOpen(q) ? "open" : "answered";
  return { state, title: q.title, recipient: q.recipient };
}

export const ProjectFingerprintSchema = z.object({
  tickets: z.record(z.string(), TicketPrintSchema),
  questions: z.record(z.string(), QuestionPrintSchema),
  runs: z.record(z.string(), RunState),
  notes: z.record(z.string(), z.string()),
});
export type ProjectFingerprint = z.infer<typeof ProjectFingerprintSchema>;
