import { afterEach, beforeEach, expect, test } from "bun:test";
import { createSyncFixture, type SyncFixture, USER } from "./testing/sync-fixture";

let f: SyncFixture;
beforeEach(() => {
  f = createSyncFixture();
});
afterEach(() => f.host.close());

const cycle = () => f.engine.cycle(f.host.projectId, "b1");
const eventCount = () =>
  f.host.db.query<{ n: number }, []>("SELECT COUNT(*) AS n FROM integration_events").get()?.n ?? 0;

test("at most one cycle waits per binding: later calls share it", async () => {
  const first = cycle();
  const second = cycle();
  const third = cycle();
  expect(third).toBe(second);
  await Promise.all([first, second, third]);
  expect(f.remote.pulls).toBeLessThanOrEqual(2);
});

test("a paused rate limit holds the outbox without spending attempts", async () => {
  f.remote.add({ title: "A" });
  await cycle();
  const ticket = f.host.snapshot(f.host.projectId).tickets[0];
  f.host.command(f.host.projectId, { method: "updateTicket", ticketId: ticket?.id ?? "", title: "B" }, USER);
  f.gate.until = f.host.now() + 600_000;
  await expect(cycle()).rejects.toThrow("RATE_LIMITED");
  await f.engine.flush(f.host.projectId, "b1");
  expect(f.remote.pushes).toEqual([]);
  expect(f.store.outbox("b1").map((r) => r.attempts)).toEqual([0]);
});

test("a failed cycle is logged once", async () => {
  f.gate.until = f.host.now() + 600_000;
  const before = eventCount();
  await expect(cycle()).rejects.toThrow("RATE_LIMITED");
  expect(eventCount() - before).toBe(1);
});

test("deleting a binding waits for its running cycle", async () => {
  f.remote.add({ title: "A" });
  const running = cycle();
  await f.engine.deleteBinding(f.host.projectId, "b1");
  await running;
  expect(f.store.cursor("b1")).toBeNull();
  expect(f.store.item("b1", "1")).toBeNull();
  expect(f.host.snapshot(f.host.projectId).bindings).toEqual([]);
});
