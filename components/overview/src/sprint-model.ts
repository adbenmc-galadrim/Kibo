import {
  atRisk,
  currentSprint,
  deliveryBrief,
  type FeatureStatus,
  FINAL_STATUSES,
  inProgressFeatures,
  lateFeatures,
  limitNote,
  nextDeliverableStep,
  nextFeature,
  nextSprint,
  nextToOpen,
  type ProjectEvent,
  type SprintView,
  slippedFrom,
  type TicketView,
} from "@kibo/schema";
import type { CaseTone } from "@kibo/sdk/tracking";
import { fr } from "./fr";
import { type FeatureFacts, stepTone } from "./overview-facts";
import { lingeringDates, sprintCardDates } from "./sprint-label";

export type FeatureLine = {
  id: string;
  shortKey: string;
  title: string;
  state: FeatureStatus;
  tones: CaseTone[];
  steps: string;
};
export type SprintRow = FeatureLine & { risk: boolean; slipped: string | null };
export type SprintCard = {
  sprint: SprintView;
  lingering: boolean;
  title: string;
  dates: string;
  ahead: string | null;
  rows: SprintRow[];
  remaining: number;
  note: string | null;
};
export type RemainingStep = {
  ticketId: string;
  key: string;
  title: string;
  tone: CaseTone;
  changes: boolean;
};
export type NextCard = FeatureLine & {
  late: boolean;
  from: string | null;
  remaining: RemainingStep[];
  deliver: { ticketId: string; key: string; command: string } | null;
};
export type SprintInput = {
  tickets: readonly TicketView[];
  sprints: readonly SprintView[];
  features: readonly FeatureFacts[];
  blocking: ReadonlyMap<string, string>;
  limit: number;
  today: string;
  events: readonly ProjectEvent[];
};

export const lineOf = (f: FeatureFacts, blocking: ReadonlyMap<string, string>): FeatureLine => ({
  id: f.id,
  shortKey: f.shortKey,
  title: f.title,
  state: f.state.status,
  tones: f.steps.map((s) => stepTone(s, blocking)),
  steps: fr.steps(f.state.steps.done, f.state.steps.total),
});

export const sprintOf = (input: Pick<SprintInput, "sprints" | "today">): SprintView | null =>
  currentSprint(input.sprints, input.today) ?? nextSprint(input.sprints, input.today);

export function aheadOfSprint(input: Pick<SprintInput, "features" | "sprints" | "today" | "limit">) {
  const sprint = sprintOf(input);
  if (sprint === null) return [];
  const { inProgress } = inProgressFeatures(input.features, input.limit);
  return inProgress.flatMap((f) => {
    const own = input.sprints.find((s) => s.id === f.sprintId);
    return own !== undefined && own.start > sprint.start ? [{ shortKey: f.shortKey, code: own.code }] : [];
  });
}

const isAtRisk = (f: FeatureFacts, sprint: SprintView, today: string): boolean =>
  atRisk({ sprint, steps: f.steps }, today);

export function sprintCard(input: SprintInput): SprintCard | null {
  const sprint = sprintOf(input);
  if (sprint === null) return null;
  const { inProgress } = inProgressFeatures(input.features, input.limit);
  const note = limitNote({
    open: inProgress.map((f) => f.shortKey),
    next: nextToOpen({ tickets: [...input.tickets], sprints: [...input.sprints] }),
    limit: input.limit,
  });
  const inSprint = input.features.filter((f) => f.sprintId === sprint.id);
  const remaining = inSprint.filter((f) => f.state.status !== "delivered").length;
  const lingering = sprint.end < input.today;
  const following = nextSprint(input.sprints, input.today);
  const ahead = aheadOfSprint(input);
  return {
    sprint,
    lingering,
    title: lingering ? fr.sprint.lastTitle(sprint.code) : fr.sprint.title(sprint.code, sprint.name),
    dates:
      lingering && following !== null
        ? lingeringDates(following)
        : sprintCardDates(sprint, input.today, remaining),
    ahead: ahead.length === 0 ? null : fr.sprint.ahead(ahead),
    rows: inSprint.map((f) => ({
      ...lineOf(f, input.blocking),
      risk: f.state.status !== "delivered" && isAtRisk(f, sprint, input.today),
      slipped: slippedFrom(input.events, f.id, input.sprints),
    })),
    remaining,
    note: note === null ? null : fr.sprint.limit(input.limit, note.next, note.open),
  };
}

type PickedFeature = { feature: FeatureFacts; late: boolean; from: string | null };

function mostAdvancedOf(features: readonly FeatureFacts[], sprint: SprintView | null): FeatureFacts | null {
  const candidates = features.filter((f) => sprint !== null && f.sprintId === sprint.id);
  const id = nextFeature(candidates);
  return candidates.find((f) => f.id === id) ?? null;
}

function lateFirst(input: SprintInput): PickedFeature | null {
  const views = input.features.map((f) => ({ ...f, remaining: f.state.remaining }));
  const late = lateFeatures(views, input.sprints, input.today);
  const lateId = nextFeature(late) ?? late[0]?.id;
  const lateOne = input.features.find((f) => f.id === lateId);
  if (lateOne !== undefined) return { feature: lateOne, late: true, from: null };
  const sprint = sprintOf(input);
  const feature = mostAdvancedOf(input.features, sprint);
  if (feature !== null) return { feature, late: false, from: null };
  if (sprint === null || sprint.end >= input.today) return null;
  const following = nextSprint(input.sprints, input.today);
  const ahead = mostAdvancedOf(input.features, following);
  return ahead === null || following === null ? null : { feature: ahead, late: false, from: following.code };
}

export function nextCard(input: SprintInput): NextCard | null {
  const pick = lateFirst(input);
  if (pick === null) return null;
  const { feature } = pick;
  const stepId = nextDeliverableStep(feature.steps);
  const step = feature.steps.find((s) => s.ticketId === stepId);
  return {
    ...lineOf(feature, input.blocking),
    late: pick.late,
    from: pick.from,
    remaining: feature.steps
      .filter((s) => !FINAL_STATUSES.includes(s.statusId))
      .map((s) => ({
        ticketId: s.ticketId,
        key: s.key,
        title: s.title,
        tone: stepTone(s, input.blocking),
        changes: s.pr?.review === "changes_requested",
      })),
    deliver:
      step === undefined
        ? null
        : { ticketId: step.ticketId, key: step.key, command: deliveryBrief(step.key) },
  };
}
