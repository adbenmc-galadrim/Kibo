import { expect, test } from "bun:test";
import fc from "fast-check";
import {
  COMPARE_OFF,
  type CompareAction,
  type CompareState,
  clipFor,
  compareReducer,
  defaultReference,
  isImageFrame,
  normalizeCompare,
} from "./compare";

const ctx = { imageIndexes: [1, 3], current: 2 };

test("toggle without an image frame stays closed", () => {
  expect(compareReducer(COMPARE_OFF, { kind: "toggle" }, { imageIndexes: [], current: 0 })).toEqual(
    COMPARE_OFF,
  );
});

test("toggle opens on the default reference, toggle again closes", () => {
  const on = compareReducer(COMPARE_OFF, { kind: "toggle" }, ctx);
  expect(on).toEqual({ ...COMPARE_OFF, on: true, reference: 3 });
  expect(compareReducer(on, { kind: "toggle" }, ctx)).toEqual(COMPARE_OFF);
});

test("the default reference is the first image after the current frame, else the first", () => {
  expect(defaultReference([1, 3], 2)).toBe(3);
  expect(defaultReference([1, 3], 3)).toBe(1);
  expect(defaultReference([0], 0)).toBe(0);
  expect(defaultReference([], 0)).toBeNull();
});

test("a reference outside the image frames is ignored", () => {
  const on = compareReducer(COMPARE_OFF, { kind: "toggle" }, ctx);
  expect(compareReducer(on, { kind: "reference", index: 2 }, ctx).reference).toBe(3);
  expect(compareReducer(on, { kind: "reference", index: 1 }, ctx).reference).toBe(1);
});

test("opacity and wipe are bounded, mode and swap apply", () => {
  const on = compareReducer(COMPARE_OFF, { kind: "toggle" }, ctx);
  expect(compareReducer(on, { kind: "opacity", value: 140 }, ctx).opacity).toBe(100);
  expect(compareReducer(on, { kind: "wipe", value: -3 }, ctx).wipe).toBe(0);
  expect(compareReducer(on, { kind: "wipe", value: Number.NaN }, ctx).wipe).toBe(100);
  expect(compareReducer(on, { kind: "mode", mode: "overlay" }, ctx).mode).toBe("overlay");
  expect(compareReducer(on, { kind: "swap" }, ctx).swapped).toBe(true);
  expect(compareReducer(on, { kind: "reset" }, ctx)).toEqual(COMPARE_OFF);
});

test("clipFor keeps the left band of the mockup", () => {
  expect(clipFor(40)).toBe("inset(0 60% 0 0)");
  expect(clipFor(100)).toBe("inset(0 0% 0 0)");
});

test("isImageFrame tells images from stories", () => {
  expect(isImageFrame({ mime: "image/png" })).toBe(true);
  expect(isImageFrame({ mime: "text/html" })).toBe(false);
});

test("normalizeCompare moves a vanished reference or closes the comparison", () => {
  const on: CompareState = { ...COMPARE_OFF, on: true, reference: 3 };
  expect(normalizeCompare(on, { imageIndexes: [1], current: 2 }).reference).toBe(1);
  expect(normalizeCompare(on, { imageIndexes: [], current: 2 })).toEqual(COMPARE_OFF);
  expect(normalizeCompare(on, ctx)).toBe(on);
});

const action: fc.Arbitrary<CompareAction> = fc.oneof(
  fc.constant<CompareAction>({ kind: "toggle" }),
  fc.constant<CompareAction>({ kind: "swap" }),
  fc.constant<CompareAction>({ kind: "reset" }),
  fc.constantFrom<CompareAction>({ kind: "mode", mode: "side" }, { kind: "mode", mode: "overlay" }),
  fc.integer({ min: -3, max: 25 }).map<CompareAction>((index) => ({ kind: "reference", index })),
  fc.double().map<CompareAction>((value) => ({ kind: "opacity", value })),
  fc.double().map<CompareAction>((value) => ({ kind: "wipe", value })),
);
const context = fc
  .uniqueArray(fc.integer({ min: 0, max: 19 }), { maxLength: 6 })
  .chain((imageIndexes) => fc.integer({ min: 0, max: 19 }).map((current) => ({ imageIndexes, current })));

test("any sequence of actions keeps the state within its bounds", () => {
  fc.assert(
    fc.property(context, fc.array(action, { maxLength: 30 }), (c, actions) => {
      const end = actions.reduce((s, a) => compareReducer(s, a, c), COMPARE_OFF);
      expect(end.opacity).toBeGreaterThanOrEqual(0);
      expect(end.opacity).toBeLessThanOrEqual(100);
      expect(end.wipe).toBeGreaterThanOrEqual(0);
      expect(end.wipe).toBeLessThanOrEqual(100);
      expect(end.reference === null || c.imageIndexes.includes(end.reference)).toBe(true);
      expect(end.on).toBe(end.reference !== null);
    }),
  );
});

test("reset is idempotent", () => {
  fc.assert(
    fc.property(context, fc.array(action, { maxLength: 10 }), (c, actions) => {
      const s = actions.reduce((acc, a) => compareReducer(acc, a, c), COMPARE_OFF);
      const once = compareReducer(s, { kind: "reset" }, c);
      expect(compareReducer(once, { kind: "reset" }, c)).toEqual(once);
      expect(once).toEqual(COMPARE_OFF);
    }),
  );
});
