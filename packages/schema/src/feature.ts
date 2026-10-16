import { z } from "zod";
import type { DeliveryStep } from "./delivery";
import { topoByBlocks } from "./delivery-order";
import { branchRefOf, type GithubPrRef } from "./external-ref";
import type { Link } from "./link";
import type { TicketView } from "./rpc";
import { FINAL_STATUSES } from "./startable";
import type { StatusId } from "./status";

export const ShortKey = z.string().regex(/^[A-Z]{1,3}[0-9]{1,3}$/);
export type ShortKey = z.infer<typeof ShortKey>;

export const isFeature = (t: { parentId: string | null; progress: { total: number } }): boolean =>
  t.parentId === null && t.progress.total > 0;

type SprintFacts = { parentId: string | null; sprintId: string | null };

export function effectiveSprintId(ticketId: string, byId: ReadonlyMap<string, SprintFacts>): string | null {
  const seen = new Set<string>();
  let current = byId.get(ticketId);
  while (current !== undefined && current.parentId !== null && !seen.has(current.parentId)) {
    seen.add(current.parentId);
    current = byId.get(current.parentId);
  }
  return current?.parentId === null ? current.sprintId : null;
}

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
};
export type FeatureStepSource = Pick<
  TicketView,
  "id" | "key" | "title" | "parentId" | "statusId" | "optional" | "delivery" | "externalRefs"
>;
export type FeatureStepsInput = {
  feature: string;
  tickets: readonly FeatureStepSource[];
  links: readonly Pick<Link, "from" | "to" | "type">[];
};

const prOf = (t: FeatureStepSource): GithubPrRef | null =>
  t.externalRefs.filter((r): r is GithubPrRef => r.kind === "github_pr").at(-1) ?? null;

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
  }));
}
