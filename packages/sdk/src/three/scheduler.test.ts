import { expect, test } from "bun:test";
import { clampDt, loopState } from "./scheduler";

const base = { animate: true, visible: true, documentVisible: true, reducedMotion: false };

test("the loop runs only when animated, visible and allowed to move", () => {
  expect(loopState(base)).toBe("running");
  expect(loopState({ ...base, animate: false })).toBe("paused");
  expect(loopState({ ...base, visible: false })).toBe("paused");
  expect(loopState({ ...base, documentVisible: false })).toBe("paused");
  expect(loopState({ ...base, reducedMotion: true })).toBe("paused");
});

test("dt is in seconds, capped at 100 ms, and zero on the first frame", () => {
  expect(clampDt(null, 1000)).toBe(0);
  expect(clampDt(1000, 1016)).toBeCloseTo(0.016);
  expect(clampDt(1000, 5000)).toBe(0.1);
  expect(clampDt(1000, 900)).toBe(0);
});
