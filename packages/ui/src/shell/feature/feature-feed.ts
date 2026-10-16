import { DELIVERY_STEP_LABELS, findRecipient, type ProjectSnapshot } from "@kibo/schema";
import { frFeature as t } from "../../i18n/fr-group";
import type { StepModel } from "./feature-model";
import { ageLabel, shortTime } from "./time-format";

export type ActivityKind = "pr_opened" | "pr_merged" | "step";
export type ActivityItem = { kind: ActivityKind; text: string; time: string };

export const ACTIVITY_MAX = 5;

const itemOf = (s: StepModel, delivery: NonNullable<StepModel["delivery"]>, now: number): ActivityItem => {
  const time = shortTime(delivery.at, now);
  if (s.pr?.state === "merged") return { kind: "pr_merged", text: t.prMerged(s.pr.number, s.key), time };
  if (s.pr && s.pr.state !== "closed")
    return { kind: "pr_opened", text: t.prOpened(s.pr.number, s.key), time };
  const label = DELIVERY_STEP_LABELS[delivery.step] ?? "";
  return { kind: "step", text: t.stepDone(delivery.step, label, s.key), time };
};

export function featureActivity(steps: readonly StepModel[], now: number): ActivityItem[] {
  return steps
    .flatMap((s) => (s.delivery ? [{ at: s.delivery.at, item: itemOf(s, s.delivery, now) }] : []))
    .sort((a, b) => b.at - a.at)
    .slice(0, ACTIVITY_MAX)
    .map((x) => x.item);
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
