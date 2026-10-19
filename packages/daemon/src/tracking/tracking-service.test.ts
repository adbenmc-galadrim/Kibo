import { afterEach, beforeEach, expect, test } from "bun:test";
import type { PollPass } from "../code/pr-poller";
import { createObserverFixture, type ObserverFixture } from "./observer-fixture.test-helper";
import { type Delay, startTracking, type Tracking } from "./tracking-service";

type Pending = { at: number; fn: () => void; cancelled: boolean };

const fakeDelay = () => {
  let now = 0;
  const pending: Pending[] = [];
  const delay: Delay = (fn, ms) => {
    const entry = { at: now + ms, fn, cancelled: false };
    pending.push(entry);
    return () => {
      entry.cancelled = true;
    };
  };
  const advance = (ms: number) => {
    now += ms;
    for (const entry of pending.splice(0)) {
      if (entry.cancelled) continue;
      if (entry.at <= now) entry.fn();
      else pending.push(entry);
    }
  };
  return { delay, advance, waiting: () => pending.filter((p) => !p.cancelled).length };
};

const fakePoller = () => {
  const passes = new Set<PollPass>();
  return {
    passes,
    beforePoll(pass: PollPass) {
      passes.add(pass);
      return () => void passes.delete(pass);
    },
    tick: async () => {
      for (const pass of passes) await pass();
    },
  };
};

let fx: ObserverFixture;
let tracking: Tracking | null;
let reads: number;
let branches: string[];
let listeners: Set<(projectId: string) => void>;

beforeEach(() => {
  fx = createObserverFixture(3);
  tracking = null;
  reads = 0;
  branches = ["main"];
  listeners = new Set();
});
afterEach(() => {
  tracking?.stop();
  fx.close();
});

const start = (poller: ReturnType<typeof fakePoller>, delay: Delay) => {
  tracking = startTracking({
    service: fx.service,
    poller,
    refs: async () => {
      reads++;
      return branches;
    },
    refsChanged(listener) {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    },
    log: () => () => undefined,
    delay,
  });
  return tracking;
};
const refsChanged = (projectId: string) => {
  for (const l of listeners) l(projectId);
};

test("the observation runs in each poller tick", async () => {
  const poller = fakePoller();
  start(poller, fakeDelay().delay);
  branches = ["feat/silo-2-a"];
  await poller.tick();
  expect(fx.ticket("SILO-2").statusId).toBe("in_progress");
});

test("ref changes are grouped over 500 ms before one observation", async () => {
  const clock = fakeDelay();
  const t = start(fakePoller(), clock.delay);
  branches = ["feat/silo-1-a"];
  refsChanged(fx.projectId);
  clock.advance(300);
  refsChanged(fx.projectId);
  clock.advance(499);
  expect(reads).toBe(0);
  clock.advance(1);
  await t.idle();
  expect(reads).toBe(1);
  expect(fx.ticket("SILO-1").statusId).toBe("in_progress");
});

test("stop unregisters the pass, the listener and the pending observation", async () => {
  const clock = fakeDelay();
  const poller = fakePoller();
  const t = start(poller, clock.delay);
  refsChanged(fx.projectId);
  t.stop();
  expect(poller.passes.size).toBe(0);
  expect(listeners.size).toBe(0);
  expect(clock.waiting()).toBe(0);
  await t.observe();
  expect(reads).toBe(0);
});

test("observations never overlap", async () => {
  const poller = fakePoller();
  const t = start(poller, fakeDelay().delay);
  branches = ["feat/silo-3-a"];
  await Promise.all([t.observe(), t.observe(), poller.tick()]);
  expect(fx.events.filter((e) => e.meta.origin === "kibo")).toHaveLength(1);
  expect(fx.ticket("SILO-3").statusId).toBe("in_progress");
});
