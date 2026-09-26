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

test("a refresh still describing when the scheduler stops starts no timer", async () => {
  let started = 0;
  let described: () => void = () => {};
  const asked: string[] = [];
  const scheduler = createJobScheduler({
    targets: () => [
      { projectId: "p", instanceId: "a", ref: "x@1.0.0", config: {} },
      { projectId: "p", instanceId: "b", ref: "y@1.0.0", config: {} },
    ],
    describe: (ref) => {
      asked.push(ref);
      return new Promise((resolve) => {
        described = () => resolve({ actions: [], jobs: [{ name: "sync", everyMinutes: 5 }] });
      });
    },
    run: async () => undefined,
    setInterval: () => {
      started += 1;
      return started;
    },
    clearInterval: () => {},
  });
  const refresh = scheduler.refresh();
  scheduler.stop();
  described();
  await refresh;
  expect(started).toBe(0);
  expect(asked).toEqual(["x@1.0.0"]);
  expect(scheduler.scheduled()).toEqual([]);
});

const retargetable = (initial: JobTarget, minutesOf: (ref: string) => number = () => 5) => {
  const timers = new Map<number, { fn: () => void; ms: number }>();
  const cleared: number[] = [];
  const runs: { ref: string; config: Record<string, unknown> }[] = [];
  let seq = 0;
  const state = { target: initial };
  const scheduler = createJobScheduler({
    targets: () => [state.target],
    describe: async (ref) => ({ actions: [], jobs: [{ name: "sync", everyMinutes: minutesOf(ref) }] }),
    run: async (t) => {
      runs.push({ ref: t.ref, config: t.config });
    },
    setInterval: (fn, ms) => {
      seq += 1;
      timers.set(seq, { fn, ms });
      return seq;
    },
    clearInterval: (id) => {
      cleared.push(Number(id));
      timers.delete(Number(id));
    },
  });
  const tickAll = async () => {
    for (const t of timers.values()) t.fn();
    await Promise.resolve();
  };
  return { scheduler, timers, cleared, runs, state, tickAll };
};

const helloTarget: JobTarget = { projectId: "p", instanceId: "a", ref: "hello@0.1.0", config: { n: 1 } };

test("a job follows its instance to a new version", async () => {
  const t = retargetable(helloTarget);
  await t.scheduler.refresh();
  t.state.target = { ...helloTarget, ref: "hello@0.2.0" };
  await t.scheduler.refresh();
  expect(t.cleared).toEqual([1]);
  expect([...t.timers.keys()]).toEqual([2]);
  await t.tickAll();
  expect(t.runs).toEqual([{ ref: "hello@0.2.0", config: { n: 1 } }]);
  t.scheduler.stop();
});

test("a job runs with the instance's new config", async () => {
  const t = retargetable(helloTarget);
  await t.scheduler.refresh();
  t.state.target = { ...helloTarget, config: { n: 2 } };
  await t.scheduler.refresh();
  expect(t.cleared).toEqual([1]);
  await t.tickAll();
  expect(t.runs).toEqual([{ ref: "hello@0.1.0", config: { n: 2 } }]);
  t.scheduler.stop();
});

test("a job takes the interval declared by the new version", async () => {
  const t = retargetable(helloTarget, (ref) => (ref === "hello@0.1.0" ? 5 : 15));
  await t.scheduler.refresh();
  t.state.target = { ...helloTarget, ref: "hello@0.2.0" };
  await t.scheduler.refresh();
  expect([...t.timers.values()].map((x) => x.ms)).toEqual([900_000]);
  t.scheduler.stop();
});

test("an unchanged target keeps its timer", async () => {
  const t = retargetable(helloTarget);
  await t.scheduler.refresh();
  t.state.target = { ...helloTarget, config: { n: 1 } };
  await t.scheduler.refresh();
  expect(t.cleared).toEqual([]);
  expect([...t.timers.keys()]).toEqual([1]);
  t.scheduler.stop();
});
