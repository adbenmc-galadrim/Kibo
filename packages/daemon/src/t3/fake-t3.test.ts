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
