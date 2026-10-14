import { expect, spyOn, test } from "bun:test";
import type { MachineLock } from "@kibo/schema";
import { createLocksWatch } from "./locks-watch";

const lock = (held: number): MachineLock => ({
  name: "heavy",
  max: 2,
  held: Array.from({ length: held }, (_, i) => ({
    ticket: `t${i}`,
    label: "gates",
    pid: 100 + i,
    since: 0,
    cwd: "/w",
    alive: true,
  })),
  waiting: [],
});

test("without a reader there is never a lock nor a change", () => {
  const watch = createLocksWatch(undefined);
  expect(watch.refresh()).toBe(false);
  expect(watch.current()).toEqual([]);
});

test("a refresh reports a change only when the locks differ", () => {
  let locks = [lock(1)];
  const watch = createLocksWatch(() => locks);
  expect(watch.refresh()).toBe(true);
  expect(watch.refresh()).toBe(false);
  locks = [lock(2)];
  expect(watch.refresh()).toBe(true);
  expect(watch.current()).toEqual([lock(2)]);
});

test("a failing reader keeps the last locks and is logged", () => {
  const errors = spyOn(console, "error").mockImplementation(() => {});
  try {
    let fail = false;
    const watch = createLocksWatch(() => {
      if (fail) throw new Error("EACCES");
      return [lock(1)];
    });
    watch.refresh();
    fail = true;
    expect(watch.refresh()).toBe(false);
    expect(watch.current()).toEqual([lock(1)]);
    expect(errors).toHaveBeenCalled();
  } finally {
    errors.mockRestore();
  }
});
