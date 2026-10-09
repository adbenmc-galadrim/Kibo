import type { ProjectFingerprint, ProjectSnapshot, RunView, TicketPrint, TicketView } from "@kibo/schema";
import { assigneeOf, branchOf, prOf } from "./ticket-facts";

export type NoteHash = { path: string; hash: string };

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
      input.runs
        .filter((r) => r.projectId === project.meta.id && r.kind !== "project")
        .map((r) => [r.id, r.state] as const),
    ),
    notes: sortedRecord(input.notes.map((n) => [n.path, n.hash] as const)),
  };
}
