import {
  type FeatureState,
  type FeatureStep,
  featureSteps,
  isFeature,
  isOpen,
  type Link,
  liveReview,
  type OnHold,
  type Question,
  type SprintState,
  type SprintView,
  sortSprints,
  sprintState,
  type TicketView,
} from "@kibo/schema";
import { type CaseTone, stepCaseTone } from "@kibo/sdk/tracking";
import {
  FIRST_FRAME_Y,
  FRAME_MIN_W,
  frameHeight,
  frameWidth,
  laneMargin,
  STACK_GAP,
  type TitleLines,
  titleLines,
} from "./frame-geometry";
import { lanePhase, sprintStateLabel } from "./sprint-label";

export { frameWidth } from "./frame-geometry";

export type StepTone = CaseTone;
export type GitMark = {
  kind: "merged" | "pr" | "branch";
  tone: "green" | "purple" | "amber" | "blue" | "dim";
};
export type LaneStep = {
  ticketId: string;
  key: string;
  title: string;
  tone: StepTone;
  git: GitMark | null;
  session: boolean;
  hold: OnHold | null;
  startable: boolean;
};
export type FrameSegment = { ticketId: string; tone: StepTone };
export type FrameFooter =
  | { kind: "blocked"; question: string | null }
  | { kind: "late"; slipTo: string | null };
export type LaneFrame = {
  id: string;
  shortKey: string;
  title: string;
  done: number;
  total: number;
  delivered: boolean;
  held: number;
  late: boolean;
  collapsed: boolean;
  segments: FrameSegment[];
  steps: LaneStep[];
  footer: FrameFooter | null;
  titleLines: TitleLines;
  x: number;
  y: number;
  width: number;
  height: number;
};
export type Lane = {
  id: string;
  code: string | null;
  name: string | null;
  state: SprintState | null;
  label: string | null;
  tone: "canvas" | "panel";
  x: number;
  width: number;
  frames: LaneFrame[];
};
export type LaneEdge = { from: string; to: string };
export type SprintLanesModel = {
  lanes: Lane[];
  edges: LaneEdge[];
  features: number;
  stepLinks: number;
  featureLinks: number;
  width: number;
  height: number;
};
export type SprintLanesInput = {
  tickets: readonly TicketView[];
  links: readonly Link[];
  sprints: readonly SprintView[];
  questions: readonly Question[];
  today: string | null;
};

export const RESERVE_LANE = "reserve";

type Feature = TicketView & { feature: FeatureState };
type Facts = {
  input: SprintLanesInput;
  blocking: ReadonlyMap<string, string | null>;
  byId: ReadonlyMap<string, TicketView>;
};
type Draft = Omit<LaneFrame, "x" | "y" | "width" | "height" | "titleLines">;

function blockingQuestions(questions: readonly Question[]): Map<string, string | null> {
  const blocking = new Map<string, string | null>();
  for (const q of questions)
    if (q.blocking && isOpen(q) && !blocking.get(q.ticketId))
      blocking.set(q.ticketId, q.importRef?.id ?? null);
  return blocking;
}

const toneOf = (step: FeatureStep, blocking: ReadonlyMap<string, string | null>): StepTone =>
  stepCaseTone(step, step.statusId === "blocked" || blocking.has(step.ticketId));

function gitOf(step: FeatureStep): GitMark | null {
  const pr = step.pr;
  if (pr === null) return step.branch === null ? null : { kind: "branch", tone: "blue" };
  if (pr.state === "merged") return { kind: "merged", tone: "green" };
  if (pr.state === "closed") return { kind: "pr", tone: "dim" };
  return { kind: "pr", tone: liveReview(pr) === "changes_requested" ? "amber" : "purple" };
}

function footerOf(f: Feature, facts: Facts, sorted: readonly SprintView[]): FrameFooter | null {
  const state = f.feature;
  if (state.status === "blocked")
    return { kind: "blocked", question: facts.blocking.get(state.nextStepId ?? "") ?? null };
  if (state.status !== "late") return null;
  const index = sorted.findIndex((s) => s.id === f.sprintId);
  return { kind: "late", slipTo: index < 0 ? null : (sorted[index + 1]?.code ?? null) };
}

function draftOf(f: Feature, facts: Facts, sorted: readonly SprintView[], waiting: boolean): Draft {
  const { input, blocking, byId } = facts;
  const steps = featureSteps({ feature: f.id, tickets: input.tickets, links: input.links });
  const delivered = f.feature.status === "delivered";
  const heldSteps = steps.filter((s) => s.onHold !== null);
  return {
    id: f.id,
    shortKey: f.shortKey ?? f.keyLabel,
    title: f.title,
    done: f.feature.steps.done,
    total: f.feature.steps.total,
    delivered,
    held: heldSteps.length,
    late: f.feature.status === "late",
    collapsed: delivered,
    segments: steps.map((s) => ({ ticketId: s.ticketId, tone: toneOf(s, blocking) })),
    steps: (delivered ? heldSteps : steps).map((s) => ({
      ticketId: s.ticketId,
      key: s.key,
      title: s.title,
      tone: toneOf(s, blocking),
      git: gitOf(s),
      session: byId.get(s.ticketId)?.session != null,
      hold: s.onHold,
      startable: !waiting && unblocked(byId.get(s.ticketId), blocking),
    })),
    footer: footerOf(f, facts, sorted),
  };
}

