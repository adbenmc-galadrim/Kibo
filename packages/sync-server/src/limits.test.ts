import { expect, test } from "bun:test";
import { SYNC_LIMITS } from "@kibo/schema";
import { FailureLimiter, RateWindow } from "./limits";

test("five failures in a minute block the key for five minutes", () => {
  let now = 0;
  const limiter = new FailureLimiter({
    max: SYNC_LIMITS.authFailuresPerMinute,
    windowMs: 60_000,
    blockMs: SYNC_LIMITS.authBlockMs,
    now: () => now,
  });
  for (let i = 0; i < 4; i++) limiter.fail("1.2.3.4");
  expect(limiter.blocked("1.2.3.4")).toBe(false);
  limiter.fail("1.2.3.4");
  expect(limiter.blocked("1.2.3.4")).toBe(true);
  expect(limiter.blocked("5.6.7.8")).toBe(false);
  now = SYNC_LIMITS.authBlockMs - 1;
  expect(limiter.blocked("1.2.3.4")).toBe(true);
  now = SYNC_LIMITS.authBlockMs + 1;
  expect(limiter.blocked("1.2.3.4")).toBe(false);
});

test("failures older than the window do not count", () => {
  let now = 0;
  const limiter = new FailureLimiter({ max: 5, windowMs: 60_000, blockMs: 300_000, now: () => now });
  for (let i = 0; i < 4; i++) limiter.fail("ip");
  now = 61_000;
  limiter.fail("ip");
  expect(limiter.blocked("ip")).toBe(false);
});

test("the failure limiter forgets stale keys", () => {
  let now = 0;
  const limiter = new FailureLimiter({ max: 5, windowMs: 60_000, blockMs: 300_000, now: () => now });
  for (let i = 0; i < 100; i++) limiter.fail(`ip-${i}`);
  for (let i = 0; i < 5; i++) limiter.fail("blocked");
  now = 300_001;
  limiter.fail("late");
  expect(limiter.size).toBe(1);
});

test("a rate window allows the limit per window, per key", () => {
  let now = 1000;
  const rate = new RateWindow({ limit: SYNC_LIMITS.updatesPerSecond, windowMs: 1000, now: () => now });
  for (let i = 0; i < 100; i++) expect(rate.take("d1")).toBe(true);
  expect(rate.take("d1")).toBe(false);
  expect(rate.take("d2")).toBe(true);
  now = 2001;
  expect(rate.take("d1")).toBe(true);
});

test("the rate window forgets stale keys", () => {
  let now = 0;
  const rate = new RateWindow({ limit: 10, windowMs: 1000, now: () => now });
  for (let i = 0; i < 100; i++) rate.take(`d${i}`);
  now = 1001;
  rate.take("late");
  expect(rate.size).toBe(1);
});
