import { z } from "zod";
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
});
export type TicketPrint = z.infer<typeof TicketPrintSchema>;

export const QuestionPrintSchema = z.enum(["open", "answered"]);
export type QuestionPrint = z.infer<typeof QuestionPrintSchema>;

export const ProjectFingerprintSchema = z.object({
  tickets: z.record(z.string(), TicketPrintSchema),
  questions: z.record(z.string(), QuestionPrintSchema),
  runs: z.record(z.string(), RunState),
  notes: z.record(z.string(), z.string()),
});
export type ProjectFingerprint = z.infer<typeof ProjectFingerprintSchema>;
