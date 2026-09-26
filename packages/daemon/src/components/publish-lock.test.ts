import { expect, test } from "bun:test";
import { createPublishLock } from "./publish-lock";

test("one publication per component at a time, released even after a failure", async () => {
  const lock = createPublishLock();
  let release = () => {};
  const first = lock.hold(
    "burndown",
    () =>
      new Promise<string>((resolve) => {
        release = () => resolve("first");
      }),
  );
  expect(lock.isHeld("burndown")).toBe(true);
  await expect(lock.hold("burndown", async () => "second")).rejects.toMatchObject({ code: "CONFLICT" });
  expect(await lock.hold("velocity", async () => "other")).toBe("other");
  release();
  expect(await first).toBe("first");
  expect(lock.isHeld("burndown")).toBe(false);
  await expect(
    lock.hold("burndown", async () => {
      throw new Error("boom");
    }),
  ).rejects.toThrow("boom");
  expect(await lock.hold("burndown", async () => "again")).toBe("again");
});
