import { DELIVERY_STEP_LABELS, DELIVERY_STEP_MAX, type DeliveryStep } from "@kibo/schema";
import { frTickets as t } from "../fr";
import type { DetailExtras } from "./ticket-detail";
import type { TicketSummary } from "./ticket-view";

export type TicketDetail = TicketSummary & DetailExtras & { description: string };

const twoDigits = (n: number) => String(n).padStart(2, "0");

export function clockTime(at: number): string {
  const date = new Date(at);
  return `${twoDigits(date.getHours())}:${twoDigits(date.getMinutes())}`;
}

const touchUpLines = (delivery: DeliveryStep | null): string[] =>
  delivery?.kind === "update"
    ? [t.touchUp(delivery.step, DELIVERY_STEP_MAX, DELIVERY_STEP_LABELS[delivery.step] ?? "")]
    : [];

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
    ...(d.session === null ? [] : [t.session(d.session.tool, clockTime(d.session.startedAt))]),
    ...touchUpLines(d.delivery),
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
