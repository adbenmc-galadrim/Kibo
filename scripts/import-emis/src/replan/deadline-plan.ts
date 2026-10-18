import { KiboError, type Link, type ProjectCommand, type SprintView, type TicketView } from "@kibo/schema";
import {
  featureSprints,
  planSprints,
  type ScheduleSource,
  type StepSlot,
  stepInputs,
} from "../rebase/plan-sprints";

export type LiveProject = {
  tickets: readonly Pick<TicketView, "id" | "key" | "parentId" | "statusId" | "optional" | "sprintId">[];
  links: readonly Pick<Link, "from" | "to" | "type">[];
  sprints: readonly Pick<SprintView, "id" | "code" | "start" | "end">[];
};
type LiveTicket = LiveProject["tickets"][number];
type LiveSprint = LiveProject["sprints"][number];
export type FeatureMove = { key: string; from: string | null; to: string };
export type DeadlinePlan = {
  deadline: string;
  remaining: number;
  capacity: number;
  sprints: LiveSprint[];
  dropped: LiveSprint[];
  steps: StepSlot[];
  forced: string[];
  features: FeatureMove[];
  commands: ProjectCommand[];
};

const keyOf = (t: LiveTicket): string => t.key ?? t.id;
const numberOf = (key: string): number => Number(key.match(/(\d+)$/)?.[1] ?? Number.MAX_SAFE_INTEGER);
const byKey = (a: LiveTicket, b: LiveTicket): number => numberOf(keyOf(a)) - numberOf(keyOf(b));

function scheduleSource(live: LiveProject): ScheduleSource {
  const keys = new Map(live.tickets.map((t) => [t.id, keyOf(t)]));
  const features = live.tickets
    .filter((t) => t.parentId === null)
    .sort(byKey)
    .map((f) => ({
      shortKey: keyOf(f),
      steps: live.tickets
        .filter((t) => t.parentId === f.id)
        .sort(byKey)
        .map((t) => ({ newKey: keyOf(t), ticket: t })),
    }));
  const links = live.links.flatMap((l) => {
    const from = keys.get(l.from);
    const to = keys.get(l.to);
    return from && to ? [{ from, to, type: l.type }] : [];
  });
  return { features, links };
}

function splitSprints(live: LiveProject, deadline: string): { kept: LiveSprint[]; dropped: LiveSprint[] } {
  const sorted = [...live.sprints].sort((a, b) => a.start.localeCompare(b.start));
  const kept = sorted.filter((s) => s.start <= deadline);
  if (kept.length === 0) throw new KiboError("INVALID_INPUT", `no sprint starts by ${deadline}`);
  const last = kept.length - 1;
  return {
    kept: kept.map((s, i) => (i === last && s.end > deadline ? { ...s, end: deadline } : s)),
    dropped: sorted.filter((s) => s.start > deadline),
  };
}

function assertNothingLeft(
  live: LiveProject,
  moved: ReadonlySet<string>,
  dropped: readonly LiveSprint[],
): void {
  const gone = new Set(dropped.map((s) => s.id));
  const left = live.tickets.filter((t) => t.sprintId !== null && gone.has(t.sprintId) && !moved.has(t.id));
  if (left.length > 0)
    throw new KiboError("CONFLICT", `still planned in a deleted sprint: ${left.map(keyOf).join(", ")}`);
}

export function planToDeadline(live: LiveProject, deadline: string): DeadlinePlan {
  const { kept, dropped } = splitSprints(live, deadline);
  const source = scheduleSource(live);
  const inputs = stepInputs(source);
  const capacity = Math.max(1, Math.ceil(inputs.length / kept.length));
  const { slots, forced } = planSprints(inputs, capacity);
  const featureOf = new Map(live.tickets.filter((t) => t.parentId === null).map((t) => [keyOf(t), t]));
  const codeOf = new Map(live.sprints.map((s) => [s.id, s.code]));
  const features = featureSprints(
    slots,
    source.features.map((f) => f.shortKey),
  ).flatMap(({ id, sprint }) => {
    const ticket = featureOf.get(id);
    const target = kept[sprint - 1];
    if (!ticket || !target) return [];
    return [
      {
        ticket,
        target,
        move: {
          key: id,
          from: ticket.sprintId ? (codeOf.get(ticket.sprintId) ?? null) : null,
          to: target.code,
        },
      },
    ];
  });
  assertNothingLeft(live, new Set(features.map((f) => f.ticket.id)), dropped);
  const original = new Map(live.sprints.map((s) => [s.id, s.end]));
  const commands: ProjectCommand[] = [
    ...features
      .filter((f) => f.ticket.sprintId !== f.target.id)
      .map(
        (f): ProjectCommand => ({ method: "setTicketSprint", ticketId: f.ticket.id, sprintId: f.target.id }),
      ),
    ...kept
      .filter((s) => original.get(s.id) !== s.end)
      .map((s): ProjectCommand => ({ method: "updateSprint", sprintId: s.id, patch: { end: s.end } })),
    ...dropped.map((s): ProjectCommand => ({ method: "deleteSprint", sprintId: s.id })),
  ];
  return {
    deadline,
    remaining: inputs.length,
    capacity,
    sprints: kept,
    dropped,
    steps: slots,
    forced,
    features: features.map((f) => f.move),
    commands,
  };
}
