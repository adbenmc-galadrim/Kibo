import { expect, spyOn, test } from "bun:test";
import { createInflight } from "./inflight";

const deferred = () => {
  let resolve = () => {};
  const promise = new Promise<void>((r) => {
    resolve = r;
  });
  return { promise, resolve };
};

test("drain waits for work tracked while draining", async () => {
  const inflight = createInflight();
  const first = deferred();
  const second = deferred();
  const done: string[] = [];
  inflight.track(first.promise).then(() => {
    done.push("first");
    inflight.track(second.promise).then(() => done.push("second"));
  });
  const draining = inflight.drain(5_000).then(() => done.push("drained"));
  first.resolve();
  await Bun.sleep(20);
  expect(done).toEqual(["first"]);
  second.resolve();
  await draining;
  expect(done).toEqual(["first", "second", "drained"]);
});

test("drain gives up after its bound and names what is left", async () => {
  const inflight = createInflight();
  inflight.track(new Promise(() => undefined));
  const errors = spyOn(console, "error").mockImplementation(() => undefined);
  const started = Date.now();
  await inflight.drain(50);
  const elapsed = Date.now() - started;
  const logged = errors.mock.calls.flat().map(String);
  errors.mockRestore();
  expect(elapsed).toBeGreaterThanOrEqual(45);
  expect(elapsed).toBeLessThan(1_000);
  expect(logged).toContain("[kibo-daemon] 1 requests still running at shutdown");
});

test("a tracked rejection reaches its caller", async () => {
  const inflight = createInflight();
  await expect(inflight.track(Promise.reject(new Error("boom")))).rejects.toThrow("boom");
  await inflight.drain(50);
});
