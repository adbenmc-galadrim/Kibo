import { afterEach, beforeEach, expect, jest, test } from "bun:test";
import { KiboError } from "@kibo/schema";
import type { EventLog } from "../integrations/events";
import type { SyncEngine } from "./engine";
import { startSyncScheduler } from "./scheduler";

const calls: string[] = [];
const logged: string[] = [];
const events: EventLog = {
  log: (_integration, _level, message) => {
    logged.push(message);
  },
  recent: () => [],
};
const engine: SyncEngine = {
  async cycle(projectId, bindingId) {
    calls.push(`cycle ${projectId}/${bindingId}`);
    throw new KiboError("REMOTE_UNAVAILABLE", "offline");
  },
  async flush(projectId, bindingId) {
    calls.push(`flush ${projectId}/${bindingId}`);
    throw new KiboError("INTERNAL", "flush broke");
  },
  state: () => ({ bindings: [], pending: [], errors: [] }),
  resolveOutbox: () => undefined,
  deleteBinding: async () => undefined,
  runnable: () => [{ projectId: "p1", bindingId: "b1" }],
};

beforeEach(() => {
  calls.length = 0;
  logged.length = 0;
  jest.useFakeTimers();
});
afterEach(() => jest.useRealTimers());

test("each interval cycles every runnable binding, whose failure the engine already logged", async () => {
  const scheduler = startSyncScheduler(engine, events, 60_000);
  jest.advanceTimersByTime(60_000);
  await Promise.resolve();
  scheduler.stop();
  expect(calls).toEqual(["cycle p1/b1"]);
  expect(logged).toEqual([]);
});

test("kick flushes once, one second after the last change, and logs its failure", async () => {
  const scheduler = startSyncScheduler(engine, events, 60_000);
  scheduler.kick("p1", "b1");
  jest.advanceTimersByTime(900);
  scheduler.kick("p1", "b1");
  jest.advanceTimersByTime(900);
  expect(calls).toEqual([]);
  jest.advanceTimersByTime(100);
  await Promise.resolve();
  scheduler.stop();
  expect(calls).toEqual(["flush p1/b1"]);
  expect(logged).toEqual(["INTERNAL: flush broke"]);
});

test("stop cancels the interval and pending kicks", () => {
  const scheduler = startSyncScheduler(engine, events, 60_000);
  scheduler.kick("p1", "b1");
  scheduler.stop();
  jest.advanceTimersByTime(120_000);
  expect(calls).toEqual([]);
});
