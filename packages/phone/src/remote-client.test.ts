import { beforeEach, expect, test } from "bun:test";
import { INDEX_PROJECT_ID, type ProjectsIndex, REQUEST_CLOCK_REFUSAL, type RemoteKeys } from "@kibo/remote";
import { KiboError, type ProjectEvent, type ProjectSnapshot, type RunLogEntry } from "@kibo/schema";
import { type FakeServerApi, fakeServerApi, putBlob } from "./fake-server-api";
import { createInstanceData } from "./instance-data";
import { type Connectivity, createRemoteClient, type RemoteClient } from "./remote-client";
import { lotSeven } from "./screens/agent/agent-test-kit";
import { createSnapshotStore } from "./snapshot-store";
import { memoryStorage } from "./storage";
import { sealJson, testKeys } from "./test-kit";

const INDEX: ProjectsIndex = {
  viewer: "adam",
  projects: [{ id: "silo", name: "Silo", key: "SILO", icon: null, pages: [] }],
};
const ticket = (id: string, key: string) => ({ id, keyLabel: key, key, statusId: "todo" });
const PROJECT = {
  meta: { id: "silo", key: "SILO", name: "Silo", color: "#14B8A6" },
  workflow: [{ id: "todo" }, { id: "in_progress" }],
  tickets: [ticket("t1", "SILO-45"), ticket("t2", "SILO-46")],
  questionRecipients: [],
};
const event = (id: number, ticketId: string): ProjectEvent => ({
  id,
  projectId: "silo",
  at: id,
  kind: "status_changed",
  ticketId,
  featureId: null,
  source: "user",
  data: {},
});

let keys: RemoteKeys;
let api: FakeServerApi;
let connectivity: Connectivity;
let client: RemoteClient;
const presenceListeners = new Set<() => void>();

const setConnectivity = (next: Connectivity) => {
  connectivity = next;
  for (const l of presenceListeners) l();
};

beforeEach(async () => {
  localStorage.clear();
  keys = await testKeys();
  api = fakeServerApi(keys);
  putBlob(api, await sealJson(keys, INDEX_PROJECT_ID, "projects", INDEX));
  putBlob(api, await sealJson(keys, "silo", "project", PROJECT));
  connectivity = { macOnline: true, phoneOnline: true };
  client = createRemoteClient({
    api,
    keys: () => keys,
    snapshots: createSnapshotStore(memoryStorage().snapshots),
    data: createInstanceData(localStorage),
    presence: {
      get: () => connectivity,
      subscribe: (l) => {
        presenceListeners.add(l);
        return () => presenceListeners.delete(l);
      },
    },
  });
  await client.sync();
  api.calls.length = 0;
});

test("getProject is served from the project snapshot without a network call", async () => {
  const snapshot: ProjectSnapshot = await client.rpc({ method: "getProject", projectId: "silo" });
  expect(snapshot.meta.name).toBe("Silo");
  expect(api.calls).toEqual([]);
});

test("listProjects comes from the index blob", async () => {
  const projects = await client.rpc({ method: "listProjects" });
  expect(projects.map((p) => [p.id, p.name])).toEqual([["silo", "Silo"]]);
  expect(projects[0]?.counts).toMatchObject({ todo: 2, in_progress: 0 });
  expect(await client.rpc({ method: "getSession" })).toEqual({ user: "adam", notifications: "browser" });
  expect(api.calls).toEqual([]);
});

test("listProjectEvents filters by ticketId and limit locally", async () => {
  const events = [event(4, "t1"), event(3, "t2"), event(2, "t1"), event(1, "t1")];
  putBlob(api, await sealJson(keys, "silo", "events", events, { seq: 2 }));
  await client.handleEvent({ type: "snapshot.changed", projectId: "silo", kind: "events", seq: 2 });
  api.calls.length = 0;
  const page = await client.rpc({ method: "listProjectEvents", projectId: "silo", ticketId: "t1", limit: 2 });
  expect(page.items.map((e) => e.id)).toEqual([4, 2]);
  expect(page.nextBefore).toBe(2);
  const rest = await client.rpc({
    method: "listProjectEvents",
    projectId: "silo",
    ticketId: "t1",
    limit: 2,
    before: 2,
  });
  expect(rest).toEqual({ items: [event(1, "t1")], nextBefore: null });
  expect(api.calls).toEqual([]);
});

