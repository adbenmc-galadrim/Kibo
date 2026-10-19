import {
  findRecipient,
  type ProjectEvent,
  type ProjectEventKind,
  type ProjectSnapshot,
  questionLabel,
} from "@kibo/schema";
import { frFeature as t } from "../../i18n/fr-group";
import { eventLine } from "../../ticket/activity/ticket-timeline";
import { deliveryPhase } from "../../ticket/tracking-model";
import type { StepModel } from "./feature-model";
import { ageLabel, shortTime } from "./time-format";

export type ActivityKind =
  | "pr_opened"
  | "pr_merged"
  | "review"
  | "step"
  | "branch"
  | "status"
  | "session"
  | "sprint"
  | "agent"
  | "question"
  | "hold";
export type ActivityItem = { id: string; kind: ActivityKind; text: string; time: string };

export const ACTIVITY_MAX = 5;

const itemOf = (s: StepModel, delivery: NonNullable<StepModel["delivery"]>, now: number): ActivityItem => {
  const base = { id: s.ticketId, time: shortTime(delivery.at, now) };
  if (s.pr?.state === "merged") return { ...base, kind: "pr_merged", text: t.prMerged(s.pr.number, s.key) };
  if (s.pr && s.pr.state !== "closed")
    return { ...base, kind: "pr_opened", text: t.prOpened(s.pr.number, s.key) };
  return { ...base, kind: "step", text: t.stepDone(deliveryPhase(delivery.step), s.key) };
};

export function featureActivity(steps: readonly StepModel[], now: number): ActivityItem[] {
  return steps
    .flatMap((s) => (s.delivery ? [{ at: s.delivery.at, item: itemOf(s, s.delivery, now) }] : []))
    .sort((a, b) => b.at - a.at)
    .slice(0, ACTIVITY_MAX)
    .map((x) => x.item);
}

type Data = ProjectEvent["data"];
type Line = { kind: ActivityKind; text: string };
type JournalProject = Pick<ProjectSnapshot, "tickets" | "workflow">;

const num = (d: Data, key: string): number => {
  const v = d[key];
  return typeof v === "number" ? v : 0;
};
const str = (d: Data, key: string): string | null => {
  const v = d[key];
  return typeof v === "string" ? v : null;
};
const e = t.events;

const sprintLine = (d: Data, feature: string): string => {
  const to = str(d, "to");
  if (to === null) return e.unplanned(feature);
  return str(d, "from") === null ? e.planned(feature, to) : e.postponed(feature, to);
};

type LineOf = (d: Data, ev: ProjectEvent, p: JournalProject) => Line;

const asTicket =
  (kind: ActivityKind): LineOf =>
  (_d, ev, p) => ({ kind, text: eventLine(ev, p).text });

const LINES: Record<ProjectEventKind, LineOf> = {
  branch_created: asTicket("branch"),
  pr_opened: asTicket("pr_opened"),
  pr_review: asTicket("review"),
  pr_checks: asTicket("review"),
  pr_merged: (d) => ({ kind: "pr_merged", text: e.prMerged(num(d, "number"), str(d, "delivered")) }),
  status_changed: asTicket("status"),
  step_set: asTicket("step"),
  session_started: asTicket("session"),
  session_stopped: asTicket("session"),
  sprint_created: (d) => ({ kind: "sprint", text: e.sprintCreated(str(d, "code") ?? "") }),
  sprint_set: (d, ev, p) => {
    const feature = p.tickets.find((x) => x.id === ev.ticketId);
    return { kind: "sprint", text: sprintLine(d, feature?.shortKey ?? feature?.keyLabel ?? "") };
  },
  batch_proposed: (d) => ({ kind: "agent", text: e.batchProposed(num(d, "seq")) }),
  batch_decided: (d) => ({
    kind: "agent",
    text: str(d, "decision") === "reject" ? e.batchRejected(num(d, "seq")) : e.batchApplied(num(d, "seq")),
  }),
  question_created: asTicket("question"),
  question_answered: asTicket("question"),
  question_reminded: asTicket("question"),
  held: asTicket("hold"),
  resumed: asTicket("hold"),
};

const OWN_SUBJECT: ReadonlySet<ProjectEventKind> = new Set(["sprint_set"]);

export function journalActivity(
  events: readonly ProjectEvent[],
  project: JournalProject,
  now: number,
): ActivityItem[] {
  const keys = new Map(project.tickets.map((x) => [x.id, x.keyLabel]));
  return events.slice(0, ACTIVITY_MAX).map((ev) => {
    const line = LINES[ev.kind](ev.data, ev, project);
    const key = ev.ticketId === null || OWN_SUBJECT.has(ev.kind) ? null : (keys.get(ev.ticketId) ?? null);
    const text = key ? `${line.text} · ${key}` : line.text;
    return { id: `event-${ev.id}`, kind: line.kind, text, time: shortTime(ev.at, now) };
  });
}

export type FeatureQuestion = { id: string; title: string; meta: string; blocking: boolean };

export function featureQuestions(
  project: Pick<ProjectSnapshot, "tickets" | "questions" | "questionRecipients">,
  featureId: string,
  now: number,
): FeatureQuestion[] {
  const keys = new Map(
    project.tickets
      .filter((x) => x.id === featureId || x.parentId === featureId)
      .map((x) => [x.id, x.shortKey ?? x.keyLabel]),
  );
  return project.questions
    .filter((q) => q.answer === null && q.archivedAt === null && keys.has(q.ticketId))
    .map((q) => ({
      id: q.id,
      title: q.title,
      meta: [
        questionLabel(q),
        findRecipient(project.questionRecipients, q.recipient)?.name ?? null,
        ageLabel(q.createdAt, now),
        keys.get(q.ticketId) ?? null,
      ]
        .filter((p) => p !== null)
        .join(" · "),
      blocking: q.blocking,
    }));
}
