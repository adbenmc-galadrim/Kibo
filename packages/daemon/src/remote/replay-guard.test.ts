import { expect, test } from "bun:test";
import { createReplayGuard } from "./replay-guard";

const T0 = 1_760_000_000_000;
const MINUTE = 60_000;

test("a replayed request is executed once", () => {
  const guard = createReplayGuard();
  expect(guard.seen("r1", T0)).toBe(false);
  expect(guard.seen("r1", T0 + 1)).toBe(true);
  expect(guard.seen("r2", T0 + 2)).toBe(false);
});

test("ids older than the window are forgotten", () => {
  const guard = createReplayGuard(10 * MINUTE);
  guard.seen("r1", T0);
  guard.seen("r2", T0 + 11 * MINUTE);
  expect(guard.size()).toBe(1);
  expect(guard.seen("r2", T0 + 12 * MINUTE)).toBe(true);
});

test("the guard keeps at most 1000 ids", () => {
  const guard = createReplayGuard();
  for (let i = 0; i < 1_200; i++) guard.seen(`r${i}`, T0 + i);
  expect(guard.size()).toBe(1_000);
  expect(guard.seen("r1199", T0 + 1_200)).toBe(true);
});
