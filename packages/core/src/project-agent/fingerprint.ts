import { type ProjectSnapshot, RunState, type RunView, type TicketView } from "@kibo/schema";
import { z } from "zod";
import { assigneeOf, branchOf, prOf } from "./ticket-facts";

export type TicketPrint = {
  key: string | null;
  title: string;
  statusId: string;
  labels: string[];
  parentId: string | null;
  assignee: string | null;
  branch: string | null;
  pr: string | null;
};
export type QuestionPrint = "open" | "answered";
export type ProjectFingerprint = {
  tickets: Record<string, TicketPrint>;
  questions: Record<string, QuestionPrint>;
  runs: Record<string, RunState>;
  notes: Record<string, string>;
};
export type NoteHash = { path: string; hash: string };

const TicketPrintSchema = z.object({
  key: z.string().nullable(),
  title: z.string(),
  statusId: z.string(),
  labels: z.array(z.string()),
  parentId: z.string().nullable(),
  assignee: z.string().nullable(),
  branch: z.string().nullable(),
  pr: z.string().nullable(),
});

export const ProjectFingerprintSchema: z.ZodType<ProjectFingerprint> = z.object({
  tickets: z.record(z.string(), TicketPrintSchema),
  questions: z.record(z.string(), z.enum(["open", "answered"])),
  runs: z.record(z.string(), RunState),
  notes: z.record(z.string(), z.string()),
});

const sortedRecord = <T>(entries: readonly (readonly [string, T])[]): Record<string, T> =>
  Object.fromEntries([...entries].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));

export const ticketPrint = (t: TicketView): TicketPrint => ({
  key: t.key,
  title: t.title,
  statusId: t.statusId,
  labels: [...t.labels],
  parentId: t.parentId,
  assignee: assigneeOf(t),
  branch: branchOf(t.externalRefs),
  pr: prOf(t.externalRefs),
});

export function fingerprint(input: {
  project: ProjectSnapshot;
  runs: readonly RunView[];
  notes: readonly NoteHash[];
}): ProjectFingerprint {
  const { project } = input;
  return {
    tickets: sortedRecord(project.tickets.map((t) => [t.id, ticketPrint(t)] as const)),
    questions: sortedRecord(
      project.questions.map((q) => [q.id, q.answer === null ? "open" : "answered"] as const),
    ),
    runs: sortedRecord(
      input.runs.filter((r) => r.projectId === project.meta.id).map((r) => [r.id, r.state] as const),
    ),
    notes: sortedRecord(input.notes.map((n) => [n.path, n.hash] as const)),
  };
}
