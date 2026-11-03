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
  const answer = await phoneRequest(r, r.keys, { method: "getProject", projectId: "silo" });
  expect(answer).toEqual({ ok: true, result: { id: "silo" } });
  expect(r.calls).toEqual([{ method: "getProject", projectId: "silo" }]);
});

test("a replayed request is executed once", async () => {
  const r = await rig();
  const requestId = crypto.randomUUID();
  const body: RpcRequest = { method: "getProject", projectId: "silo" };
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
  expect(await phoneRequest(r, stranger, { method: "getProject", projectId: "silo" })).toMatchObject({
    ok: false,
    error: { code: "REMOTE_REJECTED" },
  });
  expect(r.calls).toEqual([]);
});
