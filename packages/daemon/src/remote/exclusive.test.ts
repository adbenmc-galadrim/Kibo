import { expect, test } from "bun:test";
import { createExclusive } from "./exclusive";

test("works run one after the other, even when one fails", async () => {
  const exclusive = createExclusive();
  const steps: string[] = [];
  const slow = exclusive(async () => {
    steps.push("a:start");
    await Bun.sleep(20);
    steps.push("a:end");
    throw new Error("boom");
  });
  const fast = exclusive(async () => {
    steps.push("b");
    return 2;
  });
  expect(await slow.catch((e: unknown) => (e instanceof Error ? e.message : ""))).toBe("boom");
  expect(await fast).toBe(2);
  expect(steps).toEqual(["a:start", "a:end", "b"]);
});
