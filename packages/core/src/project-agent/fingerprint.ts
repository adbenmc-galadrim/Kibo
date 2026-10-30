import {
  type Link,
  type ProjectFingerprint,
  type ProjectSnapshot,
  questionPrintOf,
  type RunView,
  type TicketPrint,
  type TicketView,
} from "@kibo/schema";
import { assigneeOf, branchOf, prOf } from "./ticket-facts";

export type NoteHash = { path: string; hash: string };

const sortedRecord = <T>(entries: readonly (readonly [string, T])[]): Record<string, T> =>
  Object.fromEntries([...entries].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));

const byText = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

export function blockersOf(
  ticketId: string,
  links: readonly Link[],
  tickets: readonly Pick<TicketView, "id" | "key">[],
): string[] {
  const keyOf = (id: string) => tickets.find((t) => t.id === id)?.key ?? id;
  return links
    .filter((l) => l.type === "blocks" && l.to === ticketId)
    .map((l) => keyOf(l.from))
    .sort(byText);
}

export const ticketPrint = (t: TicketView, blockedBy: readonly string[] = []): TicketPrint => ({
  key: t.key,
  title: t.title,
  statusId: t.statusId,
  labels: [...t.labels],
  parentId: t.parentId,
  assignee: assigneeOf(t),
  branch: branchOf(t.externalRefs),
  pr: prOf(t.externalRefs),
  blockedBy: [...blockedBy],
  hold: t.hold,
});

export function fingerprint(input: {
  project: ProjectSnapshot;
  runs: readonly RunView[];
  notes: readonly NoteHash[];
}): ProjectFingerprint {
  const { project } = input;
  return {
    tickets: sortedRecord(
      project.tickets.map(
        (t) => [t.id, ticketPrint(t, blockersOf(t.id, project.links, project.tickets))] as const,
      ),
    ),
    questions: sortedRecord(project.questions.map((q) => [q.id, questionPrintOf(q)] as const)),
    runs: sortedRecord(
      input.runs
        .filter((r) => r.projectId === project.meta.id && r.ticketId !== null)
        .map((r) => [r.id, r.state] as const),
    ),
    notes: sortedRecord(input.notes.map((n) => [n.path, n.hash] as const)),
  };
}
