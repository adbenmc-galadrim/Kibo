import {
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
  | "step"
  | "session"
  | "status"
  | "sprint"
  | "question"
  | "other";
export type TimelineLine = { id: string; kind: TimelineKind; text: string; time: string };

type Data = ProjectEvent["data"];
type Line = { kind: TimelineKind; text: string };
type TimelineProject = Pick<ProjectSnapshot, "workflow">;

const e = frTicketTracking.events;
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

const other = (): Line => ({ kind: "other", text: e.other });

const LINES: Record<ProjectEventKind, (d: Data, ev: ProjectEvent, p: TimelineProject) => Line> = {
  branch_created: (d) => ({ kind: "branch", text: e.branch(str(d, "branch")) }),
  pr_opened: (d) => ({ kind: "pr", text: e.prOpened(num(d, "number")) }),
  pr_review: (d) => ({ kind: "review", text: e.review(num(d, "number"), str(d, "review")) }),
  pr_checks: (d) => ({ kind: "review", text: e.checks(num(d, "number"), str(d, "checks")) }),
  pr_merged: (d) => ({ kind: "pr", text: e.prMerged(num(d, "number")) }),
  status_changed: (d, _ev, p) => {
    const to = str(d, "to");
    return { kind: "status", text: e.status(p.workflow.find((s) => s.id === to)?.label ?? to) };
  },
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

const newestFirst = (a: ProjectEvent, b: ProjectEvent) => b.at - a.at || b.id - a.id;

export function ticketTimeline(
  events: readonly ProjectEvent[],
  project: TimelineProject,
  now: number,
): TimelineLine[] {
  return [...events].sort(newestFirst).map((ev) => ({
    id: `event-${ev.id}`,
    ...LINES[ev.kind](ev.data, ev, project),
    time: stepTime(ev.at, now),
  }));
}
