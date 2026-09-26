import { afterEach, beforeEach, expect, spyOn, test } from "bun:test";
import { CLOSE_CODES, challengePayload, MAX_FRAME_BYTES, type ServerFrame } from "@kibo/schema";
import { generateKeyPair, type KeyPair, signBytes } from "@kibo/trust";
import { createInvite, disableUser, redeemDeviceInvite, revokeDevice } from "./accounts";
import { CHALLENGE_TTL_MS } from "./auth";
import { openServerDb, type ServerDb } from "./db";
import { type HubConnection, SyncHub } from "./hub";
import { insertProject } from "./members";
import { RoomRegistry } from "./rooms";

const ORIGIN = "wss://sync.kibo.test";
let now = 1_800_000_000_000;
let sdb: ServerDb;
let hub: SyncHub;

type Device = { userId: string; deviceId: string; keys: KeyPair };

class FakeConnection implements HubConnection {
  readonly ip = "203.0.113.9";
  readonly frames: ServerFrame[] = [];
  closedWith: number | null = null;

  constructor(readonly id: string) {}

  send(frame: ServerFrame): void {
    this.frames.push(frame);
  }

  close(code: number): void {
    this.closedWith = code;
  }

  last(): ServerFrame | undefined {
    return this.frames.at(-1);
  }

  nonce(): string {
    const challenge = this.frames.find((f) => f.type === "challenge");
    if (challenge?.type !== "challenge") throw new Error("no challenge");
    return challenge.nonce;
  }
}

class BrokenRooms extends RoomRegistry {
  override get(): never {
    throw new Error("disk failure at /var/lib/kibo-sync/sync.db");
  }
}

beforeEach(() => {
  sdb = openServerDb(":memory:");
  hub = new SyncHub({
    sdb,
    rooms: new RoomRegistry(sdb, { now: () => now, unloadAfterMs: 60_000 }),
    origin: ORIGIN,
    now: () => now,
  });
});
afterEach(() => sdb.close());

async function device(name: string): Promise<Device> {
  const invite = await createInvite(sdb, { kind: "account", name, createdBy: "admin" }, now);
  const keys = await generateKeyPair();
  const joined = await redeemDeviceInvite(
    sdb,
    { code: invite.code, publicKey: keys.publicKey, deviceName: "Mac" },
    now,
  );
  return { userId: joined.userId, deviceId: joined.deviceId, keys };
}

async function authFrame(conn: FakeConnection, d: Device): Promise<string> {
  const signature = await signBytes(d.keys.privateKey, challengePayload(conn.nonce(), ORIGIN));
  return JSON.stringify({ type: "auth", deviceId: d.deviceId, signature });
}

async function connected(d: Device, id = crypto.randomUUID()): Promise<FakeConnection> {
  const conn = new FakeConnection(id);
  hub.open(conn);
  await hub.message(conn, await authFrame(conn, d));
  expect(conn.last()?.type).toBe("welcome");
  return conn;
}

test("a challenge is single use and expires", async () => {
  const adam = await device("Adam");
  const late = new FakeConnection("late");
  hub.open(late);
  expect(hub.challenges.size).toBe(1);
  now += CHALLENGE_TTL_MS + 1;
  await hub.message(late, await authFrame(late, adam));
  expect(late.closedWith).toBe(CLOSE_CODES.authFailed);
  expect(hub.challenges.size).toBe(0);
  const conn = await connected(adam);
  expect(hub.challenges.size).toBe(0);
  await hub.message(conn, await authFrame(conn, adam));
  expect(conn.last()).toMatchObject({ type: "error", code: "INVALID_INPUT" });
});

test("a connection closed before auth releases its challenge", () => {
  const conn = new FakeConnection("gone");
  hub.open(conn);
  hub.closed(conn);
  expect(hub.challenges.size).toBe(0);
});

test("an oversized frame is refused before any parsing", async () => {
  const conn = await connected(await device("Adam"));
  const parse = spyOn(JSON, "parse");
  await hub.message(conn, `{"type":"list-devices","requestId":"${"x".repeat(MAX_FRAME_BYTES)}"}`);
  expect(parse).not.toHaveBeenCalled();
  parse.mockRestore();
  expect(conn.last()).toEqual({
    type: "error",
    requestId: null,
    code: "INVALID_INPUT",
    message: "invalid request",
  });
});

test("an unexpected failure answers INTERNAL without details and is logged", async () => {
  const logged = spyOn(console, "error").mockImplementation(() => {});
  hub = new SyncHub({
    sdb,
    rooms: new BrokenRooms(sdb, { now: () => now, unloadAfterMs: 60_000 }),
    origin: ORIGIN,
    now: () => now,
  });
  const adam = await device("Adam");
  insertProject(sdb, { id: "p1", ownerId: adam.userId, name: "Kibo", ticketSeq: 0 }, now);
  const conn = await connected(adam);
  await hub.message(conn, JSON.stringify({ type: "subscribe", projectId: "p1", version: null }));
  expect(conn.last()).toEqual({
    type: "error",
    requestId: null,
    code: "INTERNAL",
    message: "internal error",
  });
  expect(logged).toHaveBeenCalled();
  logged.mockRestore();
});

test("a domain error keeps its code but never its internal detail", async () => {
  const conn = await connected(await device("Adam"));
  await hub.message(conn, JSON.stringify({ type: "redeem", requestId: "r", code: "AAAA-BBBB" }));
  expect(conn.last()).toEqual({
    type: "error",
    requestId: "r",
    code: "INVITE_INVALID",
    message: "invite code is invalid, expired or already used",
  });
});

test("a revocation from the CLI closes live connections at the next check", async () => {
  const adam = await device("Adam");
  const lea = await device("Léa");
  const first = await connected(adam);
  const second = await connected(lea);
  revokeDevice(sdb, { deviceId: adam.deviceId, by: "admin" }, now);
  disableUser(sdb, lea.userId, now);
  hub.checkRevocations();
  expect(first.closedWith).toBe(CLOSE_CODES.deviceRevoked);
  expect(second.closedWith).toBe(CLOSE_CODES.deviceRevoked);
});

test("a frame from a device revoked meanwhile closes with 4403", async () => {
  const adam = await device("Adam");
  const conn = await connected(adam);
  revokeDevice(sdb, { deviceId: adam.deviceId, by: "admin" }, now);
  await hub.message(conn, JSON.stringify({ type: "list-devices", requestId: "l" }));
  expect(conn.closedWith).toBe(CLOSE_CODES.deviceRevoked);
  expect(conn.last()?.type).toBe("welcome");
});

test("a revoked device reconnecting does not block its address", async () => {
  const adam = await device("Adam");
  revokeDevice(sdb, { deviceId: adam.deviceId, by: "admin" }, now);
  for (let i = 0; i < 10; i++) {
    const conn = new FakeConnection(`r${i}`);
    hub.open(conn);
    await hub.message(conn, await authFrame(conn, adam));
    expect(conn.closedWith).toBe(CLOSE_CODES.deviceRevoked);
  }
  expect(hub.failures.blocked("203.0.113.9")).toBe(false);
});
