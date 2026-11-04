import { afterEach, expect, test } from "bun:test";
import {
  deriveKeys,
  generateRootKey,
  openRequest,
  type RemoteKeys,
  SealedRequest,
  type ServerMessage,
  sealRequest,
} from "@kibo/remote";
import { connectFakeMac, startTestServer, TEST_ORIGIN, type TestServer } from "@kibo/remote-server/testing";
import type { RpcRequest } from "@kibo/schema";
import { z } from "zod";
import { openConnection, type RemoteConnection } from "./connection";
import { createFakeTimers, type FakeTimers } from "./fake-timers.test-helper";
import { createReplayGuard } from "./replay-guard";
import { createRequestHandler } from "./request-handler";

const cleanups: (() => Promise<unknown> | unknown)[] = [];
afterEach(async () => {
  for (const clean of cleanups.splice(0).reverse()) await clean();
});

const Relayed = z.object({ sealed: SealedRequest });
const utf8 = new TextEncoder();

async function until(check: () => boolean, timeoutMs = 3_000): Promise<void> {
  const end = Date.now() + timeoutMs;
  while (!check()) {
    if (Date.now() > end) throw new Error("condition not reached");
    await Bun.sleep(10);
  }
}

type Rig = {
  server: TestServer;
  timers: FakeTimers;
  keys: RemoteKeys;
  accountId: string;
  macToken: string;
  connection: RemoteConnection;
  received: ServerMessage[];
  opens: () => number;
  calls: RpcRequest[];
};

async function rig(server?: TestServer): Promise<Rig> {
  const srv = server ?? (await startTestServer());
  if (!server) cleanups.push(() => srv.stop());
  const { macToken, accountId } = await srv.registerMac();
  const timers = createFakeTimers();
  const keys = await deriveKeys(generateRootKey(), accountId, 1);
  const received: ServerMessage[] = [];
  const calls: RpcRequest[] = [];
  let opens = 0;
  const handle = createRequestHandler({
    keys: () => keys,
    gate: {
      dispatch: async (req) => {
        calls.push(req);
        return { id: "silo" };
      },
      seen: createReplayGuard(),
      startedAt: 0,
      now: timers.now,
      redact: (text) => text,
    },
  });
  const connection = openConnection({
    serverUrl: srv.url,
    macToken,
    timers,
    now: timers.now,
    log: () => {},
    onOpen: () => {
      opens++;
    },
    onMessage: (message) => {
      received.push(message);
      if (message.type !== "request") return;
      void handle(message).then((reply) => reply && connection.send(reply));
    },
  });
  cleanups.push(() => connection.close());
  expect(await connection.opened(3_000)).toBe(true);
  return { server: srv, timers, keys, accountId, macToken, connection, received, opens: () => opens, calls };
}

async function phoneRequest(r: Rig, keys: RemoteKeys, body: RpcRequest, requestId = crypto.randomUUID()) {
  const header = { v: 1 as const, requestId, projectId: "silo", at: r.timers.now(), keyEpoch: keys.epoch };
  const sealed = await sealRequest(keys, header, utf8.encode(JSON.stringify(body)));
  const res = await fetch(`${r.server.url}/api/phone/request`, {
    method: "POST",
    headers: { "content-type": "application/json", cookie: r.server.phoneCookie(), origin: TEST_ORIGIN },
    body: JSON.stringify({ sealed }),
  });
  expect(res.status).toBe(200);
  const reply = Relayed.parse(await res.json()).sealed;
  return JSON.parse(new TextDecoder().decode(await openRequest(r.keys, reply)));
}

test("connects with the mac token and sends ping every 30 s", async () => {
  const r = await rig();
  expect(r.connection.connected()).toBe(true);
  await r.timers.advance(29_999);
  expect(r.received).toEqual([]);
  await r.timers.advance(1);
  await until(() => r.received.length === 1);
  await r.timers.advance(30_000);
  await until(() => r.received.length === 2);
  expect(r.received.map((m) => m.type)).toEqual(["pong", "pong"]);
});

test("reconnects with backoff 1 s, 2 s, 4 s … 60 s after a close and pushes everything again", async () => {
  const server = await startTestServer();
  const r = await rig(server);
  expect(r.opens()).toBe(1);
  await server.stop();
  await until(() => !r.connection.connected() && r.timers.delays().length === 1);
  const delays: number[] = [];
  for (let i = 0; i < 8; i++) {
    const [delay = 0] = r.timers.delays();
    delays.push(delay);
    await r.timers.advance(delay);
    await until(() => r.timers.delays().length === 1);
  }
  expect(delays).toEqual([1_000, 2_000, 4_000, 8_000, 16_000, 32_000, 60_000, 60_000]);
});

