import { describe, expect, test } from "bun:test";
import { SIGNAL_WAKE_WINDOW_MS } from "@kibo/schema";
import fc from "fast-check";
import { planWakeup } from "./wakeup";

const MIN = 60_000;

describe("planWakeup", () => {
  test("wakes now when nothing was ever sent", () => {
    expect(planWakeup({ lastAt: null, dueAt: null, now: 1_000 })).toEqual({ kind: "now" });
  });

  test("wakes now once the window has elapsed", () => {
    const now = 100 * MIN;
    expect(planWakeup({ lastAt: now - 10 * MIN, dueAt: null, now })).toEqual({ kind: "now" });
  });

  test("schedules at the end of a running window", () => {
    const lastAt = 100 * MIN;
    expect(planWakeup({ lastAt, dueAt: null, now: lastAt + 9 * MIN })).toEqual({
      kind: "scheduled",
      at: lastAt + SIGNAL_WAKE_WINDOW_MS,
    });
  });

  test("joins an existing deadline", () => {
    expect(planWakeup({ lastAt: 0, dueAt: 5 * MIN, now: 3 * MIN })).toEqual({ kind: "already", at: 5 * MIN });
    expect(planWakeup({ lastAt: null, dueAt: 5 * MIN, now: 9 * MIN })).toEqual({
      kind: "already",
      at: 5 * MIN,
    });
  });

  test("honours a custom window", () => {
    expect(planWakeup({ lastAt: 0, dueAt: null, now: 30_000, window: 60_000 })).toEqual({
      kind: "scheduled",
      at: 60_000,
    });
    expect(planWakeup({ lastAt: 0, dueAt: null, now: 60_000, window: 60_000 })).toEqual({ kind: "now" });
  });

  test("two wakeups of a project are always a window apart", () => {
    const window = SIGNAL_WAKE_WINDOW_MS;
    fc.assert(
      fc.property(fc.array(fc.nat({ max: 3 * window }), { minLength: 1, maxLength: 200 }), (gaps) => {
        let lastAt: number | null = null;
        let dueAt: number | null = null;
        let now = 0;
        const fired: number[] = [];
        for (const gap of gaps) {
          now += gap;
          if (dueAt !== null && dueAt <= now) {
            fired.push(dueAt);
            lastAt = dueAt;
            dueAt = null;
          }
          const plan = planWakeup({ lastAt, dueAt, now, window });
          if (plan.kind === "now") {
            fired.push(now);
            lastAt = now;
          } else if (plan.kind === "scheduled") {
            dueAt = plan.at;
          }
        }
        return fired.every((at, i) => i === 0 || at - (fired[i - 1] ?? 0) >= window);
      }),
    );
  });
});
