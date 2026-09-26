import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { createProjectDoc, createTicket, listTickets, migrateForSharing } from "@kibo/core";
import { CLOSE_CODES, MAX_FRAME_BYTES, SYNC_LIMITS } from "@kibo/schema";
import { fromBase64, toBase64 } from "@kibo/trust";
import { EphemeralStore, LoroDoc, VersionVector } from "loro-crdt";
import { startTestSyncServer, type TestSyncServer } from "./testing/start-test-server";
import { addTestDevice, joinTestAccount, TestClient, type TestDevice } from "./testing/ws-client";

let t: TestSyncServer;
let clock = 1_800_000_000_000;
const clients: TestClient[] = [];

beforeEach(async () => {
  t = await startTestSyncServer({ now: () => clock });
});
afterEach(async () => {
  for (const c of clients.splice(0)) c.close();
  await t.stop();
});

async function connect(device: TestDevice): Promise<TestClient> {
  const c = await TestClient.open(t);
  clients.push(c);
  await c.auth(device);
  await c.next("welcome");
  return c;
}

const META = { id: "p-kibo", key: "KIB", name: "Kibo", folder: null, color: "#F97316" };

function ownerDocOf(adam: TestDevice): LoroDoc {
  const doc = createProjectDoc(META);
  createTicket(doc, { title: "Noyau de données" });
  migrateForSharing(doc, { localUser: "adam", userId: adam.userId, domains: [] });
  return doc;
}

async function sharedProject() {
  const adam = await joinTestAccount(t, "Adam");
  const owner = await connect(adam);
  const snapshot = toBase64(ownerDocOf(adam).export({ mode: "snapshot" }));
  owner.send({ type: "share", projectId: META.id, requestId: "s1", name: "Kibo", snapshot });
  await owner.next("shared");
  owner.send({ type: "subscribe", projectId: META.id, version: null });
  const first = await owner.next("update");
  const ownerDoc = new LoroDoc();
  ownerDoc.import(fromBase64(first.bytes));
  return { adam, owner, ownerDoc };
}

async function member(owner: TestClient, name: string, role: "editor" | "viewer") {
  owner.send({ type: "invite", projectId: META.id, requestId: `i-${name}`, role });
  const invite = await owner.next("invite-code", (f) => f.requestId === `i-${name}`);
  const device = await joinTestAccount(t, name);
  const client = await connect(device);
  client.send({ type: "redeem", requestId: "r1", code: invite.code });
  await client.next("joined");
  client.send({ type: "subscribe", projectId: META.id, version: null });
  const update = await client.next("update");
  const doc = new LoroDoc();
  doc.import(fromBase64(update.bytes));
  return { device, client, doc, version: update.version };
}

const pushFrom = (doc: LoroDoc, version: string, id: string) => ({
  type: "push" as const,
  projectId: META.id,
  clientBatchId: id,
  bytes: toBase64(doc.export({ mode: "update", from: VersionVector.decode(fromBase64(version)) })),
});

