import { Database } from "bun:sqlite";
import { beforeEach, expect, test } from "bun:test";
import { CLOSE_CODES, challengePayload, parseClientFrame, type ServerFrame } from "@kibo/schema";
import { verifyBytes } from "@kibo/trust";
import { createMemorySecretStore } from "../integrations/memory-secret-store";
import { createRedactor } from "../integrations/redact";
import type { SecretStore } from "../integrations/types";
import { createDeviceKeys } from "./device-keys";
import { backoffDelay, SyncConnection } from "./sync-connection";
import { openSyncDb, type SyncDb } from "./sync-db";
import type { SyncSocket } from "./transport";

type FakeSocket = SyncSocket & {
  sent: string[];
  closedWith: number | null;
  deliver(frame: ServerFrame): void;
  drop(code: number): void;
};
type FakeTimer = { fn: () => void; ms: number; cancelled: boolean };

const LIMITS = { minMs: 1000, maxMs: 60_000 };
let db: SyncDb;
let secrets: SecretStore;
let sockets: FakeSocket[];
let timers: FakeTimer[];

function fakeSocket(): FakeSocket {
  let onMessage: (text: string) => void = () => {};
  let onClose: (code: number) => void = () => {};
  const socket: FakeSocket = {
    sent: [],
    closedWith: null,
    send: (text) => socket.sent.push(text),
    close: (code) => {
      socket.closedWith = code ?? 1000;
      onClose(socket.closedWith);
    },
    onOpen: () => {},
    onMessage: (fn) => {
      onMessage = fn;
    },
    onClose: (fn) => {
      onClose = fn;
    },
    deliver: (frame) => onMessage(JSON.stringify(frame)),
    drop: (code) => onClose(code),
  };
  return socket;
}

function connection(): SyncConnection {
  return new SyncConnection(
    {
      db,
      secrets,
      transport: {
        open: () => {
          const socket = fakeSocket();
          sockets.push(socket);
          return socket;
        },
      },
      readFile: async () => "",
      now: () => 0,
      random: () => 0,
      setTimer: (fn, ms) => {
        const timer = { fn, ms, cancelled: false };
        timers.push(timer);
        return () => {
          timer.cancelled = true;
        };
      },
      emit: () => {},
      log: () => {},
    },
    LIMITS,
    { frame: () => {}, dropped: () => {} },
  );
}

async function until(predicate: () => boolean): Promise<void> {
  for (let i = 0; i < 200 && !predicate(); i++) await Bun.sleep(5);
  expect(predicate()).toBe(true);
}

const lastSocket = (): FakeSocket => {
  const socket = sockets.at(-1);
  if (!socket) throw new Error("no socket opened");
  return socket;
};
const pendingTimers = () => timers.filter((t) => !t.cancelled);

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
  sockets = [];
  timers = [];
});

test("answers the challenge at once with a signature bound to the server origin", async () => {
  const keys = await createDeviceKeys(secrets);
  const c = connection();
  c.start();
  await until(() => sockets.length === 1);
  lastSocket().deliver({ type: "challenge", nonce: "bm9uY2U=" });
  await until(() => lastSocket().sent.length === 1);
  const auth = parseClientFrame(lastSocket().sent[0] ?? "");
  if (auth.type !== "auth") throw new Error(`unexpected ${auth.type}`);
  expect(auth.deviceId).toBe("d1");
  const payload = challengePayload("bm9uY2U=", "wss://sync.kibo.test");
  expect(await verifyBytes(keys.publicKey, payload, auth.signature)).toBe(true);
});

test("a refused authentication retries after the maximum delay only", async () => {
  await createDeviceKeys(secrets);
  const c = connection();
  c.start();
  await until(() => sockets.length === 1);
  lastSocket().drop(CLOSE_CODES.authFailed);
  expect(c.state).toBe("offline");
  expect(c.lastError).toBe("UNAUTHORIZED");
  expect(pendingTimers().map((t) => t.ms)).toEqual([LIMITS.maxMs]);
  expect(c.retryAt).toBe(LIMITS.maxMs);
  pendingTimers()[0]?.fn();
  await until(() => sockets.length === 2);
});

test("other closes back off from the minimum delay", async () => {
  await createDeviceKeys(secrets);
  const c = connection();
  c.start();
  await until(() => sockets.length === 1);
  lastSocket().drop(1006);
  expect(pendingTimers().map((t) => t.ms)).toEqual([backoffDelay(0, 0, LIMITS)]);
  expect(c.lastError).toBeNull();
});

test("a revoked device stops for good", async () => {
  await createDeviceKeys(secrets);
  const c = connection();
  c.start();
  await until(() => sockets.length === 1);
  lastSocket().drop(CLOSE_CODES.deviceRevoked);
  expect(c.lastError).toBe("DEVICE_REVOKED");
  expect(c.retryAt).toBeNull();
  expect(pendingTimers()).toEqual([]);
});

test("a missing device key closes the socket instead of waiting for the server timeout", async () => {
  const c = connection();
  c.start();
  await until(() => sockets.length === 1);
  lastSocket().deliver({ type: "challenge", nonce: "bm9uY2U=" });
  await until(() => lastSocket().closedWith !== null);
  expect(lastSocket().sent).toEqual([]);
  expect(c.lastError).toBe("UNAUTHORIZED");
  expect(pendingTimers()).toHaveLength(1);
});

test("stop cancels the pending retry and rejects a waiting connect", async () => {
  await createDeviceKeys(secrets);
  const c = connection();
  const online = c.waitOnline();
  c.start();
  await until(() => sockets.length === 1);
  lastSocket().drop(1006);
  await expect(online).rejects.toMatchObject({ code: "SYNC_OFFLINE" });
  c.stop();
  expect(pendingTimers()).toEqual([]);
  expect(c.retryAt).toBeNull();
});
