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