describe("authentication", () => {
  test("a device receives a challenge then a welcome listing its projects", async () => {
    const { adam } = await sharedProject();
    const again = await connect(adam);
    expect(again.received("welcome")[0]).toMatchObject({
      userId: adam.userId,
      name: "Adam",
      deviceId: adam.deviceId,
      projects: [{ id: META.id, name: "Kibo", role: "owner" }],
    });
  });
  test("a bad signature closes with 4401", async () => {
    const adam = await joinTestAccount(t, "Adam");
    const other = await joinTestAccount(t, "Mallory");
    const c = await TestClient.open(t);
    clients.push(c);
    await c.auth(adam, { privateKey: other.keys.privateKey });
    expect(await c.closed).toBe(CLOSE_CODES.authFailed);
  });
  test("a signature for another origin closes with 4401", async () => {
    const adam = await joinTestAccount(t, "Adam");
    const c = await TestClient.open(t);
    clients.push(c);
    await c.auth(adam, { origin: "wss://evil.test" });
    expect(await c.closed).toBe(CLOSE_CODES.authFailed);
  });
  test("five failures from an IP make the next upgrade answer 429", async () => {
    const adam = await joinTestAccount(t, "Adam");
    const other = await joinTestAccount(t, "Mallory");
    for (let i = 0; i < SYNC_LIMITS.authFailuresPerMinute; i++) {
      const c = await TestClient.open(t);
      await c.auth(adam, { privateKey: other.keys.privateKey });
      await c.closed;
    }
    const res = await fetch(`${t.httpsUrl}/v1/sync`, { tls: { ca: t.caPem } });
    expect(res.status).toBe(429);
    clock += SYNC_LIMITS.authBlockMs + 1;
    const ok = await TestClient.open(t);
    clients.push(ok);
    await ok.auth(adam);
    await ok.next("welcome");
  });
  test("a frame before auth closes with 4401", async () => {
    const c = await TestClient.open(t);
    clients.push(c);
    c.send({ type: "list-devices", requestId: "x" });
    expect(await c.closed).toBe(CLOSE_CODES.authFailed);
  });
  test("a device revoked from another device is closed with 4403", async () => {
    const adam = await joinTestAccount(t, "Adam");
    const imac = await addTestDevice(t, adam, "iMac");
    const first = await connect(adam);
    const second = await connect(imac);
    second.send({ type: "revoke-device", requestId: "rv", deviceId: adam.deviceId });
    await second.next("done");
    expect(await first.closed).toBe(CLOSE_CODES.deviceRevoked);
    second.send({ type: "list-devices", requestId: "ld" });
    const list = await second.next("devices");
    expect(list.devices.find((d) => d.deviceId === adam.deviceId)?.revokedAt).toBe(clock);
  });
  test("a user cannot revoke someone else's device", async () => {
    const adam = await joinTestAccount(t, "Adam");
    const lea = await joinTestAccount(t, "Léa");
    const c = await connect(lea);
    c.send({ type: "revoke-device", requestId: "rv", deviceId: adam.deviceId });
    expect((await c.next("error")).code).toBe("FORBIDDEN");
  });
  test("the 21st connection of a user is closed with 4429", async () => {
    const adam = await joinTestAccount(t, "Adam");
    for (let i = 0; i < SYNC_LIMITS.connectionsPerUser; i++) await connect(adam);
    const extra = await TestClient.open(t);
    clients.push(extra);
    await extra.auth(adam);
    expect(await extra.closed).toBe(CLOSE_CODES.tooManyConnections);
  });
  test("an invalid frame gets an error and keeps the connection", async () => {
    const adam = await joinTestAccount(t, "Adam");
    const c = await connect(adam);
    c.sendRaw("{not json");
    expect(await c.next("error")).toEqual({
      type: "error",
      requestId: null,
      code: "INVALID_INPUT",
      message: "invalid request",
    });
    c.send({ type: "list-devices", requestId: "ok" });
    await c.next("devices");
  });
  test("a frame larger than MAX_FRAME_BYTES is refused by the transport", async () => {
    const adam = await joinTestAccount(t, "Adam");
    const c = await connect(adam);
    c.sendRaw("x".repeat(MAX_FRAME_BYTES + 1));
    expect([1006, 1009]).toContain(await c.closed);
  });
});

