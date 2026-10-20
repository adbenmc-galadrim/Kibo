import {
  type GithubPrRef,
  isFeature,
  isLivePr,
  liveReview,
  type PrChecks,
  type TicketView,
} from "@kibo/schema";

export type PrReviewTone = "draft" | "waiting" | "changes" | "approved";
export type PrFeature = { shortKey: string; title: string };
export type PrNode = {
  id: string;
  number: number;
  ticketId: string;
  key: string;
  title: string;
  feature: PrFeature | null;
  review: PrReviewTone;
  checks: PrChecks | null;
  head: string | null;
  base: string | null;
  late: boolean;
  session: boolean;
  children: PrNode[];
};
export type PrStack = {
  root: PrNode;
  size: number;
  depth: number;
  numbers: { min: number; max: number };
  feature: PrFeature | null;
  onRail: boolean;
};
export type PrCounts = { open: number; stacks: number; waiting: number; changes: number };
export type PrStacksModel = { stacks: PrStack[]; rail: string | null; counts: PrCounts };
export type PrStacksInput = { tickets: readonly TicketView[]; live: ReadonlySet<string> };

type LivePr = { pr: GithubPrRef; ticket: TicketView };
type ById = ReadonlyMap<string, TicketView>;

const compareText = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);
const byKey = (a: TicketView, b: TicketView): number =>
  a.keyLabel.localeCompare(b.keyLabel, "en", { numeric: true }) || compareText(a.id, b.id);
const byNumber = (a: LivePr, b: LivePr): number =>
  a.pr.number - b.pr.number || compareText(a.pr.url, b.pr.url);

export const reviewToneOf = (pr: Pick<GithubPrRef, "state" | "review">): PrReviewTone => {
  if (pr.state === "draft") return "draft";
  const review = liveReview(pr);
  if (review === "approved") return "approved";
  return review === "changes_requested" ? "changes" : "waiting";
};

function topOf(ticket: TicketView, byId: ById): TicketView {
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

const featureRootOf = (ticket: TicketView, byId: ById): TicketView | null => {
  const top = topOf(ticket, byId);
  return isFeature(top) ? top : null;
};

export function featureOf(ticket: TicketView, byId: ById): PrFeature | null {
  const root = featureRootOf(ticket, byId);
  return root === null ? null : { shortKey: root.shortKey ?? root.keyLabel, title: root.title };
}

export const stackOrder = (a: PrStack, b: PrStack): number =>
  b.size - a.size || a.root.number - b.root.number || compareText(a.root.id, b.root.id);

function livePrs(tickets: readonly TicketView[]): LivePr[] {
  const seen = new Set<string>();
  const found: LivePr[] = [];
  for (const ticket of [...tickets].sort(byKey)) {
    for (const ref of ticket.externalRefs) {
      if (ref.kind !== "github_pr" || !isLivePr(ref) || seen.has(ref.url)) continue;
      seen.add(ref.url);
      found.push({ pr: ref, ticket });
    }
  }
  return found.sort(byNumber);
}

function parentsOf(prs: readonly LivePr[]): Map<string, LivePr | null> {
  const byHead = new Map<string, LivePr[]>();
  for (const p of prs) {
    if (p.pr.head === null) continue;
    byHead.set(p.pr.head, [...(byHead.get(p.pr.head) ?? []), p]);
  }
  return new Map(
    prs.map((p) => {
      const candidates = p.pr.base === null ? [] : (byHead.get(p.pr.base) ?? []);
      return [p.pr.url, candidates.find((c) => c !== p) ?? null];
    }),
  );
}

function cutCycles(prs: readonly LivePr[], parents: Map<string, LivePr | null>): void {
  const settled = new Set<string>();
  for (const start of prs) {
    const path: LivePr[] = [];
    let current: LivePr | null = start;
    while (current !== null && !settled.has(current.pr.url)) {
      const at = path.indexOf(current);
      if (at >= 0) {
        const smallest = path.slice(at).sort(byNumber)[0];
        if (smallest !== undefined) parents.set(smallest.pr.url, null);
        break;
      }
      path.push(current);
      current = parents.get(current.pr.url) ?? null;
    }
    for (const p of path) settled.add(p.pr.url);
  }
}

type Context = { byId: ById; live: ReadonlySet<string>; children: ReadonlyMap<string, LivePr[]> };

function nodeOf(p: LivePr, ctx: Context): PrNode {
  const root = featureRootOf(p.ticket, ctx.byId);
  return {
    id: p.pr.url,
    number: p.pr.number,
    ticketId: p.ticket.id,
    key: p.ticket.keyLabel,
    title: p.ticket.title,
    feature: featureOf(p.ticket, ctx.byId),
    review: reviewToneOf(p.pr),
    checks: p.pr.checks,
    head: p.pr.head,
    base: p.pr.base,
    late: root?.feature?.status === "late",
    session: p.ticket.session !== null || ctx.live.has(p.ticket.id),
    children: (ctx.children.get(p.pr.url) ?? []).map((c) => nodeOf(c, ctx)),
  };
}

const flatten = (node: PrNode): PrNode[] => [node, ...node.children.flatMap(flatten)];
const depthOf = (node: PrNode): number => 1 + Math.max(0, ...node.children.map(depthOf));

function railOf(roots: readonly PrNode[]): string | null {
  const counts = new Map<string, number>();
  for (const r of roots) if (r.base !== null) counts.set(r.base, (counts.get(r.base) ?? 0) + 1);
  const ranked = [...counts].sort(([a, x], [b, y]) => y - x || a.localeCompare(b, "en"));
  return ranked[0]?.[0] ?? null;
}

function stackOf(root: PrNode, rail: string | null): PrStack {
  const numbers = flatten(root).map((n) => n.number);
  return {
    root,
    size: numbers.length,
    depth: depthOf(root),
    numbers: { min: Math.min(...numbers), max: Math.max(...numbers) },
    feature: root.feature,
    onRail: root.base === rail,
  };
}

export function prStacks(input: PrStacksInput): PrStacksModel {
  const prs = livePrs(input.tickets);
  const parents = parentsOf(prs);
  cutCycles(prs, parents);
  const children = new Map<string, LivePr[]>();
  for (const p of prs) {
    const parent = parents.get(p.pr.url) ?? null;
    if (parent !== null) children.set(parent.pr.url, [...(children.get(parent.pr.url) ?? []), p]);
  }
  const ctx: Context = { byId: new Map(input.tickets.map((t) => [t.id, t])), live: input.live, children };
  const roots = prs.filter((p) => (parents.get(p.pr.url) ?? null) === null).map((p) => nodeOf(p, ctx));
  const rail = railOf(roots);
  const nodes = roots.flatMap(flatten);
  return {
    stacks: roots.map((r) => stackOf(r, rail)).sort(stackOrder),
    rail,
    counts: {
      open: nodes.length,
      stacks: roots.length,
      waiting: nodes.filter((n) => n.review === "waiting").length,
      changes: nodes.filter((n) => n.review === "changes").length,
    },
  };
}
