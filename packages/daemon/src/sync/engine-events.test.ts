import { afterEach, beforeEach, expect, test } from "bun:test";
import type { IntegrationEvent } from "@kibo/schema";
import { createSyncFixture, type SyncFixture, USER } from "./testing/sync-fixture";

let f: SyncFixture;
beforeEach(() => {
  f = createSyncFixture();
});
afterEach(() => f.host.close());

const runningNow = () => f.engine.state(f.host.projectId).bindings[0]?.running;

test("the state no longer reports a cycle as running once its end is broadcast", async () => {
  const seen: (boolean | undefined)[] = [];
  const broadcast = f.host.broadcast;
  f.host.broadcast = (e: IntegrationEvent) => {
    if (e.type === "sync" && !e.running) seen.push(runningNow());
    broadcast(e);
  };
  f.remote.add({ title: "A" });
  const cycle = f.engine.cycle(f.host.projectId, "b1");
  expect(runningNow()).toBe(true);
  await cycle;
  expect(seen).toEqual([false]);
});

test("a flush tells the clients that the outbox changed", async () => {
  f.remote.add({ title: "A" });
  await f.engine.cycle(f.host.projectId, "b1");
  const ticket = f.host.snapshot(f.host.projectId).tickets[0];
  f.host.command(f.host.projectId, { method: "updateTicket", ticketId: ticket?.id ?? "", title: "B" }, USER);
  f.host.events.length = 0;
  await f.engine.flush(f.host.projectId, "b1");
  expect(f.host.events).toEqual([{ type: "sync.outbox", projectId: f.host.projectId, bindingId: "b1" }]);
});
