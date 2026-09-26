import { expect, test } from "bun:test";
import { createRateLimitGate } from "./rate-limit";

test("pauses under the floor until reset, and on retry-after", () => {
  let now = 1_000_000;
  const gate = createRateLimitGate(() => now);
  gate.observe(new Headers({ "x-ratelimit-remaining": "500", "x-ratelimit-reset": "2000" }));
  expect(gate.blockedUntil()).toBeNull();
  gate.observe(new Headers({ "x-ratelimit-remaining": "99", "x-ratelimit-reset": "2000" }));
  expect(gate.blockedUntil()).toBe(2_000_000);
  now = 2_000_001;
  expect(gate.blockedUntil()).toBeNull();
  gate.observe(new Headers({ "retry-after": "60" }));
  expect(gate.blockedUntil()).toBe(2_060_001);
});
