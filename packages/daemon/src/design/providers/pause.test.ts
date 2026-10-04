import { expect, test } from "bun:test";
import { createRatePause } from "./pause";

test("a pause lasts retry-after seconds, at least one minute, and never shortens", () => {
  const clock = { now: 1_000 };
  const pause = createRatePause(() => clock.now);
  expect(pause.active()).toBe(false);
  expect(pause.until()).toBeNull();
  pause.set(30);
  expect(pause.until()).toBe(61_000);
  expect(pause.active()).toBe(true);
  pause.set(120);
  expect(pause.until()).toBe(121_000);
  pause.set(10);
  expect(pause.until()).toBe(121_000);
  clock.now = 121_000;
  expect(pause.active()).toBe(false);
  pause.set(null);
  expect(pause.until()).toBe(181_000);
});
