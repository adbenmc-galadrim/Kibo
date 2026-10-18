import type {
  ProjectEvent,
  ProjectEventKind,
  ProjectEventSource,
  Question,
  Status,
  TicketView,
} from "@kibo/schema";
import { activityLabel } from "./activity-labels";
import { clockTime } from "./overview-facts";

export const ACTIVITY_SHORT = 4;
export const ACTIVITY_LONG = 50;
export const ACTIVITY_FILTERS: readonly ProjectEventSource[] = ["git", "full-delivery"];

export type ActivityRow = {
  id: number;
  time: string;
  kind: ProjectEventKind;
  label: string;
  ticketId: string | null;
  key: string | null;
  feature: string | null;
  featureId: string | null;
  agent: boolean;
};
export type ActivityInput = {
  tickets: readonly TicketView[];
  questions: readonly Pick<Question, "id" | "importRef">[];
  events: readonly ProjectEvent[];
  workflow: readonly Pick<Status, "id" | "label">[];
};
export type ActivityQuery = { sources: readonly ProjectEventSource[]; limit: number };

export function activityRows(input: ActivityInput, query: ActivityQuery): ActivityRow[] {
  const byId = new Map(input.tickets.map((t) => [t.id, t]));
  const statusName = (id: string) => input.workflow.find((s) => s.id === id)?.label ?? id;
  const questionRef = (id: string) => input.questions.find((q) => q.id === id)?.importRef?.id ?? null;
  return input.events
    .filter((e) => query.sources.length === 0 || query.sources.includes(e.source))
    .sort((a, b) => b.at - a.at || b.id - a.id)
    .slice(0, query.limit)
    .map((e) => {
      const ticket = e.ticketId === null ? undefined : byId.get(e.ticketId);
      const feature = e.featureId === null ? undefined : byId.get(e.featureId);
      const subject = feature?.shortKey ?? ticket?.shortKey ?? ticket?.keyLabel ?? "";
      const agent = e.source === "project-agent";
      return {
        id: e.id,
        time: clockTime(e.at),
        kind: e.kind,
        label: activityLabel(e, { subject, statusName, questionRef }),
        ticketId: ticket?.id ?? null,
        key: agent || ticket?.id === feature?.id ? null : (ticket?.keyLabel ?? null),
        feature: agent ? null : (feature?.shortKey ?? null),
        featureId: feature?.id ?? null,
        agent,
      };
    });
}