describe("projects", () => {
  test("replaying a share by the same owner answers shared again", async () => {
    const { owner } = await sharedProject();
    owner.send({ type: "share", projectId: META.id, requestId: "s2", name: "Kibo", snapshot: "" });
    expect((await owner.next("shared", (f) => f.requestId === "s2")).projectId).toBe(META.id);
  });
  test("sharing a project id owned by someone else is FORBIDDEN", async () => {
    await sharedProject();
    const lea = await connect(await joinTestAccount(t, "Léa"));
    lea.send({ type: "share", projectId: META.id, requestId: "s3", name: "Kibo", snapshot: "" });
    expect((await lea.next("error")).code).toBe("FORBIDDEN");
  });
  test("an invalid snapshot is refused with a message free of internal details", async () => {
    const lea = await connect(await joinTestAccount(t, "Léa"));
    const raw = createProjectDoc({ ...META, id: "p-raw" }).export({ mode: "snapshot" });
    lea.send({ type: "share", projectId: "p-raw", requestId: "s4", name: "Brut", snapshot: toBase64(raw) });
    expect(await lea.next("error")).toEqual({
      type: "error",
      requestId: "s4",
      code: "INVALID_INPUT",
      message: "invalid request",
    });
  });
  test("a non member cannot subscribe", async () => {
    await sharedProject();
    const lea = await connect(await joinTestAccount(t, "Léa"));
    lea.send({ type: "subscribe", projectId: META.id, version: null });
    expect((await lea.next("error")).code).toBe("FORBIDDEN");
  });
  test("an editor ticket reaches the owner with a server key", async () => {
    const { owner, ownerDoc } = await sharedProject();
    const lea = await member(owner, "Léa", "editor");
    createTicket(lea.doc, { title: "Schéma Loro des tickets" });
    lea.client.send(pushFrom(lea.doc, lea.version, "b1"));
    const ack = await lea.client.next("ack", (f) => f.clientBatchId === "b1");
    expect(ack.serverSeq).toBeGreaterThan(0);
    await owner.next("update", (f) => f.serverSeq === ack.serverSeq);
    for (const f of owner.received("update")) if (f.type === "update") ownerDoc.import(fromBase64(f.bytes));
    expect(listTickets(ownerDoc).map((x) => x.key)).toEqual(["KIB-1", "KIB-2"]);
  });
  test("a viewer push is rejected with FORBIDDEN, even an empty one", async () => {
    const { owner } = await sharedProject();
    const viewer = await member(owner, "Tom", "viewer");
    viewer.client.send(pushFrom(viewer.doc, viewer.version, "v0"));
    expect((await viewer.client.next("reject", (f) => f.clientBatchId === "v0")).code).toBe("FORBIDDEN");
    createTicket(viewer.doc, { title: "Interdit" });
    viewer.client.send(pushFrom(viewer.doc, viewer.version, "v1"));
    const reject = await viewer.client.next("reject", (f) => f.clientBatchId === "v1");
    expect(reject.code).toBe("FORBIDDEN");
    expect(viewer.client.received("ack")).toHaveLength(0);
  });
  test("a role lowered to viewer applies to the next push without reconnecting", async () => {
    const { owner } = await sharedProject();
    const lea = await member(owner, "Léa", "editor");
    owner.send({
      type: "set-role",
      projectId: META.id,
      requestId: "lower",
      userId: lea.device.userId,
      role: "viewer",
    });
    await owner.next("done", (f) => f.requestId === "lower");
    createTicket(lea.doc, { title: "Après passage en lecture" });
    lea.client.send(pushFrom(lea.doc, lea.version, "late"));
    expect((await lea.client.next("reject")).code).toBe("FORBIDDEN");
  });
  test("a snapshot pushed as an update is rejected", async () => {
    const { owner, ownerDoc } = await sharedProject();
    createTicket(ownerDoc, { title: "Instantané" });
    owner.send({
      type: "push",
      projectId: META.id,
      clientBatchId: "snap",
      bytes: toBase64(ownerDoc.export({ mode: "snapshot" })),
    });
    const reject = await owner.next("reject");
    expect(reject).toMatchObject({ code: "UPDATE_REJECTED", message: "update rejected" });
  });
  test("an editor writing a ticket key is rejected with UPDATE_REJECTED and audited", async () => {
    const { owner } = await sharedProject();
    const lea = await member(owner, "Léa", "editor");
    const node = lea.doc.getTree("tickets").roots()[0];
    if (!node) throw new Error("no ticket in the shared project");
    node.data.set("key", "KIB-99");
    lea.doc.commit();
    lea.client.send(pushFrom(lea.doc, lea.version, "k1"));
    expect((await lea.client.next("reject")).code).toBe("UPDATE_REJECTED");
    const rows = t.server.sdb.db.query("SELECT kind FROM audit WHERE kind = 'update-rejected'").all();
    expect(rows.length).toBeGreaterThan(0);
  });
  test("the 101st push in the same second is RATE_LIMITED", async () => {
    const { owner, ownerDoc } = await sharedProject();
    const version = toBase64(ownerDoc.oplogVersion().encode());
    for (let i = 0; i <= SYNC_LIMITS.updatesPerSecond; i++) owner.send(pushFrom(ownerDoc, version, `r${i}`));
    const reject = await owner.next("reject", (f) => f.clientBatchId === `r${SYNC_LIMITS.updatesPerSecond}`);
    expect(reject.code).toBe("RATE_LIMITED");
    expect(owner.received("ack")).toHaveLength(SYNC_LIMITS.updatesPerSecond);
  });
  test("removing a member sends revoked and stops its updates", async () => {
    const { owner } = await sharedProject();
    const lea = await member(owner, "Léa", "editor");
    owner.send({
      type: "set-role",
      projectId: META.id,
      requestId: "rm",
      userId: lea.device.userId,
      role: null,
    });
    await owner.next("done", (f) => f.requestId === "rm");
    expect((await lea.client.next("revoked")).reason).toBe("removed");
    createTicket(lea.doc, { title: "Après retrait" });
    lea.client.send(pushFrom(lea.doc, lea.version, "late"));
    expect((await lea.client.next("reject")).code).toBe("FORBIDDEN");
  });
  test("the last owner cannot be removed", async () => {
    const { owner, adam } = await sharedProject();
    owner.send({ type: "set-role", projectId: META.id, requestId: "self", userId: adam.userId, role: null });
    expect((await owner.next("error")).code).toBe("FORBIDDEN");
  });
  test("unshare notifies subscribers and deletes the project", async () => {
    const { owner } = await sharedProject();
    const lea = await member(owner, "Léa", "viewer");
    owner.send({ type: "unshare", projectId: META.id, requestId: "u" });
    await owner.next("done");
    expect((await lea.client.next("revoked")).reason).toBe("deleted");
    expect(t.server.sdb.db.query("SELECT 1 FROM projects WHERE id = $id").get({ id: META.id })).toBeNull();
    expect(
      t.server.sdb.db.query("SELECT 1 FROM updates WHERE projectId = $id").get({ id: META.id }),
    ).toBeNull();
  });
});

