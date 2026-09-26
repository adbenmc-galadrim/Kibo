import { expect, test } from "bun:test";
import { assertSyncUrl } from "./transport";

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
