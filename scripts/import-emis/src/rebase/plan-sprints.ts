import { KiboError, SPRINT_COUNT_MAX } from "@kibo/schema";
import type { Mapping, NewFeature } from "./mapping";

export type PlanInput = { id: string; order: number; remaining: number; blockedBy: readonly string[] };
export type Scheduled = { id: string; sprint: number };
export type IgnoredDependency = { feature: string; blockedBy: string };

function topological(features: readonly PlanInput[]): PlanInput[] {
  const pending = [...features].sort((a, b) => a.order - b.order);
  const ids = new Set(pending.map((f) => f.id));
  const placed = new Set<string>();
  const out: PlanInput[] = [];
  while (pending.length > 0) {
    const index = pending.findIndex((f) => f.blockedBy.every((b) => !ids.has(b) || placed.has(b)));
    const next = pending[index];
    if (next === undefined)
      throw new KiboError("INVALID_INPUT", `dependency cycle between ${pending.map((f) => f.id).join(", ")}`);
    pending.splice(index, 1);
    placed.add(next.id);
    out.push(next);
  }
  return out;
}

function ordered(features: readonly PlanInput[], capacity: number): PlanInput[] {
  if (!Number.isInteger(capacity) || capacity < 1)
    throw new KiboError("INVALID_INPUT", `capacity must be a positive integer, got ${capacity}`);
  const open = topological(features.filter((f) => f.remaining > 0));
  const total = open.reduce((n, f) => n + f.remaining, 0);
  if (total > SPRINT_COUNT_MAX * capacity)
    throw new KiboError(
      "INVALID_INPUT",
      `plan trop long pour ${SPRINT_COUNT_MAX} sprints : vitesse ${capacity}, ${total} étapes`,
    );
  return open;
}

export function planSprints(features: readonly PlanInput[], capacity: number): Scheduled[] {
  let used = 0;
  return ordered(features, capacity).map((f) => {
    used += f.remaining;
    return { id: f.id, sprint: Math.ceil(used / capacity) };
  });
}

export function sprintLoads(features: readonly PlanInput[], capacity: number): number[] {
  const total = ordered(features, capacity).reduce((n, f) => n + f.remaining, 0);
  const sprints = Math.ceil(total / capacity);
  return Array.from({ length: sprints }, (_, i) => Math.min(capacity, total - i * capacity));
}

const isRemaining = (t: { statusId: string; optional: boolean }): boolean =>
  t.statusId !== "done" && !t.optional;
const remainingOf = (f: NewFeature): number => f.steps.filter((s) => isRemaining(s.ticket)).length;

function openOwners(mapping: Mapping): Map<string, string> {
  const owner = new Map<string, string>();
  for (const f of mapping.features) {
    if (remainingOf(f) > 0) owner.set(f.shortKey, f.shortKey);
    for (const s of f.steps) if (isRemaining(s.ticket)) owner.set(s.newKey, f.shortKey);
  }
  return owner;
}

function components(ids: readonly string[], edges: ReadonlyMap<string, Set<string>>): Map<string, number> {
  const reach = (from: string): Set<string> => {
    const seen = new Set<string>([from]);
    const stack = [from];
    for (let id = stack.pop(); id !== undefined; id = stack.pop()) {
      const fresh = [...(edges.get(id) ?? [])].filter((next) => !seen.has(next));
      for (const next of fresh) seen.add(next);
      stack.push(...fresh);
    }
    return seen;
  };
  const reaches = new Map(ids.map((id) => [id, reach(id)]));
  const component = new Map<string, number>();
  ids.forEach((id, i) => {
    const same = ids.find((other) => reaches.get(id)?.has(other) && reaches.get(other)?.has(id));
    component.set(id, same === undefined ? i : ids.indexOf(same));
  });
  return component;
}

export function featureInputs(mapping: Mapping): { inputs: PlanInput[]; ignored: IgnoredDependency[] } {
  const owner = openOwners(mapping);
  const ids = mapping.features.map((f) => f.shortKey);
  const blockers = new Map<string, Set<string>>(ids.map((id) => [id, new Set<string>()]));
  for (const l of mapping.links) {
    const from = owner.get(l.from);
    const to = owner.get(l.to);
    if (l.type === "blocks" && from !== undefined && to !== undefined && from !== to)
      blockers.get(to)?.add(from);
  }
  const component = components(ids, blockers);
  const ignored: IgnoredDependency[] = [];
  const inputs = mapping.features.map((f, order) => {
    const blockedBy = [...(blockers.get(f.shortKey) ?? [])].filter((b) => {
      const kept = component.get(b) !== component.get(f.shortKey) || ids.indexOf(b) < order;
      if (!kept) ignored.push({ feature: f.shortKey, blockedBy: b });
      return kept;
    });
    return {
      id: f.shortKey,
      order,
      remaining: remainingOf(f),
      blockedBy: blockedBy.sort((a, b) => ids.indexOf(a) - ids.indexOf(b)),
    };
  });
  return { inputs, ignored };
}
