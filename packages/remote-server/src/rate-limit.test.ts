import { describe, expect, test } from "bun:test";
import { openDb } from "./db";
import { createRateLimit } from "./rate-limit";

const limits = { maxFailures: 3, windowMs: 1_000, blockMs: 5_000 };

describe("rate limit", () => {
  test("blocks after maxFailures within the window, then lets through after blockMs", () => {
    let now = 0;
    const limit = createRateLimit(openDb(":memory:"), "scope", limits, () => now);
    expect(limit.fail()).toBe(false);
    expect(limit.fail()).toBe(false);
    expect(limit.blocked()).toBe(false);
    expect(limit.fail()).toBe(true);
    expect(limit.blocked()).toBe(true);
    now += 4_999;
    expect(limit.blocked()).toBe(true);
    now += 1;
    expect(limit.blocked()).toBe(false);
    expect(limit.fail()).toBe(false);
  });

  test("failures older than the window are forgotten", () => {
    let now = 0;
    const limit = createRateLimit(openDb(":memory:"), "scope", limits, () => now);
    limit.fail();
    limit.fail();
    now += 1_000;
    expect(limit.fail()).toBe(false);
    expect(limit.fail()).toBe(false);
    expect(limit.blocked()).toBe(false);
  });

  test("a success resets the count", () => {
    const limit = createRateLimit(openDb(":memory:"), "scope", limits, () => 0);
    limit.fail();
    limit.fail();
    limit.succeed();
    expect(limit.fail()).toBe(false);
  });

  test("the state survives a restart and scopes are separate", () => {
    const db = openDb(":memory:");
    const first = createRateLimit(db, "a", limits, () => 0);
    for (let i = 0; i < 3; i++) first.fail();
    expect(createRateLimit(db, "a", limits, () => 10).blocked()).toBe(true);
    expect(createRateLimit(db, "b", limits, () => 10).blocked()).toBe(false);
  });
});
