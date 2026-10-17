import {
  type FeatureState,
  type FeatureStep,
  featureSteps,
  isFeature,
  isOpen,
  type Link,
  type Question,
  type SprintState,
  type SprintView,
  sortSprints,
  type TicketView,
} from "@kibo/schema";
import {
  FIRST_FRAME_Y,
  FRAME_MIN_W,
  frameHeight,
  frameWidth,
  laneMargin,
  STACK_GAP,
  titleLines,
} from "./frame-geometry";

export { frameWidth } from "./frame-geometry";

export type StepTone = "done" | "review" | "progress" | "blocked" | "todo";
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
  late: boolean;
  collapsed: boolean;
  segments: FrameSegment[];
  steps: LaneStep[];
  footer: FrameFooter | null;
  titleLines: 1 | 2;
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
  live: ReadonlySet<string>;
  collapseDelivered: boolean;
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

function toneOf(step: FeatureStep, blocking: ReadonlyMap<string, string | null>): StepTone {
  if (step.statusId === "done") return "done";
  if (step.statusId === "blocked" || blocking.has(step.ticketId)) return "blocked";
  if (step.statusId === "in_review") return "review";
  return step.statusId === "in_progress" ? "progress" : "todo";
}

function gitOf(step: FeatureStep): GitMark | null {
  const pr = step.pr;
  if (pr === null) return step.branch === null ? null : { kind: "branch", tone: "blue" };
  if (pr.state === "merged") return { kind: "merged", tone: "green" };
  if (pr.state === "closed") return { kind: "pr", tone: "dim" };
  return { kind: "pr", tone: pr.review === "changes_requested" ? "amber" : "purple" };
}

function footerOf(f: Feature, facts: Facts, sorted: readonly SprintView[]): FrameFooter | null {
  const state = f.feature;
  if (state.status === "blocked")
    return { kind: "blocked", question: facts.blocking.get(state.nextStepId ?? "") ?? null };
  if (state.status !== "late") return null;
  const index = sorted.findIndex((s) => s.id === f.sprintId);
  return { kind: "late", slipTo: index < 0 ? null : (sorted[index + 1]?.code ?? null) };
}

function draftOf(f: Feature, facts: Facts, sorted: readonly SprintView[]): Draft {
  const { input, blocking, byId } = facts;
  const steps = featureSteps({ feature: f.id, tickets: input.tickets, links: input.links });
  const delivered = f.feature.status === "delivered";
  return {
    id: f.id,
    shortKey: f.shortKey ?? f.keyLabel,
    title: f.title,
    done: f.feature.steps.done,
    total: f.feature.steps.total,
    delivered,
    late: f.feature.status === "late",
    collapsed: delivered && input.collapseDelivered,
    segments: steps.map((s) => ({ ticketId: s.ticketId, tone: toneOf(s, blocking) })),
    steps: steps.map((s) => ({
      ticketId: s.ticketId,
      key: s.key,
      title: s.title,
      tone: toneOf(s, blocking),
      git: gitOf(s),
      session: byId.get(s.ticketId)?.session != null || input.live.has(s.ticketId),
    })),
    footer: footerOf(f, facts, sorted),
  };
}

type LaneSeed = Pick<Lane, "id" | "code" | "name" | "state"> & { drafts: Draft[] };

function placeLane(seed: LaneSeed, index: number, x: number): Lane {
  const widths = seed.drafts.map((d) => (d.collapsed ? FRAME_MIN_W : frameWidth(d.title, d.steps)));
  const width = Math.max(FRAME_MIN_W, ...widths);
  const margin = laneMargin(width);
  let y = FIRST_FRAME_Y;
  const frames = seed.drafts.map((d): LaneFrame => {
    const lines = titleLines(d.title, width);
    const height = frameHeight({ lines, steps: d.collapsed ? 0 : d.steps.length, footer: d.footer !== null });
    const frame = {
      ...d,
      steps: d.collapsed ? [] : d.steps,
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

export function sprintLanes(input: SprintLanesInput): SprintLanesModel | null {
  if (input.sprints.length === 0) return null;
  const byId = new Map(input.tickets.map((t) => [t.id, t]));
  const facts: Facts = { input, blocking: blockingQuestions(input.questions), byId };
  const sorted = sortSprints(input.sprints);
  const features = input.tickets.filter((t): t is Feature => isFeature(t) && t.feature !== null);
  const drafts = new Map(features.map((f) => [f.id, draftOf(f, facts, sorted)]));
  const planned = new Set(sorted.flatMap((s) => s.features));
  const seeds: LaneSeed[] = [
    ...sorted.map((s) => ({
      id: s.id,
      code: s.code,
      name: s.name,
      state: s.state,
      drafts: s.features.flatMap((id) => drafts.get(id) ?? []),
    })),
    {
      id: RESERVE_LANE,
      code: null,
      name: null,
      state: null,
      drafts: features.filter((f) => !planned.has(f.id)).flatMap((f) => drafts.get(f.id) ?? []),
    },
  ];
  const lanes: Lane[] = [];
  for (const [i, seed] of seeds.entries()) {
    const last = lanes.at(-1);
    lanes.push(placeLane(seed, i, last === undefined ? 0 : last.x + last.width));
  }
  const { edges, stepLinks } = linksOf(input, byId, new Set(drafts.keys()));
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
