import {
  blockingQuestion,
  branchRefOf,
  type CiRun,
  type CiTone,
  type GithubPrRef,
  isLivePr,
  liveReview,
  type ProjectMeta,
  type ProjectSnapshot,
  prCiTone,
  questionLabel,
  type TicketView,
  worstCiTone,
} from "@kibo/schema";
import type { StepFeature } from "@kibo/sdk";
import { compareMine, isMine } from "./my-tickets";

export type WorkGroup = "toFix" | "inProgress" | "startable" | "waiting";
export const WORK_GROUPS: readonly WorkGroup[] = ["toFix", "inProgress", "startable", "waiting"];

export type WorkItem = {
  project: ProjectMeta;
  ticket: TicketView;
  pr: GithubPrRef | null;
  changes: boolean;
  ci: CiTone | null;
  blockedBy: string | null;
  feature: StepFeature | null;
  branch: string | null;
};
export type WorkSection = { group: WorkGroup; items: WorkItem[] };

const ACTIVE: ReadonlySet<TicketView["statusId"]> = new Set(["in_progress", "in_review"]);

const latest = (prs: readonly GithubPrRef[]): GithubPrRef | null =>
  prs.reduce<GithubPrRef | null>((best, pr) => (best === null || pr.number > best.number ? pr : best), null);

function ticketPr(ticket: TicketView): GithubPrRef | null {
  const prs = ticket.externalRefs.filter((r): r is GithubPrRef => r.kind === "github_pr");
  return latest(prs.filter(isLivePr)) ?? latest(prs);
}

function ciOf(ticket: TicketView, pr: GithubPrRef | null, runs: readonly CiRun[]): CiTone | null {
  const own = runs.filter((r) => r.ticketKey === ticket.key || (pr !== null && r.prNumber === pr.number));
  if (pr !== null) return prCiTone(pr, own);
  return own.length > 0 ? worstCiTone(own) : null;
}

function itemOf(
  project: ProjectMeta,
  snapshot: ProjectSnapshot,
  ticket: TicketView,
  runs: readonly CiRun[],
): WorkItem {
  const pr = ticketPr(ticket);
  const live = pr !== null && isLivePr(pr);
  const question = blockingQuestion(ticket, snapshot.questions);
  return {
    project,
    ticket,
    pr,
    changes: pr !== null && liveReview(pr) === "changes_requested",
    ci: ciOf(ticket, live ? pr : null, runs),
    blockedBy: question ? questionLabel(question) : null,
    feature: snapshot.tickets.find((t) => t.id === ticket.parentId) ?? null,
    branch: branchRefOf(ticket.externalRefs)?.branch ?? null,
  };
}

export function groupOf(item: WorkItem): WorkGroup {
  if (item.ticket.onHold !== null) return "waiting";
  if (item.changes || item.ci === "error") return "toFix";
  if (ACTIVE.has(item.ticket.statusId)) return "inProgress";
  if (item.ticket.startable && item.blockedBy === null && item.ticket.statusId !== "blocked")
    return "startable";
  return "waiting";
}

export function workList(
  projects: readonly ProjectMeta[],
  snapshots: ReadonlyMap<string, ProjectSnapshot>,
  viewer: string,
  ciRuns: ReadonlyMap<string, readonly CiRun[]>,
): WorkSection[] {
  const items = projects.flatMap((project) => {
    const snapshot = snapshots.get(project.id);
    if (!snapshot) return [];
    const runs = ciRuns.get(project.id) ?? [];
    return snapshot.tickets
      .filter((t) => isMine(t, snapshot.viewer ?? viewer, "assigned"))
      .sort(compareMine)
      .map((t) => itemOf(project, snapshot, t, runs));
  });
  return WORK_GROUPS.flatMap((group) => {
    const inGroup = items.filter((i) => groupOf(i) === group);
    return inGroup.length > 0 ? [{ group, items: inGroup }] : [];
  });
}