test("a close by the server is followed by a reconnection that triggers a full push", async () => {
  const r = await rig();
  const other = await connectFakeMac(r.server.url, r.macToken);
  cleanups.push(() => other.close());
  await until(() => !r.connection.connected());
  expect(r.timers.delays()).toEqual([1_000]);
  await r.timers.advance(1_000);
  await until(() => r.opens() === 2);
  expect(r.connection.connected()).toBe(true);
});

test("a request message is decrypted, handled through the gate and answered with request.reply", async () => {
  const r = await rig();
  const answer = await phoneRequest(r, r.keys, { method: "getSession" });
  expect(answer).toEqual({ ok: true, result: { id: "silo" } });
  expect(r.calls).toEqual([{ method: "getSession" }]);
});

test("a replayed request is executed once", async () => {
  const r = await rig();
  const requestId = crypto.randomUUID();
  const body: RpcRequest = { method: "getSession" };
  expect(await phoneRequest(r, r.keys, body, requestId)).toMatchObject({ ok: true });
  expect(await phoneRequest(r, r.keys, body, requestId)).toMatchObject({
    ok: false,
    error: { code: "REMOTE_REJECTED" },
  });
  expect(r.calls).toHaveLength(1);
});

test("a request sealed with another key is answered { ok: false, error: REMOTE_REJECTED }", async () => {
  const r = await rig();
  const stranger = await deriveKeys(generateRootKey(), r.accountId, 1);
  expect(await phoneRequest(r, stranger, { method: "getSession" })).toMatchObject({
    ok: false,
    error: { code: "REMOTE_REJECTED" },
  });
  expect(r.calls).toEqual([]);
});

function silentServer() {
  let opens = 0;
  const received: string[] = [];
  const server = Bun.serve({
    port: 0,
    hostname: "127.0.0.1",
    fetch: (req, srv) => (srv.upgrade(req) ? undefined : new Response("no", { status: 400 })),
    websocket: {
      open: () => {
        opens++;
      },
      message: (_ws, data) => {
        received.push(String(data));
      },
    },
  });
  cleanups.push(() => server.stop(true));
  return { url: `http://127.0.0.1:${server.port}`, opens: () => opens, received };
}

function silentConnection(url: string) {
  const timers = createFakeTimers();
  let opens = 0;
  const connection = openConnection({
    serverUrl: url,
    macToken: "token",
    timers,
    now: timers.now,
    log: () => {},
    onOpen: () => {
      opens++;
    },
    onMessage: () => {},
  });
  cleanups.push(() => connection.close());
  return { timers, connection, opens: () => opens };
}

test("a link without pong for 2 pings is closed and reopened, which pushes everything again", async () => {
  const server = silentServer();
  const c = silentConnection(server.url);
  expect(await c.connection.opened(3_000)).toBe(true);
  await c.timers.advance(30_000);
  await until(() => server.received.length === 1);
  expect(c.connection.connected()).toBe(true);
  await c.timers.advance(30_000);
  expect(c.connection.connected()).toBe(false);
  expect(c.timers.delays()).toEqual([1_000]);
  await c.timers.advance(1_000);
  await until(() => c.opens() === 2 && server.opens() === 2);
  expect(c.connection.connected()).toBe(true);
});

test("sendConfirmed resolves true once the server answered the ping sent after the message", async () => {
  const r = await rig();
  expect(await r.connection.sendConfirmed({ type: "pair.create" }, 3_000)).toBe(true);
  expect(r.received.map((m) => m.type)).toEqual(["pair.created", "pong"]);
});

test("sendConfirmed resolves false when no pong comes back in time", async () => {
  const server = silentServer();
  const c = silentConnection(server.url);
  expect(await c.connection.opened(3_000)).toBe(true);
  expect(await c.connection.sendConfirmed({ type: "phone.revoke" }, 200)).toBe(false);
  expect(server.received.map((raw) => JSON.parse(raw).type)).toEqual(["phone.revoke", "ping"]);
});

test("sendConfirmed resolves false at once when the link is closed", async () => {
  const server = silentServer();
  const c = silentConnection(server.url);
  c.connection.close();
  expect(await c.connection.sendConfirmed({ type: "phone.revoke" }, 3_000)).toBe(false);
});
