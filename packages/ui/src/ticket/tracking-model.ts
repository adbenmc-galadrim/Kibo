import {
  type CiRun,
  type CiTone,
  ciTone,
  deliveryStepLabel,
  type ExternalRef,
  featureLabel,
  type GithubPrRef,
  latestCiRunPerWorkflow,
  type ProjectSnapshot,
  prCiTone,
  type TicketView,
} from "@kibo/schema";
import { frTicketTracking as t } from "../i18n/fr-ticket-tracking";

const LIVE: ReadonlySet<GithubPrRef["state"]> = new Set(["open", "draft"]);

export function mainPr(refs: readonly ExternalRef[]): GithubPrRef | null {
  const prs = refs.filter((r): r is GithubPrRef => r.kind === "github_pr");
  const live = prs.filter((p) => LIVE.has(p.state));
  const pool = live.length > 0 ? live : prs;
  return pool.reduce<GithubPrRef | null>(
    (best, p) => (best === null || p.number > best.number ? p : best),
    null,
  );
}

type HeaderProject = Pick<ProjectSnapshot, "tickets" | "sprints">;
export type HeaderContext = { feature: boolean; lead: string; pr: GithubPrRef | null; text: string };

const joined = (parts: readonly (string | null)[]): string =>
  parts.filter((p): p is string => p !== null && p !== "").join(" · ");

export function headerContext(ticket: TicketView, project: HeaderProject): HeaderContext {
  const parent = project.tickets.find((x) => x.id === ticket.parentId);
  const sprint = project.sprints.find((s) => s.id === ticket.effectiveSprintId)?.code ?? null;
  const pr = mainPr(ticket.externalRefs);
  const lead = joined([parent ? featureLabel(parent) : null, sprint]);
  const prLabel = pr ? t.pr(pr.number) : null;
  const text = joined([parent ? null : ticket.keyLabel, lead, prLabel]);
  return { feature: parent !== undefined, lead, pr, text };
}

const ALERT: ReadonlySet<CiTone> = new Set(["error", "running"]);

export type TrackingAlert = {
  pr: GithubPrRef;
  tone: "error" | "running";
  parts: string[];
  jobUrl: string | null;
};

const runsOf = (pr: GithubPrRef, runs: readonly CiRun[]) =>
  latestCiRunPerWorkflow(runs.filter((r) => r.prNumber === pr.number));

export function ciJobUrl(pr: GithubPrRef, runs: readonly CiRun[], tone: CiTone): string | null {
  return runsOf(pr, runs).find((r) => ciTone(r) === tone)?.url ?? null;
}

export function trackingAlert(ticket: TicketView, runs: readonly CiRun[]): TrackingAlert | null {
  const pr = mainPr(ticket.externalRefs);
  if (pr === null || !LIVE.has(pr.state)) return null;
  const changes = pr.review === "changes_requested";
  const ci = prCiTone(pr, runs);
  const ciAlert = ci !== null && ALERT.has(ci);
  if (!changes && !ciAlert) return null;
  const parts = [t.pr(pr.number)];
  if (changes) parts.push(t.review.changes_requested);
  if (ci !== null && ciAlert) parts.push(t.ci[ci]);
  const tone = changes || ci === "error" ? "error" : "running";
  return { pr, tone, parts, jobUrl: ci !== null && ciAlert ? ciJobUrl(pr, runs, ci) : null };
}

const MINUTE = 60_000;

export function durationLabel(ms: number): string {
  const minutes = Math.max(1, Math.round(ms / MINUTE));
  if (minutes < 60) return t.minutes(minutes);
  const hours = Math.floor(minutes / 60);
  return hours < 24 ? t.hours(hours) : t.days(Math.floor(hours / 24));
}

export function stepLine(delivery: NonNullable<TicketView["delivery"]>): string {
  const label = deliveryStepLabel(delivery.step);
  return delivery.kind === "update" ? t.retouch(label) : label;
}
