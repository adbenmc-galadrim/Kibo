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

test("a secondary limit pause is not lifted by a later ordinary response", () => {
  const now = 1_000_000;
  const gate = createRateLimitGate(() => now);
  gate.observe(new Headers({ "retry-after": "60" }));
  gate.observe(new Headers({ "x-ratelimit-remaining": "4000", "x-ratelimit-reset": "2000" }));
  expect(gate.blockedUntil()).toBe(1_060_000);
  gate.observe(new Headers({ "x-ratelimit-remaining": "50", "x-ratelimit-reset": "1030" }));
  expect(gate.blockedUntil()).toBe(1_060_000);
  gate.observe(new Headers({ "x-ratelimit-remaining": "50", "x-ratelimit-reset": "1100" }));
  expect(gate.blockedUntil()).toBe(1_100_000);
});

test("a non core resource never pauses", () => {
  const gate = createRateLimitGate(() => 1_000_000);
  gate.observe(
    new Headers({
      "x-ratelimit-resource": "search",
      "x-ratelimit-remaining": "3",
      "x-ratelimit-reset": "2000",
    }),
  );
  gate.observe(new Headers({ "x-ratelimit-resource": "code_search", "retry-after": "60" }));
  expect(gate.blockedUntil()).toBeNull();
  gate.observe(
    new Headers({
      "x-ratelimit-resource": "graphql",
      "x-ratelimit-remaining": "3",
      "x-ratelimit-reset": "2000",
    }),
  );
  expect(gate.blockedUntil()).toBe(2_000_000);
});