test("getProjectAgent and getRunLog come from the agent blob", async () => {
  const view = { session: null, run: null, batches: [], past: [], memoryPath: "" };
  const entries: RunLogEntry[] = [{ id: 1, at: 1, event: { type: "cancelled" } }];
  const logs = { "run-1": entries };
  putBlob(api, await sealJson(keys, "silo", "agent", { view, logs }));
  await client.sync();
  api.calls.length = 0;
  expect(await client.rpc({ method: "getProjectAgent", projectId: "silo" })).toEqual(view);
  expect(await client.rpc({ method: "getRunLog", runId: "run-1" })).toEqual(entries);
  expect(await client.rpc({ method: "getRunLog", runId: "other" })).toEqual([]);
  expect(api.calls).toEqual([]);
});

test("getProjectAgent with the runId of a past session serves that session from the agent blob", async () => {
  const past = (runId: string) => ({
    projectId: "silo",
    runId,
    sessionId: `s-${runId}`,
    startedAt: 1,
    closedAt: 2,
    lastTurnAt: 2,
    title: "Point de sprint S41",
    messages: 6,
  });
  const current = { ...past("pa7"), closedAt: null, title: "Fais le point du jour" };
  const view = { session: current, run: null, batches: [], past: [past("pa6")], memoryPath: "" };
  const lot = lotSeven({ id: "b6", runId: "pa6" });
  putBlob(api, await sealJson(keys, "silo", "agent", { view, logs: {}, pastBatches: { pa6: [lot] } }));
  await client.sync();
  expect(await client.rpc({ method: "getProjectAgent", projectId: "silo", runId: "pa7" })).toEqual(view);
  expect(await client.rpc({ method: "getProjectAgent", projectId: "silo", runId: "pa6" })).toEqual({
    ...view,
    session: past("pa6"),
    run: null,
    batches: [lot],
  });
  await expect(
    client.rpc({ method: "getProjectAgent", projectId: "silo", runId: "gone" }),
  ).rejects.toMatchObject({ code: "NOT_FOUND" });
});

test("componentCall data.get/set/keys are served from instance-data (localStorage)", async () => {
  const call = (c: Parameters<typeof client.rpc>[0] extends infer R ? R : never) => client.rpc(c);
  await call({
    method: "componentCall",
    projectId: "silo",
    instanceId: "i1",
    call: { kind: "data.set", key: "zoom", value: 2 },
  });
  expect(
    await call({
      method: "componentCall",
      projectId: "silo",
      instanceId: "i1",
      call: { kind: "data.get", key: "zoom" },
    }),
  ).toBe(2);
  expect(
    await call({ method: "componentCall", projectId: "silo", instanceId: "i1", call: { kind: "data.keys" } }),
  ).toEqual(["zoom"]);
  expect(
    await call({ method: "componentCall", projectId: "silo", instanceId: "i2", call: { kind: "data.keys" } }),
  ).toEqual([]);
  await call({
    method: "componentCall",
    projectId: "silo",
    instanceId: "i1",
    call: { kind: "data.delete", key: "zoom" },
  });
  expect(
    await call({
      method: "componentCall",
      projectId: "silo",
      instanceId: "i1",
      call: { kind: "data.get", key: "zoom" },
    }),
  ).toBeUndefined();
  expect(api.calls).toEqual([]);
});

test("command setStatus is sealed, posted to /api/phone/request and the reply opened", async () => {
  api.reply = () => ({ ok: true, result: { ok: "done" } });
  const command = { method: "setStatus" as const, ticketId: "t1", statusId: "in_progress" as const };
  const result = await client.rpc({ method: "command", projectId: "silo", command });
  expect(result).toEqual({ ok: "done" });
  expect(api.calls).toEqual(["request"]);
  expect(api.requests).toEqual([{ method: "command", projectId: "silo", command }]);
});

