import type { DeliveryStep } from "./delivery";
import { branchRefOf, type GithubPrRef } from "./external-ref";
import type { Link } from "./link";
import type { OnHold } from "./on-hold";
import type { TicketView } from "./rpc";
import { FINAL_STATUSES } from "./startable";
import type { StatusId } from "./status";

export type FeatureStep = {
  ticketId: string;
  key: string;
  title: string;
  statusId: StatusId;
  optional: boolean;
  blockedBy: string[];
  delivery: DeliveryStep | null;
  branch: string | null;
  pr: GithubPrRef | null;
  onHold: OnHold | null;
};
export type FeatureStepSource = Pick<
  TicketView,
  "id" | "key" | "title" | "parentId" | "statusId" | "optional" | "delivery" | "externalRefs" | "onHold"
>;
type FeatureStepsInput = {
  feature: string;
  tickets: readonly FeatureStepSource[];
  links: readonly Pick<Link, "from" | "to" | "type">[];
};

const prOf = (t: FeatureStepSource): GithubPrRef | null =>
  t.externalRefs.filter((r): r is GithubPrRef => r.kind === "github_pr").at(-1) ?? null;

type Ranked = { id: string; key: string | null; rank: number };

const byRank = (a: Ranked, b: Ranked): number =>
  a.rank - b.rank || (a.key ?? a.id).localeCompare(b.key ?? b.id);

function topoByBlocks<T extends Ranked>(items: readonly T[], edges: readonly [string, string][]): T[] {
  const remaining = [...items].sort(byRank);
  const waiting = new Map<string, Set<string>>(remaining.map((t) => [t.id, new Set<string>()]));
  for (const [from, to] of edges) if (from !== to) waiting.get(to)?.add(from);
  const order: T[] = [];
  while (remaining.length > 0) {
    const free = remaining.findIndex((t) => (waiting.get(t.id)?.size ?? 0) === 0);
    const [next] = remaining.splice(free === -1 ? 0 : free, 1);
    if (next === undefined) break;
    order.push(next);
    for (const blockers of waiting.values()) blockers.delete(next.id);
  }
  return order;
}

export function featureSteps(input: FeatureStepsInput): FeatureStep[] {
  const byId = new Map(input.tickets.map((t) => [t.id, t]));
  const children = input.tickets
    .map((t, rank) => ({ ...t, rank }))
    .filter((t) => t.parentId === input.feature);
  const childIds = new Set(children.map((t) => t.id));
  const blocks = input.links.filter((l) => l.type === "blocks" && l.from !== l.to);
  const edges = blocks
    .filter((l) => childIds.has(l.from) && childIds.has(l.to))
    .map((l): [string, string] => [l.from, l.to]);
  return topoByBlocks(children, edges).map((t) => ({
    ticketId: t.id,
    key: t.key ?? t.id,
    title: t.title,
    statusId: t.statusId,
    optional: t.optional,
    blockedBy: blocks
      .filter((l) => l.to === t.id)
      .map((l) => byId.get(l.from))
      .filter((b): b is FeatureStepSource => b !== undefined && !FINAL_STATUSES.includes(b.statusId))
      .map((b) => b.key ?? b.id),
    delivery: t.delivery,
    branch: branchRefOf(t.externalRefs)?.branch ?? null,
    pr: prOf(t),
    onHold: t.onHold,
  }));
}
