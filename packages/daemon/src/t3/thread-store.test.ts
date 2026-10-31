import { Database } from "bun:sqlite";
import { expect, test } from "bun:test";
import { KiboError } from "@kibo/schema";
import { createThreadStore } from "./thread-store";

const store = () => createThreadStore(new Database(":memory:", { strict: true }));
const thread = (threadId: string, startedAt = 1) => ({
  threadId,
  link: `t3-thread://${threadId}`,
  title: threadId,
  status: "running" as const,
  startedAt,
  checkedAt: startedAt,
});

test("at most one active thread per ticket", () => {
  const s = store();
  s.add("p", "t1", thread("a"));
  let error: unknown = null;
  try {
    s.add("p", "t1", thread("b"));
  } catch (e) {
    error = e;
  }
  expect(error instanceof KiboError && error.code).toBe("T3_THREAD_ACTIVE");
  s.add("p", "t2", thread("c"));
});

test("finished threads are kept", () => {
  const s = store();
  s.add("p", "t1", thread("a", 1));
  s.update("a", { status: "done", checkedAt: 5 });
  s.add("p", "t1", thread("b", 2));
  s.update("b", { status: "failed", checkedAt: 6 });
  expect(s.threadOf("p", "t1")).toMatchObject({ threadId: "b", status: "failed" });
  expect(s.latest("p").get("t1")?.threadId).toBe("b");
  expect(s.all("p").map((r) => r.threadId)).toEqual(["a", "b"]);
});

test("the active thread wins over a more recent finished one", () => {
  const s = store();
  s.add("p", "t1", thread("old", 1));
  s.update("old", { status: "done", checkedAt: 5 });
  s.add("p", "t1", { ...thread("now", 1) });
  expect(s.threadOf("p", "t1")?.threadId).toBe("now");
});

test("activeThreads(projectId) lists running and waiting only", () => {
  const s = store();
  s.add("p", "t1", thread("a"));
  s.add("p", "t2", thread("b"));
  s.add("p", "t3", thread("c"));
  s.add("q", "t4", thread("d"));
  s.update("b", { status: "waiting", checkedAt: 2 });
  s.update("c", { status: "done", checkedAt: 2 });
  expect(
    s
      .activeThreads("p")
      .map((r) => r.threadId)
      .sort(),
  ).toEqual(["a", "b"]);
  expect(s.activeProjects().sort()).toEqual(["p", "q"]);
});

test("a link learned later replaces the stored one", () => {
  const s = store();
  s.add("p", "t1", { ...thread("a"), link: "" });
  s.update("a", { status: "running", checkedAt: 2, link: "t3-thread://a" });
  expect(s.threadOf("p", "t1")).toMatchObject({ link: "t3-thread://a", checkedAt: 2 });
});
