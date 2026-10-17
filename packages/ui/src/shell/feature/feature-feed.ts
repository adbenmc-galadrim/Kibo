import {
  DELIVERY_STEP_LABELS,
  findRecipient,
  type ProjectEvent,
  type ProjectEventKind,
  type ProjectSnapshot,
} from "@kibo/schema";
import { frFeature as t } from "../../i18n/fr-group";
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
  | "question";
export type ActivityItem = { id: string; kind: ActivityKind; text: string; time: string };

export const ACTIVITY_MAX = 5;

const itemOf = (s: StepModel, delivery: NonNullable<StepModel["delivery"]>, now: number): ActivityItem => {
  const base = { id: s.ticketId, time: shortTime(delivery.at, now) };
  if (s.pr?.state === "merged") return { ...base, kind: "pr_merged", text: t.prMerged(s.pr.number, s.key) };
  if (s.pr && s.pr.state !== "closed")
    return { ...base, kind: "pr_opened", text: t.prOpened(s.pr.number, s.key) };
  const label = DELIVERY_STEP_LABELS[delivery.step] ?? "";
  return { ...base, kind: "step", text: t.stepDone(delivery.step, label, s.key) };
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

const LINES: Record<ProjectEventKind, (d: Data, ev: ProjectEvent, p: JournalProject) => Line> = {
  branch_created: (d) => ({ kind: "branch", text: e.branch(str(d, "branch") ?? "") }),
  pr_opened: (d) => ({ kind: "pr_opened", text: e.prOpened(num(d, "number")) }),
  pr_review: (d) => ({ kind: "review", text: e.review(num(d, "number"), str(d, "review")) }),
  pr_checks: (d) => ({ kind: "review", text: e.checks(num(d, "number"), str(d, "checks")) }),
  pr_merged: (d) => ({ kind: "pr_merged", text: e.prMerged(num(d, "number"), str(d, "delivered")) }),
  status_changed: (d, _ev, p) => ({
    kind: "status",
    text: e.status(p.workflow.find((s) => s.id === str(d, "to"))?.label ?? str(d, "to") ?? ""),
  }),
  step_set: (d, ev) => {
    const step = num(d, "step");
    const label = DELIVERY_STEP_LABELS[step] ?? "";
    return {
      kind: "step",
      text: ev.source === "update-delivery" ? e.retouch(step, label) : e.step(step, label),
    };
  },
  session_started: () => ({ kind: "session", text: e.sessionStarted }),
  session_stopped: () => ({ kind: "session", text: e.sessionStopped }),
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
  question_created: () => ({ kind: "question", text: e.questionCreated }),
  question_answered: () => ({ kind: "question", text: e.questionAnswered }),
  question_reminded: (d) => ({ kind: "question", text: e.reminded(str(d, "ref")) }),
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

export type FeatureQuestion = { id: string; title: string; meta: string };

export function featureQuestions(
  project: Pick<ProjectSnapshot, "tickets" | "questions" | "questionRecipients">,
  featureId: string,
  now: number,
): FeatureQuestion[] {
  const keys = new Map(
    project.tickets
      .filter((x) => x.id === featureId || x.parentId === featureId)
      .map((x) => [x.id, x.keyLabel]),
  );
  return project.questions
    .filter((q) => q.answer === null && q.archivedAt === null && keys.has(q.ticketId))
    .map((q) => ({
      id: q.id,
      title: q.title,
      meta: [
        q.importRef?.id ?? null,
        findRecipient(project.questionRecipients, q.recipient)?.name ?? null,
        ageLabel(q.createdAt, now),
        keys.get(q.ticketId) ?? null,
      ]
        .filter((p) => p !== null)
        .join(" · "),
    }));
}
