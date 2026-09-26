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

test("a rejected create blocks imports until the user drops it", async () => {
  createFromKanban("Rejetée");
  f.remote.failNext(new KiboError("REMOTE_REJECTED", "github 422: Validation Failed"));
  await cycle();
  f.remote.add({ title: "Ailleurs" });
  await cycle();
  expect(titles()).toEqual(["Rejetée"]);
  const [error] = f.engine.state(f.host.projectId).errors;
  f.engine.resolveOutbox(f.host.projectId, error?.outboxId ?? 0, "drop");
  await cycle();
  expect(titles()).toEqual(["Ailleurs", "Rejetée"]);
});

const failAfterWrite = (error: KiboError) => {
  const push = f.remote.push;
  let pending = true;
  f.remote.push = async (projectId, b, op) => {
    const m = await push(projectId, b, op);
    if (op.kind === "create" && pending) {
      pending = false;
      throw error;
    }
    return m;
  };
};
const lastCreate = () => f.remote.pushes.filter((p) => p.kind === "create").at(-1);

test("a create written on GitHub then rejected is adopted on retry, never duplicated", async () => {
  createFromKanban("Avec Project");
  failAfterWrite(new KiboError("REMOTE_REJECTED", "github 403: project scope missing"));
  await cycle();
  await cycle();
  const [error] = f.engine.state(f.host.projectId).errors;
  f.engine.resolveOutbox(f.host.projectId, error?.outboxId ?? 0, "retry");
  await cycle();
  expect(titles()).toEqual(["Avec Project"]);
  expect(f.remote.issues.size).toBe(1);
  expect(lastCreate()).toMatchObject({ since: expect.any(String) });
  expect(f.store.uncertainCreate("b1")).toBe(false);
});

test("a create rate limited after its POST is adopted on the next try", async () => {
  createFromKanban("Limitée");
  failAfterWrite(new KiboError("RATE_LIMITED", "secondary rate limit"));
  await cycle();
  f.remote.add({ title: "Ailleurs" });
  await cycle();
  expect(titles()).toEqual(["Limitée"]);
  f.host.clock.now += 5_000;
  await cycle();
  await cycle();
  expect(titles()).toEqual(["Ailleurs", "Limitée"]);
  expect(f.remote.issues.size).toBe(2);
  expect(lastCreate()).toMatchObject({ since: expect.any(String) });
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