test("a refused request keeps the daemon error code", async () => {
  api.reply = () => ({ ok: false, error: { code: "NOT_FOUND", message: "ticket t9 not found" } });
  const command = { method: "setStatus" as const, ticketId: "t9", statusId: "in_progress" as const };
  await expect(client.rpc({ method: "command", projectId: "silo", command })).rejects.toMatchObject({
    code: "NOT_FOUND",
  });
});

test("a method outside REMOTE_METHODS throws FORBIDDEN without a network call", async () => {
  await expect(client.rpc({ method: "deleteProject", projectId: "silo" })).rejects.toMatchObject({
    code: "FORBIDDEN",
  });
  await expect(
    client.rpc({ method: "command", projectId: "silo", command: { method: "deletePage", pageId: "p1" } }),
  ).rejects.toMatchObject({ code: "FORBIDDEN" });
  expect(api.calls).toEqual([]);
});

test("a write while the mac is offline throws REMOTE_UNAVAILABLE without a network call", async () => {
  const refusals: unknown[] = [];
  client.onRefused((r) => refusals.push(r));
  setConnectivity({ macOnline: false, phoneOnline: true });
  await expect(
    client.rpc({ method: "t3.launch", projectId: "silo", ticketKey: "SILO-45" }),
  ).rejects.toMatchObject({ code: "REMOTE_UNAVAILABLE" });
  expect(api.calls).toEqual([]);
  expect(refusals).toEqual([{ reason: "macOff", action: "launch" }]);
  expect((await client.rpc({ method: "getProject", projectId: "silo" })).meta.name).toBe("Silo");
});

test("a 503 from the server becomes REMOTE_UNAVAILABLE", async () => {
  api.status = 503;
  const command = { method: "setStatus" as const, ticketId: "t1", statusId: "in_progress" as const };
  await expect(client.rpc({ method: "command", projectId: "silo", command })).rejects.toMatchObject({
    code: "REMOTE_UNAVAILABLE",
  });
});

test("a request outside the mac clock window is reported as a clock refusal", async () => {
  const refusals: unknown[] = [];
  client.onRefused((r) => refusals.push(r));
  api.reply = () => ({
    ok: false,
    error: { code: "REMOTE_REJECTED", message: REQUEST_CLOCK_REFUSAL },
  });
  const command = { method: "setStatus" as const, ticketId: "t1", statusId: "in_progress" as const };
  await expect(client.rpc({ method: "command", projectId: "silo", command })).rejects.toMatchObject({
    code: "REMOTE_REJECTED",
  });
  expect(refusals).toEqual([{ reason: "clock", action: "write" }]);
});

test("snapshot.changed triggers subscribe listeners after the blob is refetched", async () => {
  const seen: (string | null)[] = [];
  client.subscribe((projectId) => seen.push(projectId));
  putBlob(
    api,
    await sealJson(
      keys,
      "silo",
      "project",
      { ...PROJECT, meta: { ...PROJECT.meta, name: "Silo 2" } },
      { seq: 2 },
    ),
  );
  await client.handleEvent({ type: "snapshot.changed", projectId: "silo", kind: "project", seq: 2 });
  expect(api.calls).toEqual(["snapshot silo project"]);
  expect(seen).toEqual(["silo"]);
  expect((await client.rpc({ method: "getProject", projectId: "silo" })).meta.name).toBe("Silo 2");
});

test("imageUrl returns a blob: URL built from the image snapshot", async () => {
  putBlob(api, await sealJson(keys, "silo", "image:q1:img1", { mime: "image/png", bytes: btoa("png!") }));
  await client.sync();
  await client.rpc({ method: "getProject", projectId: "silo" });
  const url = client.imageUrl("silo", "q1", "img1");
  expect(url.startsWith("blob:")).toBe(true);
  expect(await (await fetch(url)).text()).toBe("png!");
  expect(client.imageUrl("silo", "q1", "missing")).toBe("");
});

test("before its first sync the client presents its state as stale", async () => {
  const fresh = createRemoteClient({
    api,
    keys: () => keys,
    snapshots: createSnapshotStore(memoryStorage().snapshots),
    data: createInstanceData(localStorage),
    presence: { get: () => connectivity, subscribe: () => () => {} },
  });
  expect(fresh.presence().stale).toBe(true);
  await fresh.sync();
  expect(fresh.presence().stale).toBe(false);
});

