import { expect, test } from "bun:test";
import { isBackupDue, type ScheduleTimers, startBackupSchedule } from "./schedule";

const HOUR = 3_600_000;
const now = Date.UTC(2026, 9, 4, 12);

test("a backup is due without a previous one, or when the last is at least a day old", () => {
  expect(isBackupDue(null, now)).toBe(true);
  expect(isBackupDue(now - 23 * HOUR, now)).toBe(false);
  expect(isBackupDue(now - 24 * HOUR, now)).toBe(true);
  expect(isBackupDue(now - 25 * HOUR, now)).toBe(true);
  expect(isBackupDue(now - 2 * HOUR, now, HOUR)).toBe(true);
});

function fakeTimers() {
  const handlers: (() => void)[] = [];
  let cleared = 0;
  const timers: ScheduleTimers = {
    every(fn, ms) {
      expect(ms).toBe(HOUR);
      handlers.push(fn);
      return () => {
        cleared += 1;
        handlers.splice(0);
      };
    },
  };
  return {
    timers,
    fire: () => {
      for (const h of handlers) h();
    },
    cleared: () => cleared,
  };
}

test("the schedule ticks at once, then at every interval, until stopped", async () => {
  const fake = fakeTimers();
  let ticks = 0;
  const stop = startBackupSchedule(
    {
      tick: async () => {
        ticks += 1;
      },
    },
    { intervalMs: HOUR, log: () => {}, timers: fake.timers },
  );
  expect(ticks).toBe(1);
  await Bun.sleep(0);
  fake.fire();
  await Bun.sleep(0);
  fake.fire();
  expect(ticks).toBe(3);
  await stop();
  expect(fake.cleared()).toBe(1);
  fake.fire();
  expect(ticks).toBe(3);
});

test("a failing tick is logged and never thrown", async () => {
  const fake = fakeTimers();
  const logged: unknown[] = [];
  const stop = startBackupSchedule(
    { tick: () => Promise.reject(new Error("disk full")) },
    { intervalMs: HOUR, log: (message, error) => logged.push(message, error), timers: fake.timers },
  );
  await stop();
  expect(logged[0]).toBe("backups: scheduled backup failed");
  expect(String(logged[1])).toContain("disk full");
});

test("an interval that fires during a backup does not start a second one", async () => {
  const fake = fakeTimers();
  let ticks = 0;
  let release = () => {};
  const stop = startBackupSchedule(
    {
      tick: () => {
        ticks += 1;
        return new Promise<void>((resolve) => {
          release = resolve;
        });
      },
    },
    { intervalMs: HOUR, log: () => {}, timers: fake.timers },
  );
  fake.fire();
  expect(ticks).toBe(1);
  release();
  await stop();
});

test("stop waits for the backup in progress", async () => {
  const fake = fakeTimers();
  let release = () => {};
  let finished = false;
  const stop = startBackupSchedule(
    {
      tick: () =>
        new Promise<void>((resolve) => {
          release = () => {
            finished = true;
            resolve();
          };
        }),
    },
    { intervalMs: HOUR, log: () => {}, timers: fake.timers },
  );
  const stopped = stop();
  release();
  await stopped;
  expect(finished).toBe(true);
});
