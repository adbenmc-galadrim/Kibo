import {
  type CiRun,
  deliveryStepLabel,
  type ProjectEvent,
  type ProjectEventKind,
  type ProjectSnapshot,
} from "@kibo/schema";
import { frTicketTracking } from "../../i18n/fr-ticket-tracking";
import { stepTime } from "../../shell/feature/time-format";

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
  const label = deliveryStepLabel(step);
  return ev.source === "update-delivery" || str(d, "kind") === "update"
    ? frTicketTracking.retouch(label)
    : e.step(label);
}

const statusLabel = (d: Data, p: TimelineProject): string | null => {
  const to = str(d, "to");
  return p.workflow.find((s) => s.id === to)?.label ?? to;
};

const other = (): Line => ({ kind: "other", text: e.other });

const LINES: Record<ProjectEventKind, (d: Data, ev: ProjectEvent, p: TimelineProject) => Line> = {
  branch_created: (d) => ({ kind: "branch", text: e.branch(str(d, "branch")) }),
  pr_opened: (d) => ({ kind: "pr", text: e.prOpened(num(d, "number")) }),
  pr_review: (d) => ({ kind: "review", text: e.review(num(d, "number"), str(d, "review")) }),
  pr_checks: (d) => ({
    kind: "checks",
    tone: TONES[str(d, "checks") ?? ""] ?? null,
    text: e.checks(num(d, "number"), str(d, "checks")),
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

function failedJob(ev: ProjectEvent, runs: readonly CiRun[]): TimelineAside | null {
  if (ev.kind !== "pr_checks" || str(ev.data, "checks") !== "error") return null;
  const run = runs.find((r) => r.prNumber === num(ev.data, "number") && r.conclusion === "failure");
  if (!run) return null;
  const job = run.jobs.find((j) => j.conclusion === "failure") ?? run.jobs[0];
  return { text: job ? e.jobAside(job.name) : "", link: { label: e.seeLog, url: run.url } };
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
      const line = LINES[ev.kind](ev.data, ev, project);
      const status = hosts.get(ev.id);
      const label = status ? statusLabel(status.data, project) : null;
      return {
        id: `event-${ev.id}`,
        kind: line.kind,
        tone: line.tone ?? null,
        text: line.text,
        time: stepTime(ev.at, now),
        aside: label ? { text: e.statusAside(label), link: null } : failedJob(ev, runs),
      };
    });
}
