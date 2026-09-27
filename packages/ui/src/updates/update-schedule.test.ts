import { describe, expect, test } from "bun:test";
import { CHECK_EVERY_MS, FIRST_CHECK_DELAY_MS, scheduleUpdateChecks, type Timers } from "./update-schedule";

function fakeTimers() {
  const timeouts = new Map<number, { fn: () => void; ms: number }>();
  const intervals = new Map<number, { fn: () => void; ms: number }>();
  let next = 1;
  const timers: Timers<number> = {
    setTimeout: (fn, ms) => {
      timeouts.set(next, { fn, ms });
      return next++;
    },
    clearTimeout: (id) => timeouts.delete(id),
    setInterval: (fn, ms) => {
      intervals.set(next, { fn, ms });
      return next++;
    },
    clearInterval: (id) => intervals.delete(id),
  };
  return { timers, timeouts, intervals };
}

describe("update schedule", () => {
  test("checks once after the start delay, then periodically", () => {
    const { timers, timeouts, intervals } = fakeTimers();
    let checks = 0;
    scheduleUpdateChecks(() => checks++, timers);
    expect(checks).toBe(0);
    expect([...timeouts.values()].map((t) => t.ms)).toEqual([FIRST_CHECK_DELAY_MS]);
    expect(intervals.size).toBe(0);
    for (const t of timeouts.values()) t.fn();
    expect(checks).toBe(1);
    expect([...intervals.values()].map((t) => t.ms)).toEqual([CHECK_EVERY_MS]);
    for (const t of intervals.values()) t.fn();
    expect(checks).toBe(2);
  });

  test("stopping cancels the pending delay or the period", () => {
    const { timers, timeouts, intervals } = fakeTimers();
    const stopEarly = scheduleUpdateChecks(() => {}, timers);
    stopEarly();
    expect(timeouts.size).toBe(0);
    const stopLater = scheduleUpdateChecks(() => {}, timers);
    for (const t of timeouts.values()) t.fn();
    expect(intervals.size).toBe(1);
    stopLater();
    expect(intervals.size).toBe(0);
  });

  test("the delays are ten seconds and six hours", () => {
    expect(FIRST_CHECK_DELAY_MS).toBe(10_000);
    expect(CHECK_EVERY_MS).toBe(6 * 60 * 60 * 1000);
  });
});
