import { afterEach, beforeEach, expect, test } from "bun:test";
import { KiboError } from "@kibo/schema";
import { createT3Runner, resolveT3Bin } from "./t3-cli";
import { type FakeT3, installFakeT3 } from "./testing/t3-kit";

let fake: FakeT3;
beforeEach(() => {
  fake = installFakeT3();
});
afterEach(() => fake.stop());

const failure = async (work: Promise<unknown>): Promise<KiboError> => {
  const error = await work.catch((e: unknown) => e);
  if (!(error instanceof KiboError)) throw new Error(`expected a KiboError, got ${String(error)}`);
  return error;
};

test("a missing binary raises T3_MISSING", async () => {
  const error = await failure(createT3Runner("/nonexistent/t3")(["thread", "list"], {}));
  expect(error.code).toBe("T3_MISSING");
});

test("exit code 127 raises T3_MISSING", async () => {
  fake.set({ mode: "missing" });
  expect((await failure(createT3Runner(fake.bin)(["thread", "list"], {}))).code).toBe("T3_MISSING");
});

test("a non-zero exit raises T3_UNAVAILABLE with the stderr excerpt", async () => {
  fake.set({ mode: "server-down" });
  const error = await failure(createT3Runner(fake.bin)(["theme", "show"], {}));
  expect(error.code).toBe("T3_UNAVAILABLE");
  expect(error.detail).toContain("T3 Code server is not running");
});

test("stdout JSON is returned on success", async () => {
  const result = await createT3Runner(fake.bin)(["thread", "list", "--project", "/w", "--json"], {});
  expect(result.code).toBe(0);
  expect(JSON.parse(result.stdout)).toEqual([]);
});

test("a command over its timeout raises T3_UNAVAILABLE", async () => {
  const error = await failure(createT3Runner("/bin/sleep")(["5"], { timeoutMs: 20 }));
  expect(error.code).toBe("T3_UNAVAILABLE");
  expect(error.detail).toContain("timed out");
});

test("the binary comes from the flag, then KIBO_T3, then the home folder", () => {
  expect(resolveT3Bin({ flag: "/f/t3", env: { KIBO_T3: "/e/t3" }, home: "/h" })).toBe("/f/t3");
  expect(resolveT3Bin({ env: { KIBO_T3: "/e/t3" }, home: "/h" })).toBe("/e/t3");
  expect(resolveT3Bin({ env: {}, home: "/h" })).toBe("/h/.t3/bin/t3");
});
