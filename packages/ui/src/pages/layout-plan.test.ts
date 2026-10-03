import { describe, expect, test } from "bun:test";
import {
  COMPONENT_FORMATS,
  type ComponentFormat,
  FORMAT_SIZES,
  formatOf,
  type Instance,
  inGrid,
  type Layout,
  layoutFor,
  overlaps,
} from "@kibo/schema";
import { createMockSdk } from "@kibo/sdk/mock";
import fc from "fast-check";
import { burndownManifest } from "../ai/draft-fixtures";
import { canPlace, nextLayout, resolveOverlaps } from "../lib/format-grid";
import { type Draft, formatChoice, sameLayout } from "./layout-draft";
import { type LayoutStep, planLayoutSave } from "./layout-plan";

const inst = (id: string, layout: Layout): Instance => ({
  id,
  pageId: "pg",
  component: "kanban@1.0.0",
  layout,
  config: {},
  componentHash: null,
});

const storedOf = (instances: readonly Instance[]): Draft => new Map(instances.map((i) => [i.id, i.layout]));

const apply = (stored: Draft, plan: readonly LayoutStep[]): Map<string, Layout> => {
  const current = new Map(stored);
  for (const step of plan) {
    const others = [...current].filter(([id]) => id !== step.id).map(([, l]) => l);
    if (!inGrid(step.layout)) throw new Error(`${step.id} outside the grid`);
    if (formatOf(step.layout) === null) throw new Error(`${step.id} is no format`);
    if (others.some((o) => overlaps(o, step.layout))) throw new Error(`${step.id} overlaps`);
    current.set(step.id, step.layout);
  }
  return current;
};

type Wish = { keep: boolean; format: ComponentFormat; x: number; y: number };

const wish = fc.record({
  keep: fc.boolean(),
  format: fc.constantFrom(...COMPONENT_FORMATS),
  x: fc.nat(11),
  y: fc.nat(30),
});

const targetOf = (stored: Draft, wishes: readonly Wish[], ids: readonly string[]): Map<string, Layout> => {
  const target = new Map<string, Layout>();
  wishes.forEach((w, i) => {
    const id = ids[i];
    const before = id === undefined ? undefined : stored.get(id);
    if (id === undefined || before === undefined) return;
    const taken = [...target.values()];
    const size = FORMAT_SIZES[w.format];
    const wanted = { ...size, x: Math.min(w.x, 12 - size.w), y: w.y };
    const layout =
      w.keep && canPlace(before, taken) ? before : canPlace(wanted, taken) ? wanted : nextLayout(taken, size);
    target.set(id, layout);
  });
  return target;
};

const scenario = (
  specs: readonly { stored: Layout; wish: Wish }[],
): { stored: Draft; target: Map<string, Layout> } => {
  const ids = specs.map((_, i) => `i${i}`);
  const stored = new Map(specs.map((s, i) => [`i${i}`, s.stored]));
  return {
    stored,
    target: targetOf(
      stored,
      specs.map((s) => s.wish),
      ids,
    ),
  };
};

const formatLayout = fc
  .constantFrom(...COMPONENT_FORMATS)
  .chain((format) =>
    fc
      .record({ x: fc.nat(12 - FORMAT_SIZES[format].w), y: fc.nat(12) })
      .map((p) => layoutFor(format, p.x, p.y)),
  );

