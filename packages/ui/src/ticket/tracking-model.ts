import {
  type CiJobSummary,
  type CiRun,
  type CiTone,
  ciTone,
  DELIVERY_STEP_LABELS,
  DELIVERY_STEP_MAX,
  type ExternalRef,
  featureLabel,
  type GithubPrRef,
  isLivePr,
  latestCiRunPerWorkflow,
  liveReview,
  type ProjectEvent,
  type ProjectEventKind,
  type ProjectSnapshot,
  prCiTone,
  type TicketView,
} from "@kibo/schema";
import { phaseLabel } from "@kibo/sdk";
import { frFeature } from "../i18n/fr-group";
import { frTicketTracking as t } from "../i18n/fr-ticket-tracking";

export function mainPr(refs: readonly ExternalRef[]): GithubPrRef | null {
  const prs = refs.filter((r): r is GithubPrRef => r.kind === "github_pr");
  const live = prs.filter(isLivePr);
  const pool = live.length > 0 ? live : prs;
  return pool.reduce<GithubPrRef | null>(
    (best, p) => (best === null || p.number > best.number ? p : best),
    null,
  );
}

type HeaderProject = Pick<ProjectSnapshot, "tickets" | "sprints">;
type HeaderContext = {
  feature: string | null;
  sprint: string | null;
  text: string;
};

export function headerContext(ticket: TicketView, project: HeaderProject): HeaderContext {
  const parent = project.tickets.find((x) => x.id === ticket.parentId);
  const feature = parent ? featureLabel(parent) || null : null;
  const sprint = project.sprints.find((s) => s.id === ticket.effectiveSprintId)?.code ?? null;
  const text = [feature, sprint].filter((p) => p !== null).join(" · ");
  return { feature, sprint, text };
}

const RUN_URL = /\/actions\/runs\/\d+$/;

export const failedJobOf = (run: Pick<CiRun, "jobs">): CiJobSummary | null =>
  run.jobs.find((j) => j.conclusion === "failure") ?? run.jobs[0] ?? null;

export const jobUrl = (run: Pick<CiRun, "url">, job: Pick<CiJobSummary, "jobId"> | null): string =>
  job !== null && RUN_URL.test(run.url) ? `${run.url}/job/${job.jobId}` : run.url;

const checksUrl = (pr: Pick<GithubPrRef, "url">): string => `${pr.url}/checks`;

const runsOf = (pr: GithubPrRef, runs: readonly CiRun[]) =>
  latestCiRunPerWorkflow(runs.filter((r) => r.prNumber === pr.number));

function ciRunOf(pr: GithubPrRef, runs: readonly CiRun[], tone: CiTone): CiRun | null {
  return runsOf(pr, runs).find((r) => ciTone(r) === tone) ?? null;
}

type CiDetail = { tone: CiTone; job: string | null; at: number | null; url: string | null };

export function ciDetail(
  pr: GithubPrRef,
  runs: readonly CiRun[],
  events: readonly ProjectEvent[],
): CiDetail | null {
  const tone = prCiTone(pr, runs);
  if (tone === null) return null;
  const run = ciRunOf(pr, runs, tone);
  const failed = run ? failedJobOf(run) : null;
  const at = run ? Date.parse(run.updatedAt) : (lastEvent(events, "pr_checks", pr.number)?.at ?? null);
  const url = run ? jobUrl(run, failed) : tone === "error" || tone === "running" ? checksUrl(pr) : null;
  const job = run ? (failed?.name ?? null) : tone === "error" ? (pr.failedCheck ?? null) : null;
  return { tone, job, at: Number.isNaN(at) ? null : at, url };
}

export function lastEvent(
  events: readonly ProjectEvent[],
  kind: ProjectEventKind,
  number?: number,
): ProjectEvent | undefined {
  return events
    .filter((e) => e.kind === kind && (number === undefined || e.data.number === number))
    .reduce<ProjectEvent | undefined>(
      (last, e) => (last === undefined || e.at > last.at ? e : last),
      undefined,
    );
}

export function isDeclared(events: readonly ProjectEvent[], branch: string): boolean {
  const last = events
    .filter((e) => e.kind === "branch_created" && e.data.branch === branch)
    .reduce<ProjectEvent | undefined>((l, e) => (l === undefined || e.at > l.at ? e : l), undefined);
  return last?.data.declared === true;
}

const DAY_MS = 86_400_000;
const pad = (n: number) => String(n).padStart(2, "0");
const midnight = (at: number) => {
  const d = new Date(at);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
};

export function clockOf(at: number): string {
  const d = new Date(at);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function whenLabel(at: number, now: number): string {
  const days = Math.round((midnight(now) - midnight(at)) / DAY_MS);
  if (days <= 0) return t.today(clockOf(at));
  if (days === 1) return t.yesterday(clockOf(at));
  const d = new Date(at);
  return t.onDay(`${d.getDate()} ${frFeature.month(d.getMonth())}`, clockOf(at));
}

const MINUTE = 60_000;

export function durationLabel(ms: number): string {
  const minutes = Math.max(1, Math.round(ms / MINUTE));
  if (minutes < 60) return t.minutes(minutes);
  const hours = Math.floor(minutes / 60);
  return hours < 24 ? t.hours(hours) : t.days(Math.floor(hours / 24));
}

export const deliveryPhase = (step: number): string => phaseLabel(step, DELIVERY_STEP_LABELS[step] ?? "");

export function stepLine(delivery: NonNullable<TicketView["delivery"]>): string {
  const label = deliveryPhase(delivery.step);
  return delivery.kind === "update" ? t.retouch(label) : label;
}

export const nextStepLabel = (step: number): string | null =>
  step < DELIVERY_STEP_MAX ? (DELIVERY_STEP_LABELS[step + 1] ?? null) : null;
