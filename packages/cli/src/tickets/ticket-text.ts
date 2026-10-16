import { frTickets as t } from "../fr";
import type { DetailExtras } from "./ticket-detail";
import type { TicketSummary } from "./ticket-view";

export type TicketDetail = TicketSummary & DetailExtras & { description: string };

export const listLine = (s: TicketSummary): string => [s.key, s.planId ?? "-", s.status, s.title].join("\t");

export function detailLines(d: TicketDetail): string[] {
  return [
    [d.key, d.planId, d.title].filter((part) => part !== null).join(" · "),
    t.status(d.status, d.column),
    ...(d.blockedReason === null ? [] : [t.blocked(d.blockedReason)]),
    t.parent(d.parent),
    t.feature(d.feature),
    t.sprint(d.sprint),
    ...(d.optional ? [t.optional] : []),
    t.children(d.children),
    t.deps(d.deps),
    t.pr(d.pr),
    t.assignee(d.assignee),
    t.labels(d.labels),
    t.brief(d.brief),
    t.notes(d.notes.map((n) => n.path)),
    t.questions(d.questions.length),
    ...d.questions.map((q) => t.question(q.state, q.title, q.recipient.name, q.blocking)),
    "",
    t.description,
    d.description,
  ];
}