describe("presence", () => {
  const state = (userId: string, name: string) => ({ userId, name, pageId: null, ticketId: null, runs: [] });
  const encode = (key: string, value: ReturnType<typeof state>) => {
    const store = new EphemeralStore(30_000);
    store.set(key, value);
    const bytes = store.encodeAll();
    store.destroy();
    return toBase64(bytes);
  };
  test("presence touching another device key is ignored, a valid one is relayed", async () => {
    const { owner, adam } = await sharedProject();
    const lea = await member(owner, "Léa", "editor");
    const leaId = lea.device.deviceId;
    lea.client.send({
      type: "presence",
      projectId: META.id,
      bytes: encode(adam.deviceId, state(adam.userId, "Adam")),
    });
    lea.client.send({
      type: "presence",
      projectId: META.id,
      bytes: encode(leaId, state(adam.userId, "Adam")),
    });
    lea.client.send({
      type: "presence",
      projectId: META.id,
      bytes: encode(leaId, state(lea.device.userId, "Léa")),
    });
    const relayed = await owner.next("presence");
    const store = new EphemeralStore(30_000);
    store.apply(fromBase64(relayed.bytes));
    expect(store.keys()).toEqual([leaId]);
    store.destroy();
    await Bun.sleep(100);
    expect(owner.received("presence")).toHaveLength(1);
  });
  test("a new subscriber receives the current presence", async () => {
    const { owner } = await sharedProject();
    const lea = await member(owner, "Léa", "editor");
    const bytes = encode(lea.device.deviceId, state(lea.device.userId, "Léa"));
    lea.client.send({ type: "presence", projectId: META.id, bytes });
    await owner.next("presence");
    const tom = await member(owner, "Tom", "viewer");
    expect((await tom.client.next("presence")).projectId).toBe(META.id);
  });
  test("a device's presence is withdrawn when it disconnects or loses its role", async () => {
    const { owner } = await sharedProject();
    const shown = new EphemeralStore(30_000);
    const follow = async () => {
      const frame = await owner.next("presence");
      shown.apply(fromBase64(frame.bytes));
    };
    const lea = await member(owner, "Léa", "editor");
    const tom = await member(owner, "Tom", "editor");
    for (const m of [lea, tom]) {
      const bytes = encode(m.device.deviceId, state(m.device.userId, m.device.name));
      m.client.send({ type: "presence", projectId: META.id, bytes });
      await follow();
    }
    expect(shown.keys().sort()).toEqual([lea.device.deviceId, tom.device.deviceId].sort());
    await Bun.sleep(5);
    lea.client.close();
    await follow();
    expect(shown.keys()).toEqual([tom.device.deviceId]);
    await Bun.sleep(5);
    owner.send({
      type: "set-role",
      projectId: META.id,
      requestId: "rm",
      userId: tom.device.userId,
      role: null,
    });
    await follow();
    expect(shown.keys()).toEqual([]);
    shown.destroy();
    const late = await member(owner, "Zoé", "viewer");
    await Bun.sleep(50);
    expect(late.client.received("presence")).toHaveLength(0);
  });
});
