import { expect, test } from "bun:test";
import fc from "fast-check";
import {
  clampPan,
  clampScale,
  doubleClick,
  FITTED,
  fittedSize,
  isPannable,
  keyAction,
  MAX_SCALE,
  MIN_SCALE,
  percent,
  wheelAction,
  zoomAt,
} from "./zoom";

const point = fc.record({ x: fc.integer({ min: -600, max: 600 }), y: fc.integer({ min: -600, max: 600 }) });
const state = fc.record({ scale: fc.double({ min: MIN_SCALE, max: MAX_SCALE, noNaN: true }), pan: point });
const size = fc.record({
  width: fc.integer({ min: 0, max: 4000 }),
  height: fc.integer({ min: 0, max: 4000 }),
});
const close = (a: number, b: number) => Math.abs(a - b) < 1e-6;

test("the image point under the pointer stays put when zooming", () => {
  fc.assert(
    fc.property(state, point, fc.double({ min: 0.5, max: 2, noNaN: true }), (s, focus, factor) => {
      const next = zoomAt(s, factor, focus);
      const before = { x: (focus.x - s.pan.x) / s.scale, y: (focus.y - s.pan.y) / s.scale };
      const after = { x: (focus.x - next.pan.x) / next.scale, y: (focus.y - next.pan.y) / next.scale };
      return (
        close(before.x, after.x) &&
        close(before.y, after.y) &&
        next.scale >= MIN_SCALE &&
        next.scale <= MAX_SCALE
      );
    }),
  );
});

test("the image always keeps 32 px inside the box, never NaN", () => {
  fc.assert(
    fc.property(state, size, size, (s, fitted, box) => {
      const next = clampPan(s, fitted, box);
      const half = { x: (fitted.width * s.scale) / 2, y: (fitted.height * s.scale) / 2 };
      const limit = {
        x: Math.max(0, box.width / 2 + half.x - 32),
        y: Math.max(0, box.height / 2 + half.y - 32),
      };
      return (
        Number.isFinite(next.pan.x) &&
        Number.isFinite(next.pan.y) &&
        Math.abs(next.pan.x) <= limit.x + 1e-9 &&
        Math.abs(next.pan.y) <= limit.y + 1e-9
      );
    }),
  );
  expect(clampScale(100)).toBe(MAX_SCALE);
  expect(clampScale(0)).toBe(MIN_SCALE);
  expect(clampScale(1.5625)).toBe(1.563);
});

test("fitted size follows the fit mode and tolerates zero sizes", () => {
  expect(fittedSize({ width: 1440, height: 900 }, { width: 720, height: 720 }, "contain")).toEqual({
    width: 720,
    height: 450,
  });
  expect(fittedSize({ width: 1440, height: 900 }, { width: 360, height: 720 }, "width")).toEqual({
    width: 360,
    height: 225,
  });
  expect(fittedSize({ width: 0, height: 900 }, { width: 360, height: 720 }, "contain")).toEqual({
    width: 0,
    height: 0,
  });
  expect(fittedSize({ width: 100, height: 100 }, { width: 0, height: 0 }, "width")).toEqual({
    width: 0,
    height: 0,
  });
  expect(isPannable(FITTED, { width: 100, height: 50 }, { width: 200, height: 200 })).toBe(false);
  expect(isPannable(FITTED, { width: 100, height: 300 }, { width: 200, height: 200 })).toBe(true);
  expect(
    isPannable({ scale: 1.25, pan: { x: 0, y: 0 } }, { width: 100, height: 50 }, { width: 200, height: 200 }),
  ).toBe(true);
});

test("wheel, keys, double click and the percent label", () => {
  expect(wheelAction({ deltaX: 0, deltaY: -100, ctrlKey: true, metaKey: false }, false).kind).toBe("zoom");
  expect(wheelAction({ deltaX: 0, deltaY: 10, ctrlKey: false, metaKey: false }, false)).toEqual({
    kind: "none",
  });
  expect(wheelAction({ deltaX: 5, deltaY: 10, ctrlKey: false, metaKey: false }, true)).toEqual({
    kind: "pan",
    dx: -5,
    dy: -10,
  });
  expect(keyAction({ key: "+", shiftKey: false })).toEqual({ kind: "zoom", factor: 1.25 });
  expect(keyAction({ key: "=", shiftKey: false })).toEqual({ kind: "zoom", factor: 1.25 });
  expect(keyAction({ key: "-", shiftKey: false })).toEqual({ kind: "zoom", factor: 0.8 });
  expect(keyAction({ key: "0", shiftKey: false })).toEqual({ kind: "fit" });
  expect(keyAction({ key: "ArrowLeft", shiftKey: false })).toBeNull();
  expect(keyAction({ key: "ArrowLeft", shiftKey: true })).toEqual({ kind: "pan", dx: 40, dy: 0 });
  expect(keyAction({ key: "ArrowDown", shiftKey: true })).toEqual({ kind: "pan", dx: 0, dy: -40 });
  expect(doubleClick(FITTED, { x: 10, y: 10 }).scale).toBe(2);
  expect(doubleClick({ scale: 1.25, pan: { x: 3, y: 3 } }, { x: 0, y: 0 })).toEqual(FITTED);
  expect(percent(1)).toBe("100 %");
  expect(percent(1.563)).toBe("156 %");
});
