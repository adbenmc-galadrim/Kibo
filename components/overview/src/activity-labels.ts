import { DELIVERY_STEP_LABELS, type ProjectEvent, type ProjectEventKind } from "@kibo/schema";
import { phaseLabel } from "@kibo/sdk";

type ActivityContext = {
  subject: string;
  statusName(statusId: string): string;
  questionRef(questionId: string): string | null;
};
type Data = ProjectEvent["data"];
type Labeler = (data: Data, ctx: ActivityContext, event: ProjectEvent) => string;

const MINUTE = 60_000;

const text = (data: Data, key: string): string | null => {
  const value = data[key];
  return typeof value === "string" && value !== "" ? value : null;
};
const num = (data: Data, key: string): number | null => {
  const value = data[key];
  return typeof value === "number" ? value : null;
};
const spaced = (value: string | null): string => (value === null ? "" : ` ${value}`);
const pr = (data: Data): string => {
  const number = num(data, "number");
  return number === null ? "PR" : `PR #${number}`;
};
const lot = (data: Data): string => {
  const seq = num(data, "seq");
  return seq === null ? "lot" : `lot n° ${seq}`;
};
const delivered = (data: Data): string => {
  const shortKey = text(data, "delivered");
  return shortKey === null ? "" : ` · ${shortKey} livrée`;
};

const REVIEW: Record<string, (p: string) => string> = {
  changes_requested: (p) => `${p} · changements demandés`,
  approved: (p) => `${p} approuvée`,
  review_required: (p) => `${p} · review demandée`,
};
const CHECKS: Record<string, string> = { ok: "CI verte", error: "CI cassée", running: "CI en cours" };
const DECISION: Record<string, string> = { apply: "validé", reject: "refusé" };

function sprintSet(data: Data, ctx: ActivityContext): string {
  const from = text(data, "from");
  const to = text(data, "to");
  if (to === null) return `${ctx.subject} retirée du planning`.trim();
  return `${ctx.subject} ${from === null ? "planifiée" : "reportée"} en ${to}`.trim();
}

function stepSet(data: Data, _ctx: ActivityContext, event: ProjectEvent): string {
  const step = num(data, "step");
  if (step === null) return event.source === "update-delivery" ? "Retouche" : "Étape de livraison";
  const label = phaseLabel(step, DELIVERY_STEP_LABELS[step] ?? "");
  return event.source === "update-delivery" ? `Retouche · ${label}` : label;
}

function sessionStopped(data: Data): string {
  const ms = num(data, "durationMs");
  return ms === null ? "Session terminée" : `Session terminée · ${Math.round(ms / MINUTE)} min`;
}

function question(data: Data, ctx: ActivityContext): string | null {
  const id = text(data, "questionId");
  return text(data, "ref") ?? (id === null ? null : ctx.questionRef(id)) ?? text(data, "title");
}

const LABELS: Record<ProjectEventKind, Labeler> = {
  branch_created: (d) => `Branche${spaced(text(d, "branch"))} créée`,
  pr_opened: (d) => `${pr(d)} ouverte`,
  pr_review: (d) => (REVIEW[text(d, "review") ?? ""] ?? ((p: string) => `${p} · review mise à jour`))(pr(d)),
  pr_checks: (d) => `${pr(d)} · ${CHECKS[text(d, "checks") ?? ""] ?? "CI mise à jour"}`,
  pr_merged: (d) => `${pr(d)} fusionnée${delivered(d)}`,
  status_changed: (d, ctx) => {
    const to = text(d, "to");
    return `${to === null ? "Statut modifié" : `Statut : ${ctx.statusName(to)}`}${delivered(d)}`;
  },
  step_set: stepSet,
  session_started: () => "Session démarrée",
  session_stopped: sessionStopped,
  t3_started: () => "Fil T3 lancé",
  t3_finished: () => "Fil T3 terminé",
  sprint_created: (d) => `Sprint${spaced(text(d, "code"))} créé`,
  sprint_set: sprintSet,
  batch_proposed: (d) => `Agent de projet · ${lot(d)} proposé`,
  batch_decided: (d) => {
    const label = `Lot${num(d, "seq") === null ? "" : ` n° ${num(d, "seq")}`}`;
    return `${label} ${DECISION[text(d, "decision") ?? ""] ?? "décidé"}`;
  },
  question_created: (d, ctx) => `Question${spaced(question(d, ctx))} posée`,
  question_answered: (d, ctx) => `${question(d, ctx) ?? "Question"} répondue`,
  question_reminded: (d, ctx) => `${question(d, ctx) ?? "Question"} relancée`,
  question_deleted: (d, ctx) => `${question(d, ctx) ?? "Question"} supprimée`,
  held: (d) => `Mise en attente${text(d, "reason") === null ? "" : ` · ${text(d, "reason")}`}`,
  resumed: () => "Reprise",
  keys_assigned: () => "Clés attribuées localement",
};

export const activityLabel = (event: ProjectEvent, ctx: ActivityContext): string =>
  LABELS[event.kind](event.data, ctx, event);
