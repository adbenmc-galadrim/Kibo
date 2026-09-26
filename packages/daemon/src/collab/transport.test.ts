import { afterAll, beforeAll, expect, test } from "bun:test";
import { parseServerFrame } from "@kibo/schema";
import { startTestSyncServer, type TestSyncServer } from "@kibo/sync-server/testing";
import { assertSyncUrl, createWebSocketTransport, type SyncSocket } from "./transport";

test("wss is always accepted", () => {
  expect(assertSyncUrl("wss://sync.kibo.test/v1/sync").hostname).toBe("sync.kibo.test");
});

test("ws is accepted on loopback only", () => {
  expect(assertSyncUrl("ws://127.0.0.1:4400/v1/sync").port).toBe("4400");
  expect(assertSyncUrl("ws://localhost:4400/v1/sync").hostname).toBe("localhost");
  expect(assertSyncUrl("ws://[::1]:4400/v1/sync").hostname).toBe("[::1]");
  expect(() => assertSyncUrl("ws://10.0.0.2:4400/v1/sync")).toThrow("TLS_REQUIRED");
  expect(() => assertSyncUrl("ws://sync.kibo.test/v1/sync")).toThrow("TLS_REQUIRED");
});

test("other schemes and garbage are invalid", () => {
  expect(() => assertSyncUrl("https://sync.kibo.test")).toThrow("INVALID_INPUT");
  expect(() => assertSyncUrl("pas une url")).toThrow("INVALID_INPUT");
});

let server: TestSyncServer;
beforeAll(async () => {
  server = await startTestSyncServer();
});
afterAll(async () => {
  await server.stop();
});

function firstEvent(socket: SyncSocket): Promise<{ message: string } | { closed: number }> {
  return new Promise((resolve) => {
    socket.onMessage((message) => resolve({ message }));
    socket.onClose((closed) => resolve({ closed }));
  });
}

test("a self-signed server is reached with its certificate as extra CA", async () => {
  const socket = createWebSocketTransport().open(`${server.url}/v1/sync`, { ca: server.caPem });
  const event = await firstEvent(socket);
  socket.close(1000);
  if (!("message" in event)) throw new Error(`closed with ${event.closed}`);
  expect(parseServerFrame(event.message).type).toBe("challenge");
});

test("a self-signed server is refused without its certificate", async () => {
  const socket = createWebSocketTransport().open(`${server.url}/v1/sync`, { ca: null });
  const event = await firstEvent(socket);
  expect(event).toMatchObject({ closed: expect.any(Number) });
});
