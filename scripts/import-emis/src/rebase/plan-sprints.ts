import { KiboError, SPRINT_COUNT_MAX } from "@kibo/schema";
import type { NewFeature } from "./mapping";

export type StepInput = { key: string; feature: string; order: number; blockedBy: readonly string[] };
export type StepSlot = { key: string; feature: string; sprint: number };
export type StepPlan = { slots: StepSlot[]; forced: string[] };
export type Scheduled = { id: string; sprint: number };

function assertCapacity(steps: readonly StepInput[], capacity: number): void {
  if (!Number.isInteger(capacity) || capacity < 1)
    throw new KiboError("INVALID_INPUT", `capacity must be a positive integer, got ${capacity}`);
  if (steps.length > SPRINT_COUNT_MAX * capacity)
    throw new KiboError(
      "INVALID_INPUT",
      `plan trop long pour ${SPRINT_COUNT_MAX} sprints : vitesse ${capacity}, ${steps.length} étapes`,
    );
}

export function planSprints(steps: readonly StepInput[], capacity: number): StepPlan {
  assertCapacity(steps, capacity);
  const pending = [...steps].sort((a, b) => a.order - b.order);
  const known = new Set(pending.map((s) => s.key));
  const placed = new Set<string>();
  const slots: StepSlot[] = [];
  const forced: string[] = [];
  while (pending.length > 0) {
    const free = pending.findIndex((s) => s.blockedBy.every((b) => !known.has(b) || placed.has(b)));
    const index = free >= 0 ? free : 0;
    const [next] = pending.splice(index, 1);
    if (next === undefined) break;
    if (free < 0) forced.push(next.key);
    placed.add(next.key);
    slots.push({ key: next.key, feature: next.feature, sprint: Math.floor(slots.length / capacity) + 1 });
  }
  return { slots, forced };
}

export function featureSprints(slots: readonly StepSlot[], featureOrder: readonly string[]): Scheduled[] {
  const last = new Map<string, number>();
  for (const s of slots) last.set(s.feature, Math.max(last.get(s.feature) ?? 0, s.sprint));
  return [...last.entries()]
    .map(([id, sprint]) => ({ id, sprint }))
    .sort((a, b) => a.sprint - b.sprint || featureOrder.indexOf(a.id) - featureOrder.indexOf(b.id));
}

const isRemaining = (t: { statusId: string; optional: boolean }): boolean =>
  t.statusId !== "done" && !t.optional;
export const remainingOf = (f: NewFeature): number => f.steps.filter((s) => isRemaining(s.ticket)).length;

export type ScheduleSource = {
  features: readonly {
    shortKey: string;
    steps: readonly { newKey: string; ticket: { statusId: string; optional: boolean } }[];
  }[];
  links: readonly { from: string; to: string; type: string }[];
};

function members(mapping: ScheduleSource): Map<string, string[]> {
  const of = new Map<string, string[]>();
  for (const f of mapping.features) {
    const open = f.steps.filter((s) => isRemaining(s.ticket)).map((s) => s.newKey);
    of.set(f.shortKey, open);
    for (const key of open) of.set(key, [key]);
  }
  return of;
}

export function stepInputs(mapping: ScheduleSource): StepInput[] {
  const of = members(mapping);
  const blockers = new Map<string, Set<string>>();
  for (const l of mapping.links) {
    if (l.type !== "blocks") continue;
    for (const to of of.get(l.to) ?? [])
      for (const from of of.get(l.from) ?? [])
        if (from !== to) blockers.set(to, (blockers.get(to) ?? new Set()).add(from));
  }
  let order = 0;
  return mapping.features.flatMap((f) =>
    f.steps.flatMap((s) => {
      order += 1;
      if (!isRemaining(s.ticket)) return [];
      return [{ key: s.newKey, feature: f.shortKey, order, blockedBy: [...(blockers.get(s.newKey) ?? [])] }];
    }),
  );
}
