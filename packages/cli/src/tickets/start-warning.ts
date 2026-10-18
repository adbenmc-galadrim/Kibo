import {
  blockingQuestion,
  isInProgressFeature,
  NOT_STARTED_STATUSES,
  openLimitOf,
  type ProjectSnapshot,
  questionLabel,
  type StartReason,
  type TicketView,
} from "@kibo/schema";
import { frTickets } from "../fr";

const WARNABLE = [...NOT_STARTED_STATUSES, "blocked"];
const r = frTickets.reasons;

type Reason = { kind: Exclude<StartReason["kind"], "status">; text: string };

function rootOf(ticket: TicketView, byId: ReadonlyMap<string, TicketView>): TicketView {
  const seen = new Set<string>();
  let current = ticket;
  while (current.parentId !== null && !seen.has(current.id)) {
    seen.add(current.id);
    const parent = byId.get(current.parentId);
    if (parent === undefined) break;
    current = parent;
  }
  return current;
}

function blockage(ticket: TicketView, snapshot: ProjectSnapshot): Reason[] {
  const question = blockingQuestion(ticket, snapshot.questions);
  if (question !== null) return [{ kind: "question", text: r.question(questionLabel(question)) }];
  return ticket.statusId === "blocked" ? [{ kind: "question", text: r.blocked }] : [];
}

const waiting = (keys: readonly string[]): Reason[] =>
  keys.length === 0 ? [] : [{ kind: "dependency", text: r.waiting(keys) }];

function planning(ticket: TicketView, snapshot: ProjectSnapshot): Reason[] {
  const root = rootOf(ticket, new Map(snapshot.tickets.map((t) => [t.id, t])));
  if (root.feature === null) return [];
  const sprint = snapshot.sprints.find((s) => s.id === ticket.effectiveSprintId) ?? null;
  const reasons: Reason[] = [];
  if (sprint?.state === "planned") reasons.push({ kind: "sprint", text: r.sprint(sprint.code) });
  if (sprint === null && snapshot.sprints.length > 0) reasons.push({ kind: "unplanned", text: r.unplanned });
  const open = snapshot.tickets.filter((t) => t.feature !== null && isInProgressFeature(t.feature));
  const limit = openLimitOf(snapshot.meta.tracking);
  if (open.length >= limit && !open.some((t) => t.id === root.id))
    reasons.push({ kind: "limit", text: r.limit(open.length, limit) });
  return reasons;
}

function daemonReason(reason: StartReason | null): Reason | null {
  if (reason === null || reason.kind === "status") return null;
  if (reason.kind === "dependency") return { kind: reason.kind, text: r.waiting(reason.keys) };
  if (reason.kind === "question") return { kind: reason.kind, text: r.question(reason.label) };
  if (reason.kind === "sprint") return { kind: reason.kind, text: r.sprint(reason.code) };
  if (reason.kind === "unplanned") return { kind: reason.kind, text: r.unplanned };
  return { kind: reason.kind, text: r.limit(reason.limit, reason.limit) };
}

export function notStartableReasons(ticket: TicketView, snapshot: ProjectSnapshot): string[] | null {
  if (ticket.startable || !WARNABLE.includes(ticket.statusId)) return null;
  const reasons = [
    ...blockage(ticket, snapshot),
    ...waiting(ticket.waitingOn),
    ...planning(ticket, snapshot),
  ];
  const fallback = daemonReason(ticket.startReason);
  if (fallback !== null && !reasons.some((x) => x.kind === fallback.kind)) reasons.push(fallback);
  return reasons.length === 0 ? null : reasons.map((x) => x.text);
}
