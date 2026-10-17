import {
  currentSprint,
  deliveryBrief,
  type FeatureStatus,
  FINAL_STATUSES,
  isOpenFeature,
  limitNote,
  nextDeliverableStep,
  nextFeature,
  nextSprint,
  nextToOpen,
  type SprintView,
  type TicketView,
} from "@kibo/schema";
import type { CaseTone } from "@kibo/sdk/tracking";
import { fr } from "./fr";
import { dayMonth, type FeatureFacts, sprintDates, stepTone } from "./overview-facts";

export type FeatureLine = {
  id: string;
  shortKey: string;
  title: string;
  state: FeatureStatus;
  tones: CaseTone[];
  steps: string;
};
export type SprintCard = {
  sprint: SprintView;
  title: string;
  dates: string;
  open: { text: string; full: boolean };
  rows: FeatureLine[];
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
};

const lineOf = (f: FeatureFacts, blocking: ReadonlyMap<string, string>): FeatureLine => ({
  id: f.id,
  shortKey: f.shortKey,
  title: f.title,
  state: f.state.status,
  tones: f.steps.map((s) => stepTone(s, blocking)),
  steps: fr.steps(f.state.steps.done, f.state.steps.total),
});

export const sprintOf = (input: Pick<SprintInput, "sprints" | "today">): SprintView | null =>
  currentSprint(input.sprints, input.today) ?? nextSprint(input.sprints, input.today);

export function sprintCard(input: SprintInput): SprintCard | null {
  const sprint = sprintOf(input);
  if (sprint === null) return null;
  const open = input.features.filter((f) => isOpenFeature(f.state));
  const note = limitNote({
    open: open.map((f) => f.shortKey),
    next: nextToOpen({ tickets: [...input.tickets], sprints: [...input.sprints] }),
    limit: input.limit,
  });
  const current = sprint.state === "current";
  return {
    sprint,
    title: fr.sprint.title(sprint.code, sprint.name),
    dates: current ? sprintDates(sprint.start, sprint.end) : fr.sprint.startsOn(dayMonth(sprint.start)),
    open: { text: fr.sprint.open(open.length, input.limit), full: open.length >= input.limit },
    rows: input.features.filter((f) => f.sprintId === sprint.id).map((f) => lineOf(f, input.blocking)),
    note: note === null ? null : fr.sprint.limit(input.limit, note.next, note.open),
  };
}

export function nextCard(input: SprintInput): NextCard | null {
  const sprint = sprintOf(input);
  const candidates = input.features.filter((f) => sprint !== null && f.sprintId === sprint.id);
  const id = nextFeature(candidates);
  const feature = candidates.find((f) => f.id === id);
  if (feature === undefined) return null;
  const stepId = nextDeliverableStep(feature.steps);
  const step = feature.steps.find((s) => s.ticketId === stepId);
  return {
    ...lineOf(feature, input.blocking),
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
