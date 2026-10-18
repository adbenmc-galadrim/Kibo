import type { CiRun, ProjectEvent, ProjectEventKind, ProjectSnapshot } from "@kibo/schema";
import { frTicketTracking } from "../../i18n/fr-ticket-tracking";
import { failedJobOf, jobUrl, phaseLabel } from "../tracking-model";
import { journalTime } from "./journal-time";

export type TimelineKind =
  | "branch"
  | "pr"
  | "review"
  | "checks"
  | "step"
  | "session"
  | "status"
  | "sprint"
  | "question"
  | "other";
export type TimelineAside = { text: string; link: { label: string; url: string } | null };
export type TimelineLine = {
  id: string;
  kind: TimelineKind;
  tone: "ok" | "error" | "running" | null;
  text: string;
  time: string;
  aside: TimelineAside | null;
};

type Data = ProjectEvent["data"];
type Line = { kind: TimelineKind; text: string; tone?: TimelineLine["tone"] };
type TimelineProject = Pick<ProjectSnapshot, "workflow">;

const e = frTicketTracking.events;
const STATUS_WINDOW_MS = 120_000;
const TONES: Record<string, TimelineLine["tone"]> = { ok: "ok", error: "error", running: "running" };

const num = (d: Data, key: string): number | null => {
  const v = d[key];
  return typeof v === "number" ? v : null;
};
const str = (d: Data, key: string): string | null => {
  const v = d[key];
  return typeof v === "string" && v !== "" ? v : null;
};

function stepText(d: Data, ev: ProjectEvent): string {
  const step = num(d, "step");
  if (step === null) return e.step(null);
  const label = phaseLabel(step);
  return ev.source === "update-delivery" || str(d, "kind") === "update"
    ? frTicketTracking.retouch(label)
    : label;
}

type Runs = readonly CiRun[];

const failedRun = (d: Data, runs: Runs): CiRun | null =>
  str(d, "checks") === "error"
    ? (runs.find((r) => r.prNumber === num(d, "number") && r.conclusion === "failure") ?? null)
    : null;

function checksText(d: Data, runs: Runs): string {
  const run = failedRun(d, runs);
  const job = run ? failedJobOf(run) : null;
  return job ? e.checksJob(str(d, "checks"), job.name) : e.checks(num(d, "number"), str(d, "checks"));
}

const branchText = (d: Data): string =>
  d.declared === true ? e.branchDeclared(str(d, "branch")) : e.branch(str(d, "branch"));

const statusLabel = (d: Data, p: TimelineProject): string | null => {
  const to = str(d, "to");
  return p.workflow.find((s) => s.id === to)?.label ?? to;
};

const other = (): Line => ({ kind: "other", text: e.other });

const LINES: Record<ProjectEventKind, (d: Data, ev: ProjectEvent, p: TimelineProject, runs: Runs) => Line> = {
  branch_created: (d) => ({ kind: "branch", text: branchText(d) }),
  pr_opened: (d) => ({ kind: "pr", text: e.prOpened(num(d, "number")) }),
  pr_review: (d) => ({ kind: "review", text: e.review(num(d, "number"), str(d, "review")) }),
  pr_checks: (d, _ev, _p, runs) => ({
    kind: "checks",
    tone: TONES[str(d, "checks") ?? ""] ?? null,
    text: checksText(d, runs),
  }),
  pr_merged: (d) => ({ kind: "pr", text: e.prMerged(num(d, "number")) }),
  status_changed: (d, _ev, p) => ({ kind: "status", text: e.status(statusLabel(d, p)) }),
  step_set: (d, ev) => ({ kind: "step", text: stepText(d, ev) }),
  session_started: (d) => ({ kind: "session", text: e.sessionStarted(str(d, "tool")) }),
  session_stopped: (d) => ({ kind: "session", text: e.sessionStopped(str(d, "tool")) }),
  sprint_set: (d) => ({ kind: "sprint", text: e.sprint(str(d, "to")) }),
  question_created: () => ({ kind: "question", text: e.questionCreated }),
  question_answered: () => ({ kind: "question", text: e.questionAnswered }),
  question_reminded: (d) => ({ kind: "question", text: e.questionReminded(str(d, "ref")) }),
  sprint_created: other,
  batch_proposed: other,
  batch_decided: other,
};

const HOSTS: ReadonlySet<ProjectEventKind> = new Set([
  "branch_created",
  "pr_opened",
  "pr_merged",
  "step_set",
]);

type Pairing = { host: ProjectEvent; status: ProjectEvent; gap: number };

const byGap = (a: Pairing, b: Pairing) => a.gap - b.gap || a.host.id - b.host.id || a.status.id - b.status.id;

function statusHosts(events: readonly ProjectEvent[], project: TimelineProject): Map<number, ProjectEvent> {
  const statuses = events.filter(
    (ev) => ev.kind === "status_changed" && statusLabel(ev.data, project) !== null,
  );
  const pairings = events
    .filter((ev) => HOSTS.has(ev.kind))
    .flatMap((host) => statuses.map((status) => ({ host, status, gap: Math.abs(host.at - status.at) })))
    .filter((p) => p.gap <= STATUS_WINDOW_MS)
    .sort(byGap);
  const hosts = new Map<number, ProjectEvent>();
  const taken = new Set<number>();
  for (const { host, status } of pairings) {
    if (hosts.has(host.id) || taken.has(status.id)) continue;
    hosts.set(host.id, status);
    taken.add(status.id);
  }
  return hosts;
}

function failedJob(ev: ProjectEvent, runs: Runs): TimelineAside | null {
  if (ev.kind !== "pr_checks") return null;
  const run = failedRun(ev.data, runs);
  if (!run) return null;
  return { text: "", link: { label: e.seeLog, url: jobUrl(run, failedJobOf(run)) } };
}

const newestFirst = (a: ProjectEvent, b: ProjectEvent) => b.at - a.at || b.id - a.id;

export function ticketTimeline(
  events: readonly ProjectEvent[],
  project: TimelineProject,
  now: number,
  runs: readonly CiRun[] = [],
): TimelineLine[] {
  const hosts = statusHosts(events, project);
  const absorbed = new Set([...hosts.values()].map((ev) => ev.id));
  return [...events]
    .filter((ev) => !absorbed.has(ev.id))
    .sort(newestFirst)
    .map((ev) => {
      const line = LINES[ev.kind](ev.data, ev, project, runs);
      const status = hosts.get(ev.id);
      const label = status ? statusLabel(status.data, project) : null;
      return {
        id: `event-${ev.id}`,
        kind: line.kind,
        tone: line.tone ?? null,
        text: line.text,
        time: journalTime(ev.at, now),
        aside: label ? { text: e.statusAside(label), link: null } : failedJob(ev, runs),
      };
    });
}
