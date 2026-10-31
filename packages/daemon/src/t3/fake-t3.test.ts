import { afterEach, beforeEach, expect, test } from "bun:test";
import { createT3Runner } from "./t3-cli";
import { type FakeT3, installFakeT3 } from "./testing/t3-kit";

let fake: FakeT3;
beforeEach(() => {
  fake = installFakeT3();
});
afterEach(() => fake.stop());

test("thread start adds a running thread, prints it and thread list filters by project", async () => {
  const run = createT3Runner(fake.bin);
  const started = await run(
    ["thread", "start", "/w/a", "/full-delivery A-1", "--title", "A-1 · x", "--json"],
    {},
  );
  expect(JSON.parse(started.stdout)).toEqual({
    threadId: "thr_1",
    link: "t3-thread://v2/fake/thr_1",
    title: "A-1 · x",
  });
  const listed = await run(["thread", "list", "--project", "/w/a", "--json"], {});
  expect(JSON.parse(listed.stdout)).toMatchObject([
    { threadId: "thr_1", status: "running", project: "/w/a" },
  ]);
  expect(JSON.parse((await run(["thread", "list", "--project", "/w/b", "--json"], {})).stdout)).toEqual([]);
  expect(fake.calls()[0]?.slice(0, 2)).toEqual(["thread", "start"]);
});

test("thread list without --project fails like the real CLI outside a project", async () => {
  await expect(createT3Runner(fake.bin)(["thread", "list", "--json"], {})).rejects.toMatchObject({
    code: "T3_UNAVAILABLE",
    detail: expect.stringContaining("No T3 Code project matches"),
  });
});

test("theme show does not depend on the current folder and fails when the server is down", async () => {
  const run = createT3Runner(fake.bin);
  expect((await run(["theme", "show"], {})).code).toBe(0);
  fake.set({ mode: "server-down" });
  await expect(run(["theme", "show"], {})).rejects.toMatchObject({ code: "T3_UNAVAILABLE" });
});

test("thread start can print an invalid output and keep or drop the thread", async () => {
  const run = createT3Runner(fake.bin);
  fake.set({ startOutput: "not json" });
  expect((await run(["thread", "start", "/w/a", "m", "--title", "x", "--json"], {})).stdout.trim()).toBe(
    "not json",
  );
  expect(fake.state().threads).toHaveLength(1);
  fake.set({ startDropsThread: true });
  await run(["thread", "start", "/w/a", "m", "--title", "y", "--json"], {});
  expect(fake.state().threads).toHaveLength(1);
});
