import { Database } from "bun:sqlite";
import { expect, test } from "bun:test";
import { KiboError, type ProjectEventInput } from "@kibo/schema";
import type { T3Runner } from "./t3-cli";
import { createThreadPoll, T3_POLL_MS } from "./thread-poll";
import { createThreadStore } from "./thread-store";

const DAY = 24 * 3_600_000;

function setup() {
  const store = createThreadStore(new Database(":memory:", { strict: true }));
  const listed = { value: [] as unknown[] };
  const failure: { value: KiboError | null } = { value: null };
  const calls: (readonly string[])[] = [];
  const logged: string[] = [];
  const emitted: string[] = [];
  const events: ProjectEventInput[] = [];
  const timers = new Map<number, { fn: () => void; ms: number }>();
  let nextTimer = 1;
  const clock = { now: 100 };
  const run: T3Runner = async (args) => {
    calls.push(args);
    if (failure.value) throw failure.value;
    return { code: 0, stdout: JSON.stringify(listed.value), stderr: "" };
  };
  const poll = createThreadPoll({
    store,
    run,
    folderOf: () => "/w/silo",
    tickets: () => [{ id: "t1", key: "SILO-1", keyLabel: "SILO-1", parentId: null, delivery: null }],
    now: () => clock.now,
    emit: (id) => emitted.push(id),
    sink: { record: (_p, event) => events.push(event) },
    log: (what) => logged.push(what),
    timers: {
      set(fn, ms) {
        const id = nextTimer++;
        timers.set(id, { fn, ms });
        return id;
      },
      clear: (id) => timers.delete(id),
    },
  });
  const add = (threadId: string, ticketId = "t1") =>
    store.add("p", ticketId, {
      threadId,
      link: "",
      title: threadId,
      status: "running",
      startedAt: 1,
      checkedAt: 1,
    });
  const tick = async () => {
    for (const timer of [...timers.values()]) timer.fn();
    await poll.settled();
    clock.now += T3_POLL_MS;
  };
  return { clock, logged, store, listed, failure, calls, emitted, events, timers, poll, add, tick };
}

test("polling every 30 s maps statuses, publishes changes on the project channel and stops when no thread is active", async () => {
  const s = setup();
  s.add("a");
  s.poll.watch("p");
  s.poll.watch("p");
  expect([...s.timers.values()].map((t) => t.ms)).toEqual([30_000]);

  s.listed.value = [{ threadId: "a", status: "running", link: "t3-thread://a" }];
  await s.tick();
  expect(s.calls[0]).toEqual(["thread", "list", "--project", "/w/silo", "--json"]);
  expect(s.emitted).toEqual([]);
  expect(s.store.threadOf("p", "t1")?.link).toBe("t3-thread://a");

  s.listed.value = [{ threadId: "a", status: "waiting" }];
  await s.tick();
  expect(s.store.threadOf("p", "t1")?.status).toBe("waiting");
  expect(s.emitted).toEqual(["p"]);
  expect(s.events).toEqual([]);

  s.listed.value = [{ threadId: "a", status: "failed" }];
  await s.tick();
  expect(s.store.threadOf("p", "t1")?.status).toBe("failed");
  expect(s.events.map((e) => [e.kind, e.data.status])).toEqual([["t3_finished", "failed"]]);
  expect(s.timers.size).toBe(0);
});

test("a thread absent from the list becomes done and writes t3_finished", async () => {
  const s = setup();
  s.add("a");
  s.poll.watch("p");
  await s.tick();
  expect(s.store.threadOf("p", "t1")?.status).toBe("done");
  expect(s.events).toMatchObject([
    { kind: "t3_finished", ticketId: "t1", data: { threadId: "a", ticketKey: "SILO-1", status: "done" } },
  ]);
  expect(s.emitted).toEqual(["p"]);
});

test("a stopped server changes nothing and polling goes on", async () => {
  const s = setup();
  s.add("a");
  s.poll.watch("p");
  s.failure.value = new KiboError("T3_UNAVAILABLE", "T3 Code server is not running");
  await s.tick();
  expect(s.store.threadOf("p", "t1")?.status).toBe("running");
  expect(s.events).toEqual([]);
  expect(s.timers.size).toBe(1);
});

test("an unreadable list is an error, not a finished thread", async () => {
  const s = setup();
  s.add("a");
  s.listed.value = [{ nope: true }];
  await expect(s.poll.refresh("p")).rejects.toMatchObject({ code: "T3_UNAVAILABLE" });
  expect(s.store.threadOf("p", "t1")?.status).toBe("running");
});

test("start watches the projects that still have an active thread", () => {
  const s = setup();
  s.add("a");
  s.poll.start();
  expect(s.timers.size).toBe(1);
  s.poll.stop();
  expect(s.timers.size).toBe(0);
});

test("an unknown status stays running and is logged once", async () => {
  const s = setup();
  s.add("a");
  s.listed.value = [{ threadId: "a", status: "brand-new" }];
  await s.poll.refresh("p");
  await s.poll.refresh("p");
  expect(s.store.threadOf("p", "t1")?.status).toBe("running");
  expect(s.logged.filter((line) => line.includes("brand-new"))).toHaveLength(1);
});

test("an active thread whose updatedAt stays the same for 24 h becomes done and polling stops", async () => {
  const s = setup();
  s.add("a");
  s.poll.watch("p");
  s.listed.value = [{ threadId: "a", status: "running", updatedAt: "u1" }];
  await s.poll.refresh("p");
  s.clock.now += DAY - 1;
  await s.poll.refresh("p");
  expect(s.store.threadOf("p", "t1")?.status).toBe("running");
  s.clock.now += 1;
  await s.poll.refresh("p");
  expect(s.store.threadOf("p", "t1")?.status).toBe("done");
  expect(s.events.map((e) => e.kind)).toEqual(["t3_finished"]);
  expect(s.timers.size).toBe(0);
  s.add("b");
  expect(s.store.threadOf("p", "t1")?.threadId).toBe("b");
});

test("a changed updatedAt restarts the 24 h", async () => {
  const s = setup();
  s.add("a");
  s.listed.value = [{ threadId: "a", status: "waiting", updatedAt: "u1" }];
  await s.poll.refresh("p");
  s.clock.now += DAY - 1;
  s.listed.value = [{ threadId: "a", status: "waiting", updatedAt: "u2" }];
  await s.poll.refresh("p");
  s.clock.now += DAY - 1;
  await s.poll.refresh("p");
  expect(s.store.threadOf("p", "t1")?.status).toBe("waiting");
});
