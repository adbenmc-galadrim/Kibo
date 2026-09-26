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

test("mcp calls are limited to 30 per minute and per instance by default (N47)", () => {
  let now = 0;
  const q = createQuotas({ now: () => now });
  const taken = Array.from({ length: 31 }, () => q.take("a", "mcp"));
  expect(taken.filter(Boolean)).toHaveLength(30);
  expect(taken.at(-1)).toBe(false);
  expect(q.take("b", "mcp")).toBe(true);
  expect(q.take("a", "call")).toBe(true);
  now = 60_001;
  expect(q.take("a", "mcp")).toBe(true);
  const tight = createQuotas({ now: () => 0, mcpPerMinute: 1 });
  expect([tight.take("a", "mcp"), tight.take("a", "mcp")]).toEqual([true, false]);
});