type LaneSeed = Pick<Lane, "id" | "code" | "name" | "state" | "label"> & { drafts: Draft[] };

function placeLane(seed: LaneSeed, index: number, x: number): Lane {
  const widths = seed.drafts.map((d) =>
    d.collapsed && d.steps.length === 0 ? FRAME_MIN_W : frameWidth(d.title, d.steps),
  );
  const width = Math.max(FRAME_MIN_W, ...widths);
  const margin = laneMargin(width);
  let y = FIRST_FRAME_Y;
  const frames = seed.drafts.map((d): LaneFrame => {
    const lines = titleLines(d.title, width);
    const height = frameHeight({ lines, steps: d.steps.length, footer: d.footer !== null });
    const frame = {
      ...d,
      titleLines: lines,
      x: x + margin,
      y,
      width,
      height,
    };
    y += height + STACK_GAP;
    return frame;
  });
  const { drafts: _, ...rest } = seed;
  return { ...rest, tone: index % 2 === 0 ? "canvas" : "panel", x, width: width + 2 * margin, frames };
}

function rootOf(id: string, byId: ReadonlyMap<string, TicketView>): string {
  const seen = new Set<string>();
  let current = byId.get(id);
  while (current?.parentId != null && !seen.has(current.id)) {
    seen.add(current.id);
    current = byId.get(current.parentId);
  }
  return current?.id ?? id;
}

function linksOf(
  input: SprintLanesInput,
  byId: ReadonlyMap<string, TicketView>,
  features: ReadonlySet<string>,
) {
  const edges = new Map<string, LaneEdge>();
  let stepLinks = 0;
  for (const l of input.links) {
    if (l.type !== "blocks" || l.from === l.to) continue;
    const isStep = (id: string) => byId.get(id)?.parentId != null;
    if (isStep(l.from) && isStep(l.to)) stepLinks += 1;
    const from = rootOf(l.from, byId);
    const to = rootOf(l.to, byId);
    if (from !== to && features.has(from) && features.has(to)) edges.set(`${from}>${to}`, { from, to });
  }
  return { edges: [...edges.values()], stepLinks };
}

const STEP_REFUSALS: ReadonlySet<string> = new Set(["status", "onHold"]);
const unblocked = (t: TicketView | undefined, blocking: ReadonlyMap<string, string | null>): boolean =>
  t !== undefined &&
  (t.startable ||
    (t.startReason !== null &&
      !STEP_REFUSALS.has(t.startReason.kind) &&
      t.waitingOn.length === 0 &&
      !blocking.has(t.id)));

const isDelivered = (id: string, byId: ReadonlyMap<string, TicketView>): boolean =>
  byId.get(id)?.feature?.status === "delivered";

const waitingFeatures = (
  links: readonly Link[],
  byId: ReadonlyMap<string, TicketView>,
  features: ReadonlySet<string>,
): Set<string> =>
  new Set(
    links
      .filter((l) => l.type === "blocks" && features.has(l.to))
      .filter((l) => {
        const from = rootOf(l.from, byId);
        return from !== l.to && features.has(from) && !isDelivered(from, byId);
      })
      .map((l) => l.to),
  );

const unfinished = (ids: readonly string[], byId: ReadonlyMap<string, TicketView>): number =>
  ids.filter((id) => {
    const status = byId.get(id)?.feature?.status;
    return status !== undefined && status !== "delivered";
  }).length;

export function sprintLanes(input: SprintLanesInput): SprintLanesModel {
  const byId = new Map(input.tickets.map((t) => [t.id, t]));
  const facts: Facts = { input, blocking: blockingQuestions(input.questions), byId };
  const sorted = sortSprints(input.sprints);
  const features = input.tickets.filter((t): t is Feature => isFeature(t) && t.feature !== null);
  const featureIds = new Set(features.map((f) => f.id));
  const { edges, stepLinks } = linksOf(input, byId, featureIds);
  const waiting = waitingFeatures(input.links, byId, featureIds);
  const drafts = new Map(features.map((f) => [f.id, draftOf(f, facts, sorted, waiting.has(f.id))]));
  const planned = new Set(sorted.flatMap((s) => s.features));
  const seeds: LaneSeed[] = [
    ...sorted.map((s) => ({
      id: s.id,
      code: s.code,
      name: s.name,
      state: input.today === null ? s.state : sprintState(s, input.today),
      label: sprintStateLabel(lanePhase(s, input.today), s.end, unfinished(s.features, byId)),
      drafts: s.features.flatMap((id) => drafts.get(id) ?? []),
    })),
    {
      id: RESERVE_LANE,
      code: null,
      name: null,
      state: null,
      label: null,
      drafts: features.filter((f) => !planned.has(f.id)).flatMap((f) => drafts.get(f.id) ?? []),
    },
  ];
  const lanes: Lane[] = [];
  for (const [i, seed] of seeds.entries()) {
    const last = lanes.at(-1);
    lanes.push(placeLane(seed, i, last === undefined ? 0 : last.x + last.width));
  }
  const frames = lanes.flatMap((l) => l.frames);
  const end = lanes.at(-1);
  return {
    lanes,
    edges,
    features: features.length,
    stepLinks,
    featureLinks: edges.length,
    width: end === undefined ? 0 : end.x + end.width,
    height: Math.max(0, ...frames.map((f) => f.y + f.height)) + FIRST_FRAME_Y,
  };
}
