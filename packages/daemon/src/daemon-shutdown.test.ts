import { expect, test } from "bun:test";
import { type Closers, shutdown } from "./daemon-shutdown";

function closers(order: string[], failing: ReadonlySet<string> = new Set()): Closers {
  const closer = (name: string) => async () => {
    await Bun.sleep(1);
    order.push(name);
    if (failing.has(name)) throw new Error(`${name} failed`);
  };
  return {
    front: [closer("server"), closer("remote"), closer("sandbox")],
    back: [closer("store"), closer("runs"), closer("orchestrator")],
  };
}

test("shutdown closes the front first, then the back, each in reverse order of opening", async () => {
  const order: string[] = [];
  const all = closers(order);
  await shutdown(all);
  expect(order).toEqual(["sandbox", "remote", "server", "orchestrator", "runs", "store"]);
  expect(all).toEqual({ front: [], back: [] });
});

test("a failing closer does not stop the others and the failures are aggregated", async () => {
  const order: string[] = [];
  const failure = await shutdown(closers(order, new Set(["remote", "sandbox", "runs"]))).catch(
    (e: unknown) => e,
  );
  expect(order).toEqual(["sandbox", "remote", "server", "orchestrator", "runs", "store"]);
  expect(failure).toBeInstanceOf(AggregateError);
  if (!(failure instanceof AggregateError)) return;
  expect(failure.message).toBe("daemon shutdown failed");
  expect(failure.errors.map((e: Error) => e.message)).toEqual([
    "sandbox failed",
    "remote failed",
    "runs failed",
  ]);
});

test("the front failures surface when the back closes cleanly", async () => {
  const order: string[] = [];
  const failure = await shutdown(closers(order, new Set(["remote", "sandbox"]))).catch((e: unknown) => e);
  expect(order).toHaveLength(6);
  expect(failure).toBeInstanceOf(AggregateError);
  if (!(failure instanceof AggregateError)) return;
  expect(failure.errors.map((e: Error) => e.message)).toEqual(["sandbox failed", "remote failed"]);
});

test("a second shutdown has nothing left to close", async () => {
  const order: string[] = [];
  const all = closers(order);
  await shutdown(all);
  await shutdown(all);
  expect(order).toHaveLength(6);
});