describe("planLayoutSave", () => {
  test("stacked widgets at (0, 0): the first one changes format and every step is accepted", () => {
    const instances = ["a", "b", "c"].map((id) => inst(id, layoutFor("half", 0, 0)));
    const stored = storedOf(instances);
    const shown = resolveOverlaps(instances);
    const choice = formatChoice(shown, "a", "medium");
    expect(choice?.free).toBe(true);
    const target = new Map(shown).set("a", layoutFor("medium", 0, 0));
    const plan = planLayoutSave(stored, target);
    expect(plan).toEqual([
      { id: "b", layout: layoutFor("half", 0, 6) },
      { id: "c", layout: layoutFor("half", 0, 12) },
      { id: "a", layout: layoutFor("medium", 0, 0) },
    ]);
    expect(apply(stored, plan)).toEqual(target);
  });

  test("swapping two widgets parks one of them on a free place first", () => {
    const stored = new Map([
      ["a", layoutFor("small", 0, 0)],
      ["b", layoutFor("small", 3, 0)],
    ]);
    const target = new Map([
      ["a", layoutFor("small", 3, 0)],
      ["b", layoutFor("small", 0, 0)],
    ]);
    const plan = planLayoutSave(stored, target);
    expect(plan).toEqual([
      { id: "b", layout: layoutFor("small", 6, 0) },
      { id: "a", layout: layoutFor("small", 3, 0) },
      { id: "b", layout: layoutFor("small", 0, 0) },
    ]);
    expect(apply(stored, plan)).toEqual(target);
  });

  test("nothing to save gives an empty plan", () => {
    const stored = new Map([
      ["a", layoutFor("small", 0, 0)],
      ["b", { x: 3, y: 0, w: 5, h: 5 }],
    ]);
    expect(planLayoutSave(stored, new Map(stored))).toEqual([]);
  });

  test("a displaced legacy size takes the nearest format, kept inside the columns", () => {
    const instances = [inst("a", layoutFor("small", 7, 0)), inst("b", { x: 7, y: 0, w: 5, h: 5 })];
    const stored = storedOf(instances);
    const shown = resolveOverlaps(instances);
    expect(shown.get("b")).toEqual({ x: 7, y: 3, w: 5, h: 5 });
    const plan = planLayoutSave(stored, shown);
    expect(plan).toEqual([{ id: "b", layout: layoutFor("medium", 6, 3) }]);
    expect(apply(stored, plan).get("a")).toEqual(layoutFor("small", 7, 0));
  });

  test("an untouched legacy size keeps its layout", () => {
    const stored = new Map([
      ["a", { x: 0, y: 0, w: 5, h: 5 }],
      ["b", layoutFor("small", 6, 0)],
    ]);
    const target = new Map(stored).set("b", layoutFor("small", 9, 0));
    expect(planLayoutSave(stored, target)).toEqual([{ id: "b", layout: layoutFor("small", 9, 0) }]);
  });

  test("property: every step is accepted by the core rules and the end state is the draft", () => {
    const anyLayout = fc
      .record({ w: fc.integer({ min: 1, max: 12 }), h: fc.integer({ min: 1, max: 9 }), y: fc.nat(20) })
      .chain((s) => fc.nat(12 - s.w).map((x) => ({ ...s, x })));
    const arb = fc.array(fc.record({ stored: anyLayout, wish }), { minLength: 1, maxLength: 8 });
    fc.assert(
      fc.property(arb, (specs) => {
        const { stored, target } = scenario(specs);
        const plan = planLayoutSave(stored, target);
        const end = apply(stored, plan);
        expect(end).toEqual(target);
        const changed = [...target].filter(([id, l]) => !sameLayout(l, stored.get(id) ?? l)).length;
        expect(plan.length).toBeLessThanOrEqual(2 * changed);
      }),
      { numRuns: 500 },
    );
  });
});

describe("planLayoutSave against the core", () => {
  test("property: every step is accepted by setInstanceLayout itself and the page ends on the draft", () => {
    const arb = fc.record({
      placed: fc.array(formatLayout, { minLength: 0, maxLength: 5 }),
      stacked: fc.nat(3),
      wishes: fc.array(wish, { minLength: 8, maxLength: 8 }),
    });
    fc.assert(
      fc.property(arb, ({ placed, stacked, wishes }) => {
        const mock = createMockSdk(burndownManifest, {
          seed(run) {
            const page = run({ method: "addPage", title: "Tableau", kind: "dashboard" }) as { id: string };
            const taken: Layout[] = [];
            for (const layout of placed) {
              if (taken.some((t) => overlaps(t, layout))) continue;
              taken.push(layout);
              run({ method: "addInstance", pageId: page.id, component: "kanban@1.0.0", layout });
            }
            for (let i = 0; i < stacked; i++) {
              run({ method: "addInstance", pageId: page.id, component: "kanban@1.0.0" });
            }
          },
        });
        const instances = mock.snapshot().instances;
        fc.pre(instances.length > 0);
        const stored = storedOf(instances);
        const target = targetOf(
          stored,
          wishes.slice(0, instances.length),
          instances.map((i) => i.id),
        );
        for (const step of planLayoutSave(stored, target)) {
          mock.run({ method: "setInstanceLayout", instanceId: step.id, layout: step.layout });
        }
        expect(storedOf(mock.snapshot().instances)).toEqual(target);
      }),
      { numRuns: 300 },
    );
  });
});
