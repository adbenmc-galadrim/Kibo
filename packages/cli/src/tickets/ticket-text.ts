import { DELIVERY_STEP_LABELS, DELIVERY_STEP_MAX, type DeliveryStep } from "@kibo/schema";
import { frTickets as t } from "../fr";
import { holdLine } from "./hold-text";
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

const DEMO_TITLE = "démo client";

function displayTitle(s: Pick<TicketSummary, "title" | "feature">): string {
  if (s.feature === null || s.title.trim().toLowerCase() !== DEMO_TITLE) return s.title;
  return t.demo(s.feature.shortKey ?? s.feature.key);
}

const PLAN_COLUMN = 1;

const listCells = (s: TicketSummary): string[] => [
  s.key,
  s.planId ?? "-",
  s.feature?.shortKey ?? "-",
  `${s.onHold === null ? "" : "⏸ "}${s.status}`,
  displayTitle(s),
];

export function listLines(tickets: readonly TicketSummary[]): string[] {
  const withPlan = tickets.some((s) => s.planId !== null);
  const visible = (row: readonly string[]) => (withPlan ? [...row] : row.filter((_, i) => i !== PLAN_COLUMN));
  const rows = [t.columns, ...tickets.map(listCells)].map(visible);
  const widths = (rows[0] ?? []).map((_, i) => Math.max(...rows.map((r) => r[i]?.length ?? 0)));
  const line = (row: readonly string[]) =>
    row.map((cell, i) => (i === row.length - 1 ? cell : cell.padEnd((widths[i] ?? 0) + 2))).join("");
  return rows.map(line);
}

const descriptionLines = (description: string): string[] =>
  description.trim() === "" ? [t.noDescription] : [t.description, description];

export function detailLines(d: TicketDetail): string[] {
  return [
    [d.key, d.planId, displayTitle(d)].filter((part) => part !== null).join(" · "),
    t.status(d.status, d.column),
    ...(d.onHold === null ? [] : [holdLine(d.onHold)]),
    ...(d.blockedReason === null ? [] : [t.blocked(d.blockedReason)]),
    t.parent(d.parent),
    t.feature(d.feature),
    t.sprint(d.sprint),
    ...(d.optional ? [t.optional] : []),
    ...(d.session === null ? [] : [t.session(d.session.tool, clockTime(d.session.startedAt))]),
    ...touchUpLines(d.delivery),
    t.children(d.children),
    t.deps(d.deps),
    t.branch(d.branch),
    t.pr(d.pr),
    t.assignee(d.assignee),
    t.labels(d.labels),
    t.brief(d.brief),
    t.notes(d.notes.map((n) => n.path)),
    t.questions(d.questions.length),
    ...d.questions.map((q) => t.question(q.state, q.title, q.recipient.name, q.blocking)),
    "",
    ...descriptionLines(d.description),
  ];
}
