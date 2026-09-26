import { afterEach, beforeEach, expect, test } from "bun:test";
import { createEventLog } from "../integrations/events";
import { createMemorySecretStore } from "../integrations/memory-secret-store";
import { createRedactor } from "../integrations/redact";
import { createFakeHost, type FakeHost } from "../integrations/testing/fake-host";
import { commandLineOf } from "./command-line";
import { createMcpHub, type McpHub } from "./hub";
import { pidsMatching, stubbornServer, survivors } from "./processes.test-helper";

let host: FakeHost;
let hub: McpHub;
beforeEach(() => {
  host = createFakeHost();
  const redactor = createRedactor();
  hub = createMcpHub({
    host,
    secrets: createMemorySecretStore(redactor),
    events: createEventLog(host.db, redactor, host.now),
    redact: redactor.redact,
  });
});
afterEach(async () => {
  await hub.stop();
  host.close();
});

test("removing a server kills its whole process group, even one ignoring SIGTERM", async () => {
  const marker = `kibo-mcp-remove-${crypto.randomUUID()}`;
  const server = stubbornServer("stubborn", marker);
  expect((await hub.add(server, commandLineOf(server), {})).state).toBe("connected");
  const pids = pidsMatching(marker);
  expect(pids).toHaveLength(2);
  await hub.remove("stubborn");
  expect(await survivors(pids)).toEqual([]);
}, 10_000);

test("stopping the hub kills every server and refuses new connections", async () => {
  const marker = `kibo-mcp-stop-${crypto.randomUUID()}`;
  const server = stubbornServer("stubborn", marker);
  await hub.add(server, commandLineOf(server), {});
  const pids = pidsMatching(marker);
  expect(pids).toHaveLength(2);
  await hub.stop();
  expect(await survivors(pids)).toEqual([]);
  await expect(hub.tools("stubborn")).rejects.toThrow("MCP_UNAVAILABLE");
}, 10_000);
