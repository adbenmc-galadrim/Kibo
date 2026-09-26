import { expect, test } from "bun:test";
import { createLoadGuard } from "./load-guard";

function setup() {
  const timers = new Map<number, () => void>();
  let next = 0;
  const escapes: string[] = [];
  const guard = createLoadGuard({
    readyTimeoutMs: 2000,
    onEscape: (reason) => escapes.push(reason),
    setTimer: (fn, ms) => {
      expect(ms).toBe(2000);
      next += 1;
      timers.set(next, fn);
      return next;
    },
    clearTimer: (id) => {
      timers.delete(id);
    },
  });
  const fire = () => {
    for (const [id, fn] of [...timers]) {
      timers.delete(id);
      fn();
    }
  };
  return { guard, escapes, timers, fire };
}

test("ready before the first load keeps the frame", () => {
  const { guard, escapes, timers } = setup();
  guard.ready();
  guard.load();
  expect(timers.size).toBe(0);
  expect(escapes).toEqual([]);
});

test("ready after the first load, within the deadline, keeps the frame", () => {
  const { guard, escapes, timers, fire } = setup();
  guard.load();
  expect(timers.size).toBe(1);
  guard.ready();
  expect(timers.size).toBe(0);
  fire();
  expect(escapes).toEqual([]);
});

test("a single load without ready is an escape once the deadline passes", () => {
  const { guard, escapes, fire } = setup();
  guard.load();
  expect(escapes).toEqual([]);
  fire();
  expect(escapes).toEqual(["no-ready"]);
  guard.ready();
  guard.load();
  expect(escapes).toEqual(["no-ready"]);
});

test("any load after the first is an escape", () => {
  const { guard, escapes, timers } = setup();
  guard.ready();
  guard.load();
  guard.load();
  expect(escapes).toEqual(["reload"]);
  expect(timers.size).toBe(0);
});

test("a second load while waiting for ready escapes once and clears the timer", () => {
  const { guard, escapes, timers, fire } = setup();
  guard.load();
  guard.load();
  expect(escapes).toEqual(["reload"]);
  expect(timers.size).toBe(0);
  fire();
  expect(escapes).toEqual(["reload"]);
});

test("dispose clears the pending timer", () => {
  const { guard, escapes, timers } = setup();
  guard.load();
  guard.dispose();
  expect(timers.size).toBe(0);
  guard.load();
  expect(escapes).toEqual([]);
});