test("a rejected sync marks the state stale with the block time until a sync succeeds", async () => {
  const seen: boolean[] = [];
  client.onPresence((p) => seen.push(p.stale));
  const snapshot = api.snapshot;
  api.snapshot = async () => {
    throw new KiboError("REMOTE_UNAVAILABLE", "server unreachable");
  };
  await expect(client.sync()).rejects.toMatchObject({ code: "REMOTE_UNAVAILABLE" });
  expect(client.presence()).toMatchObject({
    macOnline: true,
    stale: true,
    lastSnapshotAt: 1_760_619_120_000,
  });
  expect(seen).toContain(true);
  api.snapshot = snapshot;
  await client.sync();
  expect(client.presence().stale).toBe(false);
});

test("a failed snapshot refresh marks the state stale", async () => {
  api.snapshot = async () => {
    throw new KiboError("INTERNAL", "server answered 500");
  };
  await expect(
    client.handleEvent({ type: "snapshot.changed", projectId: "silo", kind: "project", seq: 9 }),
  ).rejects.toMatchObject({ code: "INTERNAL" });
  expect(client.presence().stale).toBe(true);
});

test("a sync downloads only the blocks whose seq is newer than the cached one", async () => {
  putBlob(api, await sealJson(keys, "silo", "image:q1:img1", { mime: "image/png", bytes: btoa("png!") }));
  await client.sync();
  api.calls.length = 0;
  await client.sync();
  expect(api.calls).toEqual(["snapshot _ projects", "headers silo"]);
  putBlob(api, await sealJson(keys, "silo", "project", PROJECT, { seq: 2 }));
  api.calls.length = 0;
  await client.sync();
  expect(api.calls).toEqual(["snapshot _ projects", "headers silo", "snapshot silo project"]);
});

test("a successful event clears the stale band left by a failed one", async () => {
  const snapshot = api.snapshot;
  api.snapshot = async () => {
    throw new KiboError("INTERNAL", "server answered 500");
  };
  await expect(
    client.handleEvent({ type: "snapshot.changed", projectId: "silo", kind: "project", seq: 9 }),
  ).rejects.toMatchObject({ code: "INTERNAL" });
  expect(client.presence().stale).toBe(true);
  api.snapshot = snapshot;
  putBlob(api, await sealJson(keys, "silo", "project", PROJECT, { seq: 9 }));
  await client.handleEvent({ type: "snapshot.changed", projectId: "silo", kind: "project", seq: 9 });
  expect(client.presence().stale).toBe(false);
});

test("coming back to the foreground presents the state as syncing until the next sync", async () => {
  client.markStale();
  expect(client.presence()).toMatchObject({ stale: true, syncing: true });
  await client.handleEvent({ type: "mac.presence", online: true, lastSeenAt: 5 });
  expect(client.presence()).toMatchObject({ stale: true, syncing: true });
  await client.sync();
  expect(client.presence()).toMatchObject({ stale: false, syncing: false });
});

test("a sync that fails after coming back is no longer syncing but stale", async () => {
  client.markStale();
  api.snapshot = async () => {
    throw new KiboError("REMOTE_UNAVAILABLE", "server unreachable");
  };
  await expect(client.sync()).rejects.toMatchObject({ code: "REMOTE_UNAVAILABLE" });
  expect(client.presence()).toMatchObject({ stale: true, syncing: false });
});

test("a write while only the event socket reconnects is sent, and a 503 is refused as mac off", async () => {
  const refusals: unknown[] = [];
  client.onRefused((r) => refusals.push(r));
  setConnectivity({ macOnline: false, phoneOnline: true, reconnecting: true });
  const command = { method: "setStatus" as const, ticketId: "t1", statusId: "in_progress" as const };
  await client.rpc({ method: "command", projectId: "silo", command });
  expect(api.calls).toEqual(["request"]);
  api.status = 503;
  await expect(client.rpc({ method: "command", projectId: "silo", command })).rejects.toMatchObject({
    code: "REMOTE_UNAVAILABLE",
  });
  expect(refusals).toEqual([{ reason: "macOff", action: "write" }]);
});
