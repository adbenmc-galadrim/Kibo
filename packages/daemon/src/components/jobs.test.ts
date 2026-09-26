import { expect, test } from "bun:test";
import { createJobScheduler, type JobTarget } from "./jobs";

test("each instance gets its own timer per job, removed with the instance", async () => {
  const timers = new Map<number, { fn: () => void; ms: number }>();
  let seq = 0;
  const runs: string[] = [];
  let targets: JobTarget[] = [
    { projectId: "p", instanceId: "a", ref: "x@1.0.0", config: {} },
    { projectId: "p", instanceId: "b", ref: "x@1.0.0", config: {} },
    { projectId: "p", instanceId: "c", ref: "broken@1.0.0", config: {} },
  ];
  const logs: string[] = [];
  const scheduler = createJobScheduler({
    targets: () => targets,
    describe: async (ref) => {
      if (ref === "broken@1.0.0") throw new Error("TRUST_REQUIRED: nope");
      return { actions: [], jobs: [{ name: "sync", everyMinutes: 5 }] };
    },
    run: async (t, job) => {
      runs.push(`${t.instanceId}:${job}`);
    },
    setInterval: (fn, ms) => {
      seq += 1;
      timers.set(seq, { fn, ms });
      return seq;
    },
    clearInterval: (id) => {
      timers.delete(Number(id));
    },
    log: (line) => logs.push(line),
  });
  await scheduler.refresh();
  expect(scheduler.scheduled()).toEqual(["a:sync", "b:sync"]);
  expect([...timers.values()].map((t) => t.ms)).toEqual([300_000, 300_000]);
  for (const t of timers.values()) t.fn();
  await Promise.resolve();
  expect(runs.sort()).toEqual(["a:sync", "b:sync"]);
  expect(logs).toHaveLength(1);
  targets = targets.filter((t) => t.instanceId !== "b");
  await scheduler.refresh();
  expect(scheduler.scheduled()).toEqual(["a:sync"]);
  scheduler.stop();
  expect(timers.size).toBe(0);
});

test("a job is not started again while its previous run is still going", async () => {
  const ticks: (() => void)[] = [];
  const finish = Promise.withResolvers<void>();
  let runs = 0;
  const logs: string[] = [];
  const scheduler = createJobScheduler({
    targets: () => [{ projectId: "p", instanceId: "a", ref: "x@1.0.0", config: {} }],
    describe: async () => ({ actions: [], jobs: [{ name: "sync", everyMinutes: 1 }] }),
    run: async () => {
      runs += 1;
      await finish.promise;
    },
    setInterval: (fn) => {
      ticks.push(fn);
      return ticks.length;
    },
    clearInterval: () => undefined,
    log: (line) => logs.push(line),
  });
  await scheduler.refresh();
  ticks[0]?.();
  ticks[0]?.();
  expect(runs).toBe(1);
  expect(logs.some((l) => l.includes("skipped"))).toBe(true);
  finish.resolve();
  await new Promise((r) => setTimeout(r, 0));
  ticks[0]?.();
  expect(runs).toBe(2);
  scheduler.stop();
});

test("a failed run is logged and the job stays scheduled", async () => {
  const ticks: (() => void)[] = [];
  const logs: string[] = [];
  const scheduler = createJobScheduler({
    targets: () => [{ projectId: "p", instanceId: "a", ref: "x@1.0.0", config: {} }],
    describe: async () => ({ actions: [], jobs: [{ name: "sync", everyMinutes: 1 }] }),
    run: async () => {
      throw new Error("COMPONENT_CRASHED: boom");
    },
    setInterval: (fn) => {
      ticks.push(fn);
      return ticks.length;
    },
    clearInterval: () => undefined,
    log: (line) => logs.push(line),
  });
  await scheduler.refresh();
  ticks[0]?.();
  await new Promise((r) => setTimeout(r, 0));
  expect(logs).toEqual(["job a:sync of x@1.0.0 failed: COMPONENT_CRASHED: boom"]);
  expect(scheduler.scheduled()).toEqual(["a:sync"]);
  scheduler.stop();
});
