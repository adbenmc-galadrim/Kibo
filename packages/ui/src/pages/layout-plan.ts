import { GRID_COLUMNS, type Instance, type Layout, overlaps } from "@kibo/schema";
import { canPlace, nextLayout, resolveOverlaps } from "../lib/format-grid";
import { asFormat, type Draft, sameLayout } from "./layout-draft";

export type LayoutStep = { id: string; layout: Layout };

type Entry = [string, Layout];

const byReading = ([a, la]: Entry, [b, lb]: Entry): number =>
  la.y - lb.y || la.x - lb.x || (a < b ? -1 : a > b ? 1 : 0);

const savedLayout = (target: Layout): Layout => {
  const layout = asFormat(target);
  return { ...layout, x: Math.min(layout.x, Math.max(0, GRID_COLUMNS - layout.w)) };
};

const finalLayouts = (stored: Draft, target: Draft): Map<string, Layout> => {
  const finals = new Map<string, Layout>();
  for (const [id, shown] of target) {
    const before = stored.get(id);
    if (!before || sameLayout(before, shown)) continue;
    const layout = savedLayout(shown);
    if (!sameLayout(before, layout)) finals.set(id, layout);
  }
  return finals;
};

const othersThan = (current: Draft, id: string): Layout[] =>
  [...current].filter(([other]) => other !== id).map(([, l]) => l);

const parkingStep = (current: Draft, pending: readonly Entry[]): LayoutStep | null => {
  const finals = pending.map(([, l]) => l);
  for (const [id, final] of pending) {
    const here = current.get(id);
    if (!here || !pending.some(([other, l]) => other !== id && overlaps(here, l))) continue;
    const blocked = [...othersThan(current, id), ...finals];
    const slot = nextLayout(blocked, { w: final.w, h: final.h });
    if (canPlace(slot, blocked)) return { id, layout: slot };
  }
  return null;
};

export function planLayoutSave(stored: Draft, target: Draft): LayoutStep[] {
  const current = new Map(stored);
  const finals = finalLayouts(stored, target);
  const steps: LayoutStep[] = [];
  const place = (step: LayoutStep) => {
    steps.push(step);
    current.set(step.id, step.layout);
  };
  while (finals.size > 0) {
    const pending = [...finals].sort(byReading);
    const ready = pending.find(([id, l]) => canPlace(l, othersThan(current, id)));
    if (ready) {
      place({ id: ready[0], layout: ready[1] });
      finals.delete(ready[0]);
      continue;
    }
    const parking = parkingStep(current, pending);
    if (!parking) return [...steps, ...pending.map(([id, layout]) => ({ id, layout }))];
    place(parking);
  }
  return steps;
}

export function saveTarget(instances: readonly Instance[], draft: Draft, changed: readonly string[]): Draft {
  const target = resolveOverlaps(instances);
  for (const id of changed) {
    const layout = draft.get(id);
    if (layout) target.set(id, layout);
  }
  return target;
}
