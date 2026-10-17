import type { GithubPrRef } from "./external-ref";
import { type FeatureState, isOpenFeature } from "./feature-state";
import { dayNumber } from "./iso-date";
import { isOpen } from "./question";
import type { ProjectSnapshot, TicketView } from "./rpc";
import { currentSprint, nextSprint, type Sprint, sortSprints } from "./sprint";
import { openLimitOf } from "./tracking-settings";

type FeatureCell = "delivered" | "open" | "todo";
type SprintIndicator =
  | { code: string; name: string; ending: "today" | { days: number } }
  | { next: Pick<Sprint, "code" | "start"> | null };
export type OverviewIndicators = {
  features: { delivered: number; total: number; cells: FeatureCell[] };
  sprint: SprintIndicator;
  open: { count: number; limit: number; level: "under" | "reached" | "over" };
  review: { count: number; numbers: number[] };
  questions: { open: number; blocking: { ref: string; shortKey: string } | null };
};
type OverviewSnapshot = Pick<ProjectSnapshot, "tickets" | "sprints" | "questions" | "meta">;
type Feature = { ticket: TicketView; state: FeatureState; rank: number };
export type ReviewCard = { pr: GithubPrRef; ticket: TicketView; feature: { shortKey: string } | null };

const REVIEWED: readonly GithubPrRef["state"][] = ["open", "draft"];

const daysBetween = (from: string, to: string): number => dayNumber(to) - dayNumber(from);

export function plannedFeatures(snapshot: Pick<ProjectSnapshot, "tickets" | "sprints">): Feature[] {
  const order = new Map(sortSprints(snapshot.sprints).map((s, i) => [s.id, i]));
  const sprintRank = (t: TicketView) =>
    t.sprintId === null ? order.size : (order.get(t.sprintId) ?? order.size);
  return snapshot.tickets
    .flatMap((ticket, rank) => (ticket.feature === null ? [] : [{ ticket, state: ticket.feature, rank }]))
    .sort((a, b) => sprintRank(a.ticket) - sprintRank(b.ticket) || a.rank - b.rank);
}

const cellOf = (state: FeatureState): FeatureCell => {
  if (state.status === "delivered") return "delivered";
  return isOpenFeature(state) ? "open" : "todo";
};

function sprintIndicator(snapshot: OverviewSnapshot, today: string): SprintIndicator {
  const current = currentSprint(snapshot.sprints, today);
  if (current === null) {
    const next = nextSprint(snapshot.sprints, today);
    return { next: next === null ? null : { code: next.code, start: next.start } };
  }
  const days = daysBetween(today, current.end);
  return { code: current.code, name: current.name, ending: days === 0 ? "today" : { days } };
}

const prsInReview = (t: Pick<TicketView, "externalRefs">): GithubPrRef[] =>
  t.externalRefs.filter((r): r is GithubPrRef => r.kind === "github_pr" && REVIEWED.includes(r.state));

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

function blockingQuestion(snapshot: OverviewSnapshot): { ref: string; shortKey: string } | null {
  const question = snapshot.questions.find((q) => q.blocking && isOpen(q));
  const byId = new Map(snapshot.tickets.map((t) => [t.id, t]));
  const ticket = question === undefined ? undefined : byId.get(question.ticketId);
  if (question === undefined || ticket === undefined) return null;
  const root = rootOf(ticket, byId);
  return { ref: question.importRef?.id ?? question.title, shortKey: root.shortKey ?? root.keyLabel };
}

export function overviewIndicators(input: { snapshot: OverviewSnapshot; today: string }): OverviewIndicators {
  const { snapshot, today } = input;
  const features = plannedFeatures(snapshot);
  const open = features.filter((f) => isOpenFeature(f.state)).length;
  const limit = openLimitOf(snapshot.meta.tracking);
  const numbers = [...new Set(snapshot.tickets.flatMap(prsInReview).map((pr) => pr.number))].sort(
    (a, b) => a - b,
  );
  return {
    features: {
      delivered: features.filter((f) => f.state.status === "delivered").length,
      total: features.length,
      cells: features.map((f) => cellOf(f.state)),
    },
    sprint: sprintIndicator(snapshot, today),
    open: { count: open, limit, level: open < limit ? "under" : open === limit ? "reached" : "over" },
    review: { count: numbers.length, numbers },
    questions: { open: snapshot.questions.filter(isOpen).length, blocking: blockingQuestion(snapshot) },
  };
}

export function nextToOpen(snapshot: Pick<ProjectSnapshot, "tickets" | "sprints">): string | null {
  const waiting = plannedFeatures(snapshot).find(
    (f) => f.ticket.sprintId !== null && !f.state.started && f.state.status !== "delivered",
  );
  return waiting === undefined ? null : (waiting.ticket.shortKey ?? waiting.ticket.keyLabel);
}

export function limitNote(input: {
  open: string[];
  next: string | null;
  limit: number;
}): { open: string[]; next: string } | null {
  if (input.next === null || input.open.length < input.limit) return null;
  return { open: input.open, next: input.next };
}

export function reviewCards(
  tickets: readonly TicketView[],
  lastEventAt: ReadonlyMap<string, number>,
): ReviewCard[] {
  const byId = new Map(tickets.map((t) => [t.id, t]));
  const featureOf = (ticket: TicketView) => {
    const root = rootOf(ticket, byId);
    return root.id !== ticket.id && root.shortKey !== null ? { shortKey: root.shortKey } : null;
  };
  const cards = tickets.flatMap((ticket) =>
    prsInReview(ticket).map((pr) => ({ pr, ticket, feature: featureOf(ticket) })),
  );
  const at = (card: ReviewCard) => lastEventAt.get(card.ticket.id) ?? Number.NEGATIVE_INFINITY;
  return cards
    .map((card, index) => ({ card, index }))
    .sort((a, b) => at(b.card) - at(a.card) || a.index - b.index)
    .map((c) => c.card);
}
