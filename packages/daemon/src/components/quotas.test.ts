import { expect, test } from "bun:test";
import { createQuotas } from "./quotas";

test("calls and fetches are limited per instance on sliding windows", () => {
  let now = 0;
  const q = createQuotas({ now: () => now, callsPerSecond: 3, fetchPerMinute: 2 });
  expect([q.take("a", "call"), q.take("a", "call"), q.take("a", "call"), q.take("a", "call")]).toEqual([
    true,
    true,
    true,
    false,
  ]);
  expect(q.take("b", "call")).toBe(true);
  now = 1001;
  expect(q.take("a", "call")).toBe(true);
  expect([q.take("a", "fetch"), q.take("a", "fetch"), q.take("a", "fetch")]).toEqual([true, true, false]);
  now = 61_002;
  expect(q.take("a", "fetch")).toBe(true);
});

test("design frames are limited per instance on a one minute window", () => {
  let now = 0;
  const q = createQuotas({ now: () => now, designPerMinute: 2 });
  expect([q.take("a", "design"), q.take("a", "design"), q.take("a", "design")]).toEqual([true, true, false]);
  expect(q.take("b", "design")).toBe(true);
  now = 60_001;
  expect(q.take("a", "design")).toBe(true);
  const fallback = createQuotas({ now: () => 0 });
  expect(Array.from({ length: 31 }, () => fallback.take("a", "design")).filter(Boolean)).toHaveLength(30);
});
