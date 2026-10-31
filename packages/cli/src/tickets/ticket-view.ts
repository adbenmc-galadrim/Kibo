import {
  type Assignee,
  type DeliveryStep,
  type ExternalRef,
  type GitBranchRef,
  type GithubPrRef,
  type ImportRef,
  KiboError,
  type Link,
  type OnHold,
  type PrChecks,
  type PrReview,
  type PrState,
  type StartReason,
  type Status,
  StatusId,
  type TicketSession,
  type TicketView,
} from "@kibo/schema";
import { z } from "zod";
import { type SprintSource, type TrackingFields, trackingOf } from "./ticket-tracking";

export const NormalizedStatus = z.enum(["todo", "wip", "done", "blocked"]);
export type NormalizedStatus = z.infer<typeof NormalizedStatus>;

const NORMALIZED: Record<StatusId, NormalizedStatus> = {
  backlog: "todo",
  todo: "todo",
  in_progress: "wip",
  in_review: "wip",
  blocked: "blocked",
  done: "done",
};

export const normalizedStatus = (status: StatusId): NormalizedStatus => NORMALIZED[status];

export type TicketRef = { key: string; planId: string | null; status: NormalizedStatus };
export type PrSummary = {
  number: number;
  url: string;
  state: PrState;
  review: PrReview;
  checks: PrChecks | null;
};
export type BranchSummary = { name: string; base: string | null };
export type AssigneeSummary = Assignee & { me: boolean };
export type TicketSummary = {
  id: string;
  key: string;
  planId: string | null;
  title: string;
  status: NormalizedStatus;
  kiboStatus: StatusId;
  column: string;
  blockedReason: string | null;
  parent: TicketRef | null;
  children: TicketRef[];
  deps: TicketRef[];
  pr: PrSummary | null;
  assignee: AssigneeSummary | null;
  branch: BranchSummary | null;
  labels: string[];
  delivery: DeliveryStep | null;
  session: TicketSession | null;
  updatedAt: number | null;
  refs: ExternalRef[];
  startable: boolean;
  startReason: StartReason | null;
  onHold: OnHold | null;
} & TrackingFields;
type TicketsSource = {
  workflow: Status[];
  tickets: TicketView[];
  links: Link[];
  sprints: readonly SprintSource[];
  viewer?: string;
};

const isPlanRef = (r: ExternalRef): r is ImportRef => r.kind === "import_ref" && r.source === "plan";

const planIdOf = (t: { externalRefs: ExternalRef[] }): string | null =>
  t.externalRefs.find(isPlanRef)?.id ?? null;

const PR_RANK: Record<PrState, number> = { open: 0, draft: 0, merged: 1, closed: 2 };

function relevantPr(t: TicketView): PrSummary | null {
  const prs = t.externalRefs.filter((r): r is GithubPrRef => r.kind === "github_pr");
  const best = [...prs].sort((a, b) => PR_RANK[a.state] - PR_RANK[b.state] || b.number - a.number)[0];
  return best
    ? { number: best.number, url: best.url, state: best.state, review: best.review, checks: best.checks }
    : null;
}

function branchOf(t: TicketView): BranchSummary | null {
  const ref = t.externalRefs.find((r): r is GitBranchRef => r.kind === "git_branch");
  return ref ? { name: ref.branch, base: ref.base } : null;
}

function assigneeOf(t: TicketView, source: TicketsSource): AssigneeSummary | null {
  if (t.assignee === null) return null;
  const { kind, ref } = t.assignee;
  if (kind === "agent") return { kind, ref, me: false };
  return { kind, ref, me: ref === source.viewer };
}

const refOf = (t: TicketView): TicketRef => ({
  key: t.keyLabel,
  planId: planIdOf(t),
  status: normalizedStatus(t.statusId),
});

export function summarize(source: TicketsSource): TicketSummary[] {
  const byId = new Map(source.tickets.map((t) => [t.id, t]));
  const column = new Map(source.workflow.map((s) => [s.id, s.label]));
  const refsOf = (ids: string[]): TicketRef[] =>
    ids.flatMap((id) => {
      const t = byId.get(id);
      return t ? [refOf(t)] : [];
    });
  return source.tickets.map((t) => {
    const parent = t.parentId === null ? undefined : byId.get(t.parentId);
    const blockers = source.links.filter((l) => l.type === "blocks" && l.to === t.id).map((l) => l.from);
    return {
      id: t.id,
      key: t.keyLabel,
      planId: planIdOf(t),
      title: t.title,
      status: normalizedStatus(t.statusId),
      kiboStatus: t.statusId,
      column: column.get(t.statusId) ?? t.statusId,
      blockedReason: t.blockedReason,
      parent: parent ? refOf(parent) : null,
      children: refsOf(source.tickets.filter((c) => c.parentId === t.id).map((c) => c.id)),
      deps: refsOf(blockers),
      pr: relevantPr(t),
      assignee: assigneeOf(t, source),
      branch: branchOf(t),
      labels: t.labels,
      ...trackingOf(t, byId, source.sprints),
      delivery: t.delivery,
      session: t.session,
      updatedAt: t.updatedAt,
      refs: t.externalRefs,
      startable: t.startable,
      startReason: t.startReason,
      onHold: t.onHold,
    };
  });
}

const StatusName = z.union([NormalizedStatus, StatusId]);
export type StatusName = z.infer<typeof StatusName>;

export function statusName(raw: string): StatusName {
  const parsed = StatusName.safeParse(raw.trim());
  if (!parsed.success) throw new KiboError("INVALID_INPUT", `unknown status: ${raw}`);
  return parsed.data;
}

export const statusFilter = (raw: string): StatusName[] => raw.split(",").map(statusName);

export const matchesStatus = (t: TicketSummary, wanted: readonly StatusName[]): boolean =>
  wanted.some((s) => s === t.status || s === t.kiboStatus);

export function lookupTicket(tickets: readonly TicketView[], ident: string): TicketView | null {
  const wanted = ident.trim().toUpperCase();
  return (
    tickets.find((t) => t.key?.toUpperCase() === wanted) ??
    tickets.find((t) => t.shortKey?.toUpperCase() === wanted) ??
    tickets.find((t) => planIdOf(t)?.toUpperCase() === wanted) ??
    tickets.find((t) => t.id === ident.trim()) ??
    null
  );
}
