import { afterEach, beforeEach, expect, test } from "bun:test";
import { createClock, localDate, parseFixedNow } from "./clock";

let zone: string | undefined;
beforeEach(() => {
  zone = process.env.TZ;
  process.env.TZ = "Europe/Paris";
});
afterEach(() => {
  if (zone === undefined) delete process.env.TZ;
  else process.env.TZ = zone;
});

test("a fixed clock never moves and gives the local day", () => {
  const clock = createClock("2026-10-16T14:52:00+02:00", () => 0);
  expect(clock.now()).toBe(Date.parse("2026-10-16T12:52:00Z"));
  expect(clock.now()).toBe(clock.now());
  expect(clock.today()).toBe("2026-10-16");
  expect(clock.fixedNow).toBe("2026-10-16T14:52:00+02:00");
});

test("a free clock follows the system time", () => {
  let now = Date.parse("2026-10-16T21:59:00Z");
  const clock = createClock(null, () => now);
  expect(clock.today()).toBe("2026-10-16");
  now = Date.parse("2026-10-16T22:01:00Z");
  expect(clock.today()).toBe("2026-10-17");
  expect(clock.fixedNow).toBeNull();
});

test("the local day is padded", () => {
  expect(localDate(Date.parse("2026-01-05T10:00:00Z"))).toBe("2026-01-05");
});

test("an invalid fixed instant is refused, an absent one leaves the clock free", () => {
  expect(parseFixedNow(undefined)).toBeNull();
  expect(parseFixedNow("")).toBeNull();
  expect(parseFixedNow("2026-10-16T14:52:00+02:00")).toBe("2026-10-16T14:52:00+02:00");
  expect(() => parseFixedNow("demain")).toThrow("INVALID_INPUT");
  expect(() => parseFixedNow("2026-10-16")).toThrow("INVALID_INPUT");
});

test("a fixed clock keeps its day but its ticks stay ordered, for the journal", () => {
  let system = 1_000;
  const clock = createClock("2026-10-16T14:52:00+02:00", () => system);
  const first = clock.ticking();
  system += 5;
  expect(clock.ticking()).toBe(first + 5);
  expect(first).toBe(Date.parse("2026-10-16T14:52:00+02:00"));
  expect(clock.now()).toBe(first);
});
