import { expect, test } from "bun:test";
import { raise, stepToward } from "./smooth-progress";

const FRAME_MS = 16;

function play(targets: { at: number; ratio: number }[], untilMs: number): number[] {
  const shown: number[] = [];
  let value = 0;
  let target = 0;
  for (let now = 0; now <= untilMs; now += FRAME_MS) {
    for (const t of targets) if (t.at <= now) target = t.ratio;
    value = stepToward(value, target, FRAME_MS);
    shown.push(value);
  }
  return shown;
}

const isMonotone = (values: number[]) => values.every((v, i) => i === 0 || v >= (values[i - 1] ?? 0));

test("stepToward moves part of the way, never past the target", () => {
  const next = stepToward(0, 0.5, FRAME_MS);
  expect(next).toBeGreaterThan(0);
  expect(next).toBeLessThan(0.5);
  expect(stepToward(0.49, 0.5, 10_000)).toBe(0.5);
});

test("stepToward never goes back when the target is lower", () => {
  expect(stepToward(0.6, 0.2, FRAME_MS)).toBe(0.6);
  expect(stepToward(0.6, 0.6, FRAME_MS)).toBe(0.6);
});

test("chunks confirmed in bursts are shown as a monotone, gradual rise that reaches 1", () => {
  const targets = [0.125, 0.25, 0.375, 0.5, 0.625, 0.75, 0.875, 1].map((ratio, i) => ({
    at: 25 * (i + 1),
    ratio,
  }));
  const shown = play(targets, 1500);
  expect(isMonotone(shown)).toBe(true);
  expect(shown.at(-1)).toBe(1);
  const steps = shown.map((v, i) => v - (shown[i - 1] ?? 0));
  expect(Math.max(...steps)).toBeLessThan(0.2);
});

test("a slow upload with one big chunk eases in without a jump", () => {
  const shown = play([{ at: 500, ratio: 0.5 }], 2000);
  expect(isMonotone(shown)).toBe(true);
  expect(shown.at(-1)).toBe(0.5);
  const steps = shown.map((v, i) => v - (shown[i - 1] ?? 0));
  expect(Math.max(...steps)).toBeLessThan(0.1);
});

test("raise keeps a ratio monotone and inside 0..1", () => {
  expect(raise(0.4, 0.2)).toBe(0.4);
  expect(raise(0.4, 0.7)).toBe(0.7);
  expect(raise(0.4, 1.5)).toBe(1);
  expect(raise(0.4, Number.NaN)).toBe(0.4);
});
