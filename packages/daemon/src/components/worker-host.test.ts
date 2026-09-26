import { afterEach, expect, test } from "bun:test";
import { MIGRATIONS_JS, SERVER_JS, TEST_MANIFEST } from "./backend-code.test-helper";
import type { BackendHost, InvokeRequest } from "./host-core";
import { createWorkerHost } from "./worker-host";

const hosts: BackendHost[] = [];
afterEach(() => {
  for (const h of hosts.splice(0)) h.stop();
});

const request = (instanceId: string, action: string): InvokeRequest => ({
  projectId: "p",
  instanceId,
  config: {},
  target: { action },
  input: null,
});

test("a trusted backend runs in a worker with the same protocol", async () => {
  const seen: string[] = [];
  const h = createWorkerHost({
    ref: "probe@0.1.0",
    manifest: TEST_MANIFEST,
    code: { server: SERVER_JS, migrations: null },
    onCall: async (_p, instanceId) => {
      seen.push(instanceId);
      return [];
    },
  });
  hosts.push(h);
  expect(await h.invoke(request("i1", "ping"))).toBe("pong");
  expect(await h.invoke(request("i2", "tickets"))).toEqual([]);
  expect(seen).toEqual(["i2"]);
});

test("a worker backend runs migrations and times out like a process", async () => {
  const h = createWorkerHost({
    ref: "probe@0.1.0",
    manifest: TEST_MANIFEST,
    code: { server: SERVER_JS, migrations: MIGRATIONS_JS },
    onCall: async () => null,
    timeoutMs: 200,
  });
  hosts.push(h);
  const migrate: InvokeRequest = {
    ...request("i1", "ping"),
    target: { migrate: { from: 1, to: 2, config: {}, data: { a: 1 } } },
  };
  expect(await h.invoke(migrate)).toEqual({ config: {}, data: { a: 1, moved: true } });
  await expect(h.invoke(request("i1", "hang"))).rejects.toThrow("TIMEOUT");
  expect(h.running).toBe(false);
  expect(await h.invoke(request("i1", "ping"))).toBe("pong");
});
