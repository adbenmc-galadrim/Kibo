import { expect, test } from "bun:test";
import type { RunView } from "@kibo/schema";
import { runView } from "../questions/questions.test-helper";
import { createSweepScheduler } from "./sweep";

function fakeTimers() {
  const timers = {
    every: [] as { fn: () => void; ms: number }[],
    cleared: 0,
    tick: () => {
      for (const t of timers.every) t.fn();
    },
  };
  return {
    timers,
    port: {
      every(fn: () => void, ms: number) {
        timers.every.push({ fn, ms });
        return () => {
          timers.cleared += 1;
        };
      },
    },
  };
}

function setup(projects = ["P", "Q"]) {
  const swept: string[] = [];
  const gates = new Map<string, () => void>();
  const logs: string[] = [];
  const { timers, port } = fakeTimers();
  const scheduler = createSweepScheduler({
    detector: {
      sweep: (projectId) => {
        swept.push(projectId);
        return new Promise<void>((resolve) => gates.set(projectId, resolve));
      },
    },
    projects: () => projects,
    timers: port,
    log: (line) => logs.push(line),
  });
  const release = async () => {
    for (const [id, resolve] of gates) {
      gates.delete(id);
      resolve();
    }
    await new Promise((resolve) => setTimeout(resolve, 1));
  };
  return { scheduler, swept, timers, release, logs };
}

const ticketRun = (projectId: string): RunView => runView({ id: "r1", projectId });

test("start schedules a sweep of every project every five minutes", async () => {
  const { scheduler, swept, timers, release } = setup();
  scheduler.start();
  expect(timers.every.map((t) => t.ms)).toEqual([300_000]);
  timers.tick();
  expect(swept).toEqual(["P", "Q"]);
  await release();
});

test("a tick during a running sweep of the same project is ignored", async () => {
  const { scheduler, swept, timers, release } = setup();
  scheduler.start();
  timers.tick();
  timers.tick();
  expect(swept).toEqual(["P", "Q"]);
  await release();
  timers.tick();
  expect(swept).toEqual(["P", "Q", "P", "Q"]);
  await release();
});

test("a run spawned as the second workspace of its project sweeps at once", async () => {
  const { scheduler, swept, release } = setup();
  scheduler.onSpawned(ticketRun("P"), 1);
  expect(swept).toEqual([]);
  scheduler.onSpawned(ticketRun("P"), 2);
  expect(swept).toEqual(["P"]);
  await release();
});

test("the end of a turn sweeps the project of the run", async () => {
  const { scheduler, swept, release } = setup();
  scheduler.onTurnEnd(ticketRun("Q"));
  scheduler.onTurnEnd(runView({ id: "r2", projectId: null }));
  expect(swept).toEqual(["Q"]);
  await release();
});

test("a failing sweep is logged and the project can be swept again", async () => {
  const logs: string[] = [];
  let calls = 0;
  const scheduler = createSweepScheduler({
    detector: {
      sweep: async () => {
        calls += 1;
        throw new Error("boom");
      },
    },
    projects: () => ["P"],
    timers: fakeTimers().port,
    log: (line) => logs.push(line),
  });
  scheduler.onTurnEnd(ticketRun("P"));
  await new Promise((resolve) => setTimeout(resolve, 1));
  scheduler.onTurnEnd(ticketRun("P"));
  await new Promise((resolve) => setTimeout(resolve, 1));
  expect(calls).toBe(2);
  expect(logs).toHaveLength(2);
});

test("stop clears the timer", () => {
  const { scheduler, timers } = setup();
  scheduler.start();
  scheduler.stop();
  expect(timers.cleared).toBe(1);
});
