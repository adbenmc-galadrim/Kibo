import type { FeatureState } from "./feature-state";
import { featureSteps } from "./feature-steps";
import { dayNumber } from "./iso-date";
import type { Link } from "./link";
import type { TicketView } from "./rpc";
import { type Sprint, type SprintView, sortSprints } from "./sprint";
import { FINAL_STATUSES } from "./startable";

export type SprintEndFeature = {
  shortKey: string;
  title: string;
  state: FeatureState;
  remainingKeys: string[];
};

type SprintDates = Pick<Sprint, "code" | "start" | "end">;

export type SprintRecap = SprintDates & {
  name: string;
  delivered: { label: string; title: string }[];
  mergedSteps: number;
  plannedSteps: number;
  capacity: number;
  slipped: { label: string; remaining: number; keys: string[]; to: string | null }[];
  next: (SprintDates & { plannedSteps: number }) | null;
};

export type SprintRecapNext = { sprint: SprintDates; features: readonly SprintEndFeature[] };

export const STEPS_PER_WEEK = 5;
const WEEK_DAYS = 7;

export const sprintWeeks = (sprint: Pick<Sprint, "start" | "end">): number =>
  Math.max(1, Math.round((dayNumber(sprint.end) - dayNumber(sprint.start) + 1) / WEEK_DAYS));

const plannedOf = (features: readonly SprintEndFeature[]): number =>
  features.reduce((n, f) => n + f.state.steps.total, 0);

export function sprintRecap(
  sprint: SprintDates & Pick<Sprint, "name">,
  features: readonly SprintEndFeature[],
  next: SprintRecapNext | null,
): SprintRecap | null {
  if (features.length === 0) return null;
  const delivered = features.filter((f) => f.state.status === "delivered");
  const left = features.filter((f) => f.state.status !== "delivered");
  return {
    code: sprint.code,
    name: sprint.name,
    start: sprint.start,
    end: sprint.end,
    delivered: delivered.map((f) => ({ label: f.shortKey, title: f.title })),
    mergedSteps: features.reduce((n, f) => n + f.state.steps.done, 0),
    plannedSteps: plannedOf(features),
    capacity: STEPS_PER_WEEK * sprintWeeks(sprint),
    slipped: left.map((f) => ({
      label: f.shortKey,
      remaining: f.remainingKeys.length,
      keys: f.remainingKeys,
      to: next?.sprint.code ?? null,
    })),
    next:
      next === null
        ? null
        : {
            code: next.sprint.code,
            start: next.sprint.start,
            end: next.sprint.end,
            plannedSteps: plannedOf(next.features),
          },
  };
}

const stepsLeft = (n: number): string => (n === 1 ? "1 étape restante" : `${n} étapes restantes`);

function deliveredOf(keys: readonly string[]): string {
  if (keys.length === 0) return "";
  if (keys.length === 1) return ` ${keys[0]} est livrée.`;
  return ` ${keys.slice(0, -1).join(", ")} et ${keys.at(-1)} sont livrées.`;
}

export function sprintEndDigest(sprint: SprintView, features: readonly SprintEndFeature[]): string | null {
  const recap = sprintRecap(sprint, features, null);
  if (recap === null || recap.slipped.length === 0) return null;
  const left = recap.slipped.map((f) => `${f.label} a ${stepsLeft(f.remaining)} (${f.keys.join(", ")})`);
  const delivered = deliveredOf(recap.delivered.map((f) => f.label));
  return `${sprint.code} est terminé : ${left.join(" ; ")}.${delivered} Propose un report ou un retrait du planning.`;
}

type ProjectLinks = { tickets: readonly TicketView[]; links: readonly Link[] };

export function sprintEndFeatures(project: ProjectLinks, sprintId: string): SprintEndFeature[] {
  return project.tickets.flatMap((t) => {
    if (t.feature === null || t.sprintId !== sprintId) return [];
    const steps = featureSteps({ feature: t.id, tickets: project.tickets, links: project.links });
    const remainingKeys = steps
      .filter((s) => !s.optional && !FINAL_STATUSES.includes(s.statusId))
      .map((s) => s.key);
    return [{ shortKey: t.shortKey ?? t.keyLabel, title: t.title, state: t.feature, remainingKeys }];
  });
}

export function endedSprint<S extends Sprint>(sprints: readonly S[], today: string): S | null {
  return (
    sortSprints(sprints)
      .filter((s) => s.end < today)
      .at(-1) ?? null
  );
}

export function endedSprintRecap(
  project: ProjectLinks & { sprints: readonly SprintView[] },
  today: string,
): SprintRecap | null {
  const sprint = endedSprint(project.sprints, today);
  if (sprint === null) return null;
  const sorted = sortSprints(project.sprints);
  const following = sorted[sorted.findIndex((s) => s.id === sprint.id) + 1];
  const next =
    following === undefined
      ? null
      : { sprint: following, features: sprintEndFeatures(project, following.id) };
  return sprintRecap(sprint, sprintEndFeatures(project, sprint.id), next);
}
