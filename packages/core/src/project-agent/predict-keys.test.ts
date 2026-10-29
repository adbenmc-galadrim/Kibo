import { describe, expect, test } from "bun:test";
import type { KeyForecast, ProposedAction } from "@kibo/schema";
import fc from "fast-check";
import { predictKeys } from "./predict-keys";

const why = "";
const FORECAST: KeyForecast = { nextTicketKey: "SILO-12", nextFeatureSeq: 3, usedShortKeys: ["F4"] };
const feature = (id: number): ProposedAction => ({
  id,
  why,
  type: "createTicket",
  ref: `new:${id}`,
  title: `Fonctionnalité ${id}`,
  feature: true,
});
const step = (id: number, parent?: string): ProposedAction => ({
  id,
  why,
  type: "createTicket",
  ref: `new:${id}`,
  title: `Étape ${id}`,
  ...(parent === undefined ? {} : { parent }),
});

describe("predictKeys", () => {
  test("steps follow the next ticket key", () => {
    expect(predictKeys([step(1, "F5"), step(2, "F5")], FORECAST)).toEqual({
      "new:1": "SILO-12",
      "new:2": "SILO-13",
    });
  });

  test("features skip the short keys already taken", () => {
    expect(predictKeys([feature(1), feature(2)], FORECAST)).toEqual({ "new:1": "F3", "new:2": "F5" });
  });

  test("steps do not consume the feature sequence", () => {
    expect(predictKeys([feature(1), step(2, "new:1"), step(3, "new:1"), feature(4)], FORECAST)).toEqual({
      "new:1": "F3",
      "new:2": "SILO-12",
      "new:3": "SILO-13",
      "new:4": "F5",
    });
  });

  test("a plain root created in the plan takes a feature key with its first step", () => {
    expect(predictKeys([step(1), step(2, "new:1"), step(3, "new:1"), feature(4)], FORECAST)).toEqual({
      "new:1": "SILO-12",
      "new:2": "SILO-13",
      "new:3": "SILO-14",
      "new:4": "F5",
    });
  });

  test("keys from the sync server are not predicted", () => {
    expect(predictKeys([step(1, "F5"), feature(2)], { ...FORECAST, nextTicketKey: null })).toEqual({
      "new:1": null,
      "new:2": "F3",
    });
    expect(predictKeys([feature(1)], { ...FORECAST, nextFeatureSeq: null })).toEqual({ "new:1": null });
  });

  test("no feature key is predicted past F999", () => {
    expect(predictKeys([feature(1), feature(2)], { ...FORECAST, nextFeatureSeq: 999 })).toEqual({
      "new:1": "F999",
      "new:2": null,
    });
  });
});

const shapeArb = fc.array(
  fc.record({ kind: fc.constantFrom("feature", "step", "root", "other"), parent: fc.nat() }),
  { maxLength: 30 },
);
const forecastArb = fc.record({
  nextTicketKey: fc.integer({ min: 1, max: 500 }).map((n) => `SILO-${n}`),
  nextFeatureSeq: fc.integer({ min: 1, max: 60 }),
  usedShortKeys: fc.uniqueArray(
    fc.integer({ min: 1, max: 120 }).map((n) => `F${n}`),
    { maxLength: 40 },
  ),
});

function actionsOf(shapes: readonly { kind: string; parent: number }[]): ProposedAction[] {
  const refs: string[] = [];
  return shapes.map(({ kind, parent }, i): ProposedAction => {
    const id = i + 1;
    if (kind === "other") return { id, why, type: "setStatus", ticket: "SILO-1", statusId: "done" };
    const under = refs.length === 0 ? "F1" : (refs[parent % refs.length] ?? "F1");
    refs.push(`new:${id}`);
    if (kind === "feature") return feature(id);
    return kind === "root" ? step(id) : step(id, under);
  });
}

const seqOf = (key: string): number => Number(key.replace(/^\D+-?/, ""));
const increasing = (keys: readonly string[]) =>
  keys.every((k, i) => i === 0 || seqOf(k) > seqOf(keys[i - 1] ?? ""));

describe("predictKeys properties", () => {
  test("keys are distinct, free, increasing and only for created tickets", () => {
    fc.assert(
      fc.property(shapeArb, forecastArb, (shapes, forecast) => {
        const actions = actionsOf(shapes);
        const keys = predictKeys(actions, forecast);
        const created = actions.flatMap((a) => (a.type === "createTicket" ? [a.ref] : []));
        expect(Object.keys(keys)).toEqual(created);
        const values = created.map((ref) => keys[ref] ?? null).filter((k): k is string => k !== null);
        expect(new Set(values).size).toBe(values.length);
        expect(values.filter((k) => forecast.usedShortKeys.includes(k))).toEqual([]);
        expect(increasing(values.filter((k) => k.startsWith("F")))).toBe(true);
        expect(increasing(values.filter((k) => k.startsWith("SILO-")))).toBe(true);
        expect(
          predictKeys(
            actions.filter((a) => a.type === "createTicket"),
            forecast,
          ),
        ).toEqual(keys);
      }),
    );
  });
});
