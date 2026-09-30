import { afterEach, beforeEach, expect, test } from "bun:test";
import { agentsFixture, NOW, runFixture } from "../agents/fixtures";
import { markSeen, readSeenAt, runHistory, runMoment, unseenCount } from "./run-history";

const MIN = 60_000;
beforeEach(() => localStorage.clear());
afterEach(() => localStorage.clear());

test("history keeps finished and waiting runs, newest first, twenty at most", () => {
  const done = runFixture({ id: "r2", state: "done", stateSince: NOW - 50 * MIN, endedAt: NOW - 41 * MIN });
  const waiting = runFixture({ id: "r3", state: "waiting_input", stateSince: NOW - 3 * MIN, endedAt: null });
  const state = agentsFixture();
  state.runs = [
    runFixture({ id: "r1", state: "running", stateSince: NOW - MIN }),
    done,
    waiting,
    runFixture({ id: "r4", state: "failed", stateSince: NOW - 3 * 60 * MIN, endedAt: NOW - 2 * 60 * MIN }),
    runFixture({ id: "r5", state: "cancelled", stateSince: NOW - 10 * MIN, endedAt: NOW - 10 * MIN }),
    runFixture({ id: "r6", state: "queued", stateSince: NOW }),
    ...Array.from({ length: 25 }, (_, i) =>
      runFixture({ id: `old${i}`, state: "done", stateSince: 0, endedAt: NOW - (60 + i) * 60 * MIN }),
    ),
  ];
  expect(runMoment(done)).toBe(NOW - 41 * MIN);
  expect(runMoment(waiting)).toBe(NOW - 3 * MIN);
  const history = runHistory(state);
  expect(history).toHaveLength(20);
  expect(history.slice(0, 5).map((r) => r.id)).toEqual(["r3", "r5", "r2", "r4", "old0"]);
  expect(runHistory(state, 2).map((r) => r.id)).toEqual(["r3", "r5"]);
});

test("unseen counts waiting, done and failed runs after the seen mark, never cancelled ones", () => {
  const runs = [
    runFixture({ id: "a", state: "waiting_input", stateSince: NOW - MIN, endedAt: null }),
    runFixture({ id: "b", state: "done", stateSince: 0, endedAt: NOW - 2 * MIN }),
    runFixture({ id: "c", state: "cancelled", stateSince: 0, endedAt: NOW - MIN }),
    runFixture({ id: "d", state: "failed", stateSince: 0, endedAt: NOW - 30 * MIN }),
  ];
  expect(unseenCount(runs, 0)).toBe(3);
  expect(unseenCount(runs, NOW - 10 * MIN)).toBe(2);
  expect(unseenCount(runs, NOW)).toBe(0);
});

test("the seen mark lives in localStorage and defaults to zero, even without storage", () => {
  expect(readSeenAt()).toBe(0);
  markSeen(NOW);
  expect(readSeenAt()).toBe(NOW);
  expect(localStorage.getItem("kibo.runs.seenAt")).toBe(String(NOW));
  localStorage.setItem("kibo.runs.seenAt", "garbage");
  expect(readSeenAt()).toBe(0);
  const storage = Object.getOwnPropertyDescriptor(window, "localStorage");
  const errors: unknown[] = [];
  const log = console.error;
  console.error = (...args: unknown[]) => errors.push(args);
  Object.defineProperty(window, "localStorage", {
    configurable: true,
    get() {
      throw new DOMException("denied", "SecurityError");
    },
  });
  try {
    expect(readSeenAt()).toBe(0);
    markSeen(NOW);
    expect(errors).toHaveLength(2);
  } finally {
    console.error = log;
    if (storage) Object.defineProperty(window, "localStorage", storage);
  }
});
