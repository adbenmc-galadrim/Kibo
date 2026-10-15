import { expect, test } from "bun:test";
import type { Steps } from "@kibo/core";
import { cooperate, pacer } from "./cooperate";

function* busy(steps: number, msPerStep: number): Steps<number> {
  for (let i = 0; i < steps; i++) {
    const until = performance.now() + msPerStep;
    while (performance.now() < until) {}
    yield;
  }
  return steps;
}

test("gives the event loop a turn once a slice is spent", async () => {
  let ticks = 0;
  const timer = setInterval(() => {
    ticks += 1;
  }, 1);
  const value = await cooperate(busy(40, 5), 10);
  clearInterval(timer);
  expect(value).toBe(40);
  expect(ticks).toBeGreaterThanOrEqual(10);
});

test("returns the value of steps that never pause", async () => {
  expect(await cooperate(busy(0, 0))).toBe(0);
});

test("a pacer lets timers run between slices of synchronous work", async () => {
  let ticks = 0;
  const timer = setInterval(() => {
    ticks += 1;
  }, 1);
  const pace = pacer(10);
  for (let i = 0; i < 40; i++) {
    const until = performance.now() + 5;
    while (performance.now() < until) {}
    await pace();
  }
  clearInterval(timer);
  expect(ticks).toBeGreaterThanOrEqual(10);
});
