import { afterEach, beforeEach, expect, test } from "bun:test";
import { KiboError } from "@kibo/schema";
import { createSyncFixture, type SyncFixture } from "./testing/sync-fixture";

let f: SyncFixture;
beforeEach(() => {
  f = createSyncFixture();
});
afterEach(() => f.host.close());

const cycle = () => f.engine.cycle(f.host.projectId, "b1");
const titles = () =>
  f.host
    .snapshot(f.host.projectId)
    .tickets.map((t) => t.title)
    .sort();
const createFromKanban = (title: string) =>
  f.host.command(
    f.host.projectId,
    { method: "createTicket", title },
    { origin: "user", instanceId: f.instanceId() },
  );

test("a create rejected at once does not block imports", async () => {
  createFromKanban("Rejetée");
  f.remote.failNext(new KiboError("REMOTE_REJECTED", "github 422: Validation Failed"));
  await cycle();
  f.remote.add({ title: "Ailleurs" });
  await cycle();
  expect(titles()).toEqual(["Ailleurs", "Rejetée"]);
});

test("a create that timed out then was rejected still blocks imports", async () => {
  createFromKanban("Incertaine");
  f.remote.failNext(new KiboError("TIMEOUT", "no answer"));
  await cycle();
  f.host.clock.now += 5_000;
  f.remote.failNext(new KiboError("REMOTE_REJECTED", "github 422: Validation Failed"));
  await cycle();
  f.remote.add({ title: "Ailleurs" });
  await cycle();
  expect(titles()).toEqual(["Incertaine"]);
  expect(f.engine.state(f.host.projectId).errors).toMatchObject([{ code: "REMOTE_REJECTED" }]);
});

test("a create is uncertain while its request is in flight", async () => {
  createFromKanban("En vol");
  const push = f.remote.push;
  const uncertainDuringPush: boolean[] = [];
  f.remote.push = async (projectId, b, op) => {
    uncertainDuringPush.push(f.store.uncertainCreate("b1"));
    return push(projectId, b, op);
  };
  await cycle();
  expect(uncertainDuringPush).toEqual([true]);
  expect(f.store.uncertainCreate("b1")).toBe(false);
});
