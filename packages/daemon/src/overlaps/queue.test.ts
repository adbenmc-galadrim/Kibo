import { expect, test } from "bun:test";
import { createRunQueue } from "./queue";

const tick = () => new Promise<void>((resolve) => setTimeout(resolve, 1));

function tracked(log: string[], name: string, running: { now: number; max: number }) {
  return async () => {
    running.now += 1;
    running.max = Math.max(running.max, running.now);
    log.push(`start ${name}`);
    await tick();
    log.push(`end ${name}`);
    running.now -= 1;
  };
}

test("two jobs of the same run run in order, never at the same time", async () => {
  const queue = createRunQueue(() => undefined);
  const log: string[] = [];
  const running = { now: 0, max: 0 };
  void queue.push("r1", tracked(log, "a", running));
  await queue.push("r1", tracked(log, "b", running));
  expect(log).toEqual(["start a", "end a", "start b", "end b"]);
  expect(running.max).toBe(1);
});

test("two runs run in parallel", async () => {
  const queue = createRunQueue(() => undefined);
  const running = { now: 0, max: 0 };
  await Promise.all([
    queue.push("r1", tracked([], "a", running)),
    queue.push("r2", tracked([], "b", running)),
  ]);
  expect(running.max).toBe(2);
});

test("a failing job is logged and does not block the next one", async () => {
  const logged: string[] = [];
  const queue = createRunQueue((line) => logged.push(line));
  const done: string[] = [];
  void queue.push("r1", async () => {
    throw new Error("boom");
  });
  await queue.push("r1", async () => {
    done.push("next");
  });
  expect(done).toEqual(["next"]);
  expect(logged).toHaveLength(1);
  expect(logged[0]).toContain("boom");
});

test("idle waits for the end of the queued jobs", async () => {
  const queue = createRunQueue(() => undefined);
  const log: string[] = [];
  void queue.push("r1", tracked(log, "a", { now: 0, max: 0 }));
  void queue.push("r1", tracked(log, "b", { now: 0, max: 0 }));
  await queue.idle("r1");
  expect(log).toEqual(["start a", "end a", "start b", "end b"]);
  await queue.idle("unknown");
});
