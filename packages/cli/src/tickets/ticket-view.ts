import {
  type Assignee,
  type ExternalRef,
  type GithubPrRef,
  type ImportRef,
  KiboError,
  type Link,
  type PrState,
  type Status,
  StatusId,
  type TicketView,
} from "@kibo/schema";
import { z } from "zod";

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
export type PrSummary = { number: number; url: string; state: PrState };
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
  assignee: Assignee | null;
  labels: string[];
};
export type TicketsSource = { workflow: Status[]; tickets: TicketView[]; links: Link[] };

const isPlanRef = (r: ExternalRef): r is ImportRef => r.kind === "import_ref" && r.source === "plan";

export const planIdOf = (t: { externalRefs: ExternalRef[] }): string | null =>
  t.externalRefs.find(isPlanRef)?.id ?? null;

const PR_RANK: Record<PrState, number> = { open: 0, draft: 0, merged: 1, closed: 2 };

export function relevantPr(t: TicketView): PrSummary | null {
  const prs = t.externalRefs.filter((r): r is GithubPrRef => r.kind === "github_pr");
  const best = [...prs].sort((a, b) => PR_RANK[a.state] - PR_RANK[b.state] || b.number - a.number)[0];
  return best ? { number: best.number, url: best.url, state: best.state } : null;
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
      assignee: t.assignee,
      labels: t.labels,
    };
  });
}

export const isReady = (t: TicketSummary): boolean =>
  t.status === "todo" && t.children.length === 0 && t.deps.every((d) => d.status === "done");

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
    tickets.find((t) => planIdOf(t)?.toUpperCase() === wanted) ??
    tickets.find((t) => t.id === ident.trim()) ??
    null
  );
}
