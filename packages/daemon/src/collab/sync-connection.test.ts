import { Database } from "bun:sqlite";
import { beforeEach, expect, test } from "bun:test";
import { CLOSE_CODES, challengePayload, parseClientFrame } from "@kibo/schema";
import { verifyBytes } from "@kibo/trust";
import { createMemorySecretStore } from "../integrations/memory-secret-store";
import { createRedactor } from "../integrations/redact";
import type { SecretStore } from "../integrations/types";
import { createDeviceKeys } from "./device-keys";
import { backoffDelay, HANDSHAKE_TIMEOUT_MS, SyncConnection } from "./sync-connection";
import { openSyncDb, type SyncDb } from "./sync-db";
import { type FakeNetwork, fakeNetwork, until } from "./testing/fake-socket";

const LIMITS = { minMs: 1000, maxMs: 60_000 };
let db: SyncDb;
let secrets: SecretStore;
let net: FakeNetwork;

function connection(): SyncConnection {
  return new SyncConnection(
    {
      db,
      secrets,
      transport: net.transport,
      readFile: async () => "",
      now: () => 0,
      random: () => 0,
      setTimer: net.setTimer,
      emit: () => {},
      log: () => {},
    },
    LIMITS,
    { frame: () => {}, dropped: () => {} },
  );
}

beforeEach(() => {
  db = openSyncDb(new Database(":memory:", { strict: true }));
  db.setConfig({
    serverUrl: "wss://sync.kibo.test",
    caFile: null,
    userId: "u1",
    deviceId: "d1",
    displayName: "Adam",
  });
  secrets = createMemorySecretStore(createRedactor());
  net = fakeNetwork();
});

test("answers the challenge at once with a signature bound to the server origin", async () => {
  const keys = await createDeviceKeys(secrets);
  const c = connection();
  c.start();
  await until(() => net.sockets.length === 1);
  net.last().deliver({ type: "challenge", nonce: "bm9uY2U=" });
  await until(() => net.last().sent.length === 1);
  const auth = parseClientFrame(net.last().sent[0] ?? "");
  if (auth.type !== "auth") throw new Error(`unexpected ${auth.type}`);
  expect(auth.deviceId).toBe("d1");
  const payload = challengePayload("bm9uY2U=", "wss://sync.kibo.test");
  expect(await verifyBytes(keys.publicKey, payload, auth.signature)).toBe(true);
});

test("a refused authentication retries after the maximum delay only", async () => {
  await createDeviceKeys(secrets);
  const c = connection();
  c.start();
  await until(() => net.sockets.length === 1);
  net.last().drop(CLOSE_CODES.authFailed);
  expect(c.state).toBe("offline");
  expect(c.lastError).toBe("UNAUTHORIZED");
  expect(net.pending().map((t) => t.ms)).toEqual([LIMITS.maxMs]);
  expect(c.retryAt).toBe(LIMITS.maxMs);
  net.pending()[0]?.fn();
  await until(() => net.sockets.length === 2);
});

test("other closes back off from the minimum delay", async () => {
  await createDeviceKeys(secrets);
  const c = connection();
  c.start();
  await until(() => net.sockets.length === 1);
  net.last().drop(1006);
  expect(net.pending().map((t) => t.ms)).toEqual([backoffDelay(0, 0, LIMITS)]);
  expect(c.lastError).toBeNull();
});

test("a revoked device stops for good", async () => {
  await createDeviceKeys(secrets);
  const c = connection();
  c.start();
  await until(() => net.sockets.length === 1);
  net.last().drop(CLOSE_CODES.deviceRevoked);
  expect(c.lastError).toBe("DEVICE_REVOKED");
  expect(c.retryAt).toBeNull();
  expect(net.pending()).toEqual([]);
});

test("a missing device key closes the socket instead of waiting for the server timeout", async () => {
  const c = connection();
  c.start();
  await until(() => net.sockets.length === 1);
  net.last().deliver({ type: "challenge", nonce: "bm9uY2U=" });
  await until(() => net.last().closedWith !== null);
  expect(net.last().sent).toEqual([]);
  expect(c.lastError).toBe("UNAUTHORIZED");
  expect(net.pending()).toHaveLength(1);
});

test("stop cancels the pending retry and rejects a waiting connect", async () => {
  await createDeviceKeys(secrets);
  const c = connection();
  const online = c.waitOnline();
  c.start();
  await until(() => net.sockets.length === 1);
  net.last().drop(1006);
  await expect(online).rejects.toMatchObject({ code: "SYNC_OFFLINE" });
  c.stop();
  expect(net.pending()).toEqual([]);
  expect(c.retryAt).toBeNull();
});

test("a server that never completes the handshake is dropped and retried", async () => {
  await createDeviceKeys(secrets);
  const c = connection();
  const online = c.waitOnline();
  c.start();
  await until(() => net.sockets.length === 1);
  const handshake = net.pending().find((t) => t.ms === HANDSHAKE_TIMEOUT_MS);
  if (!handshake) throw new Error("no handshake timer");
  handshake.fn();
  await expect(online).rejects.toMatchObject({ code: "SYNC_OFFLINE" });
  expect(net.last().closedWith).toBe(1000);
  expect(c.state).toBe("offline");
  expect(c.lastError).toBe("SYNC_OFFLINE");
  expect(net.pending().map((t) => t.ms)).toContain(backoffDelay(0, 0, LIMITS));
});

test("the handshake timer is cancelled once the server welcomes the device", async () => {
  await createDeviceKeys(secrets);
  const c = connection();
  c.start();
  await until(() => net.sockets.length === 1);
  net.last().deliver({ type: "welcome", userId: "u1", name: "Adam", deviceId: "d1", projects: [] });
  await until(() => c.state === "online");
  expect(net.pending()).toEqual([]);
});
