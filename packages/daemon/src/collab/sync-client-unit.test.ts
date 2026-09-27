import { afterEach, beforeEach, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { enableServerAllocation, listTickets } from "@kibo/core";
import { parseClientFrame, type ServerFrame } from "@kibo/schema";
import { toBase64 } from "@kibo/trust";
import { LoroDoc } from "loro-crdt";
import { createMemorySecretStore, type MemorySecretStore } from "../integrations/memory-secret-store";
import { createRedactor } from "../integrations/redact";
import { call, createService, type Service } from "../service";
import { openStore, type Store } from "../store";
import { createProjectHosts } from "./project-hosts";
import { SyncClient } from "./sync-client";
import { openSyncDb, type SyncDb } from "./sync-db";
import { type FakeNetwork, fakeNetwork, until } from "./testing/fake-socket";
import type { ProjectHostRegistry } from "./types";

let home: string;
let store: Store;
let service: Service;
let syncDb: SyncDb;
let secrets: MemorySecretStore;
let net: FakeNetwork;
let client: SyncClient;

const joinReply = { ok: true, result: { userId: "u1", deviceId: "d1", name: "Adam" } };
const fakeFetch = Object.assign(async () => Response.json(joinReply), { preconnect: fetch.preconnect });
const input = { serverUrl: "wss://sync.kibo.test", code: "CODE", deviceName: "Adam", caFile: null };
const welcome: ServerFrame = { type: "welcome", userId: "u1", name: "Adam", deviceId: "d1", projects: [] };

beforeEach(() => {
  home = mkdtempSync(join(tmpdir(), "kibo-client-"));
  store = openStore(home);
  service = createService(store, { user: "adam" });
  syncDb = openSyncDb(store.db);
  secrets = createMemorySecretStore(createRedactor());
  net = fakeNetwork();
  client = newClient(createProjectHosts(service.docs, "adam"));
});
function newClient(hosts: ProjectHostRegistry): SyncClient {
  return new SyncClient({
    db: syncDb,
    secrets,
    hosts,
    transport: net.transport,
    fetchImpl: fakeFetch,
    readFile: async () => "",
    now: () => 0,
    random: () => 0,
    setTimer: net.setTimer,
    emit: () => {},
    log: () => {},
  });
}
afterEach(() => {
  client.stop();
  store.close();
  rmSync(home, { recursive: true, force: true });
});

async function online(): Promise<void> {
  const connected = client.connect(input);
  await until(() => net.sockets.length === 1);
  net.last().deliver(welcome);
  await connected;
}

function sharedProject(key = "KIB"): { projectId: string; doc: LoroDoc } {
  const meta = call(service, { method: "createProject", name: key, key, folder: null, color: "#14B8A6" });
  const doc = service.docs.project(meta.id);
  doc.getMap("meta").delete("folder");
  enableServerAllocation(doc);
  client.attachProject(meta.id, "editor");
  const version = toBase64(doc.oplogVersion().encode());
  const bytes = toBase64(doc.export({ mode: "update", from: doc.oplogVersion() }));
  net.last().deliver({ type: "update", projectId: meta.id, bytes, serverSeq: 1, version });
  return { projectId: meta.id, doc };
}

const sentFrames = () => net.last().sent.map((text) => parseClientFrame(text));
const flushBatches = () => {
  for (const timer of net.pending().filter((t) => t.ms === 50)) {
    timer.cancelled = true;
    timer.fn();
  }
};

test("a second connect while the first is running is a conflict", async () => {
  const first = client.connect(input);
  await expect(client.connect(input)).rejects.toMatchObject({ code: "CONFLICT" });
  await until(() => net.sockets.length === 1);
  net.last().deliver(welcome);
  expect((await first).state).toBe("online");
});

test("a websocket failure after joining returns the offline status and keeps retrying", async () => {
  const connected = client.connect(input);
  await until(() => net.sockets.length === 1);
  net.last().drop(1006);
  const status = await connected;
  expect(status).toMatchObject({ state: "offline", serverUrl: "wss://sync.kibo.test" });
  expect(status.retryAt).not.toBeNull();
  expect(syncDb.config()?.deviceId).toBe("d1");
  expect(await secrets.get("sync:device")).not.toBeNull();
});

test("a push refused with FORBIDDEN leaves the project read-only for good", async () => {
  await online();
  const { projectId } = sharedProject();
  await until(() => syncDb.project(projectId)?.lastSyncAt !== null);
  call(service, { method: "command", projectId, command: { method: "createTicket", title: "Refusé" } });
  flushBatches();
  const push = sentFrames().find((f) => f.type === "push");
  if (push?.type !== "push") throw new Error("no push sent");
  const reject = { type: "reject", projectId, clientBatchId: push.clientBatchId, code: "FORBIDDEN" } as const;
  net.last().deliver({ ...reject, message: "forbidden", version: null });
  await until(() => syncDb.project(projectId)?.role === "viewer");
  client.stop();
  await client.start();
  const create = { method: "createTicket", title: "Non" } as const;
  expect(() => service.handle({ method: "command", projectId, command: create })).toThrow("FORBIDDEN");
});

test("an update from the server that nests the project too deep is refused without crashing", async () => {
  await online();
  const { projectId, doc } = sharedProject();
  await until(() => syncDb.project(projectId)?.lastSyncAt !== null);
  const remote = LoroDoc.fromSnapshot(doc.export({ mode: "snapshot" }));
  let node = remote.getTree("tickets").createNode();
  for (let i = 0; i < 100; i++) node = node.createNode();
  remote.commit();
  const bytes = toBase64(remote.export({ mode: "update", from: doc.oplogVersion() }));
  const version = toBase64(remote.oplogVersion().encode());
  net.last().deliver({ type: "update", projectId, bytes, serverSeq: 2, version });
  await until(() => syncDb.project(projectId)?.lastError === "TOO_LARGE");
  expect(syncDb.project(projectId)?.enabled).toBe(false);
  expect(listTickets(service.docs.project(projectId))).toEqual([]);
  expect(sentFrames()).toContainEqual({ type: "unsubscribe", projectId });
  expect(client.status().state).toBe("online");
});

function deepRemote(doc: LoroDoc): LoroDoc {
  const remote = LoroDoc.fromSnapshot(doc.export({ mode: "snapshot" }));
  let node = remote.getTree("tickets").createNode();
  for (let i = 0; i < 100; i++) node = node.createNode();
  remote.commit();
  return remote;
}

async function forceResync(projectId: string): Promise<void> {
  call(service, { method: "command", projectId, command: { method: "createTicket", title: "Refusé" } });
  flushBatches();
  const push = sentFrames().find((f) => f.type === "push");
  if (push?.type !== "push") throw new Error("no push sent");
  const reject = {
    type: "reject",
    projectId,
    clientBatchId: push.clientBatchId,
    code: "UPDATE_REJECTED",
  } as const;
  net.last().deliver({ ...reject, message: "rejected", version: null });
  await until(() => sentFrames().some((f) => f.type === "subscribe" && f.version === null));
}

test("a shallow snapshot sent as the resync stream is refused and suspends the project", async () => {
  await online();
  const { projectId, doc } = sharedProject();
  await until(() => syncDb.project(projectId)?.lastSyncAt !== null);
  const remote = deepRemote(doc);
  const shallow = remote.export({ mode: "shallow-snapshot", frontiers: remote.frontiers() });
  const version = toBase64(remote.oplogVersion().encode());
  await forceResync(projectId);
  net.last().deliver({ type: "update", projectId, bytes: toBase64(shallow), serverSeq: 2, version });
  await until(() => syncDb.project(projectId)?.lastError === "INVALID_INPUT");
  expect(syncDb.project(projectId)?.enabled).toBe(false);
  expect(service.docs.project(projectId)).toBe(doc);
  expect(sentFrames()).toContainEqual({ type: "unsubscribe", projectId });
});

test("a deep update on one project leaves the other project syncing", async () => {
  await online();
  const a = sharedProject("AAA");
  const b = sharedProject("BBB");
  await until(() => syncDb.project(b.projectId)?.lastSyncAt !== null);
  const remote = deepRemote(b.doc);
  const bytes = toBase64(remote.export({ mode: "update", from: b.doc.oplogVersion() }));
  const version = toBase64(remote.oplogVersion().encode());
  net.last().deliver({ type: "update", projectId: b.projectId, bytes, serverSeq: 2, version });
  await until(() => syncDb.project(b.projectId)?.lastError === "TOO_LARGE");
  expect(syncDb.project(a.projectId)).toMatchObject({ enabled: true, lastError: null });
  call(service, {
    method: "command",
    projectId: a.projectId,
    command: { method: "createTicket", title: "A" },
  });
  flushBatches();
  expect(sentFrames().some((f) => f.type === "push" && f.projectId === a.projectId)).toBe(true);
  expect(sentFrames().filter((f) => f.type === "unsubscribe")).toEqual([
    { type: "unsubscribe", projectId: b.projectId },
  ]);
});

test("a failure of the daemon itself while applying an update is reported as INTERNAL", async () => {
  client.stop();
  const real = createProjectHosts(service.docs, "adam");
  client = newClient({
    ...real,
    host: (id) => ({
      ...real.host(id),
      applyRemote: () => {
        throw new Error("disk full");
      },
    }),
  });
  await online();
  const { projectId, doc } = sharedProject();
  await until(() => syncDb.project(projectId)?.lastError === "INTERNAL");
  expect(syncDb.project(projectId)?.enabled).toBe(false);
  expect(service.docs.project(projectId)).toBe(doc);
});

const forged = toBase64(new Uint8Array(64).map((_, i) => (i * 37 + 11) % 256));

test("forged update bytes suspend the project with a stable error", async () => {
  await online();
  const { projectId, doc } = sharedProject();
  await until(() => syncDb.project(projectId)?.lastSyncAt !== null);
  const version = toBase64(doc.oplogVersion().encode());
  net.last().deliver({ type: "update", projectId, bytes: forged, serverSeq: 2, version });
  await until(() => syncDb.project(projectId)?.lastError === "INVALID_INPUT");
  expect(syncDb.project(projectId)?.enabled).toBe(false);
  expect(client.status().state).toBe("online");
});

test("forged bytes received during a resync suspend the project too", async () => {
  await online();
  const { projectId, doc } = sharedProject();
  await until(() => syncDb.project(projectId)?.lastSyncAt !== null);
  call(service, { method: "command", projectId, command: { method: "createTicket", title: "Refusé" } });
  flushBatches();
  const push = sentFrames().find((f) => f.type === "push");
  if (push?.type !== "push") throw new Error("no push sent");
  const reject = {
    type: "reject",
    projectId,
    clientBatchId: push.clientBatchId,
    code: "UPDATE_REJECTED",
  } as const;
  net.last().deliver({ ...reject, message: "rejected", version: null });
  await until(() => sentFrames().some((f) => f.type === "subscribe" && f.version === null));
  const version = toBase64(doc.oplogVersion().encode());
  net.last().deliver({ type: "update", projectId, bytes: forged, serverSeq: 2, version });
  await until(() => syncDb.project(projectId)?.lastError === "INVALID_INPUT");
  expect(syncDb.project(projectId)?.enabled).toBe(false);
});
