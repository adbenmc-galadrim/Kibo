import { deliveryStepLabel, type ProjectEvent, type ProjectEventKind } from "@kibo/schema";

export type ActivityContext = { subject: string; statusName(statusId: string): string };
type Data = ProjectEvent["data"];
type Labeler = (data: Data, ctx: ActivityContext, event: ProjectEvent) => string;

const text = (data: Data, key: string): string | null => {
  const value = data[key];
  return typeof value === "string" ? value : null;
};
const num = (data: Data, key: string): number | null => {
  const value = data[key];
  return typeof value === "number" ? value : null;
};
const pr = (data: Data): string => `PR #${num(data, "number") ?? "?"}`;
const delivered = (data: Data): string => {
  const shortKey = text(data, "delivered");
  return shortKey === null ? "" : ` · ${shortKey} livrée`;
};

const REVIEW: Record<string, (p: string) => string> = {
  changes_requested: (p) => `${p} · changements demandés`,
  approved: (p) => `${p} approuvée`,
  review_required: (p) => `${p} · review demandée`,
};
const CHECKS: Record<string, string> = { ok: "CI verte", error: "CI rouge", running: "CI en cours" };
const DECISION: Record<string, string> = {
  applied: "validé",
  partial: "validé en partie",
  rejected: "refusé",
};

function sprintSet(data: Data, ctx: ActivityContext): string {
  const from = text(data, "from");
  const to = text(data, "to");
  if (to === null) return `${ctx.subject} retirée du planning`;
  return from === null ? `${ctx.subject} planifiée en ${to}` : `${ctx.subject} reportée en ${to}`;
}

function stepSet(data: Data, _ctx: ActivityContext, event: ProjectEvent): string {
  const label = deliveryStepLabel(num(data, "step") ?? 0);
  return event.source === "update-delivery" ? `Retouche · ${label}` : `Étape ${label}`;
}

const questionRef = (data: Data): string => text(data, "ref") ?? "Question";

const LABELS: Record<ProjectEventKind, Labeler> = {
  branch_created: (d) => `Branche ${text(d, "branch") ?? ""} créée`,
  pr_opened: (d) => `${pr(d)} ouverte`,
  pr_review: (d) => (REVIEW[text(d, "review") ?? ""] ?? ((p: string) => `${p} · review mise à jour`))(pr(d)),
  pr_checks: (d) => `${pr(d)} · ${CHECKS[text(d, "checks") ?? ""] ?? "CI mise à jour"}`,
  pr_merged: (d) => `${pr(d)} fusionnée${delivered(d)}`,
  status_changed: (d, ctx) => `Statut : ${ctx.statusName(text(d, "to") ?? "")}${delivered(d)}`,
  step_set: stepSet,
  session_started: () => "Session démarrée",
  session_stopped: (d) => {
    const minutes = num(d, "minutes");
    return minutes === null ? "Session terminée" : `Session terminée · ${minutes} min`;
  },
  sprint_created: (d) => `Sprint ${text(d, "code") ?? ""} créé`,
  sprint_set: sprintSet,
  batch_proposed: (d) => `Suivi mis à jour · lot n° ${num(d, "seq") ?? "?"} proposé`,
  batch_decided: (d) => `Lot n° ${num(d, "seq") ?? "?"} ${DECISION[text(d, "status") ?? ""] ?? "décidé"}`,
  question_created: (d) => `Question ${questionRef(d)} posée`,
  question_answered: (d) => `${questionRef(d)} répondue`,
  question_reminded: (d) => `${questionRef(d)} relancée`,
};

export const activityLabel = (event: ProjectEvent, ctx: ActivityContext): string =>
  LABELS[event.kind](event.data, ctx, event);
