import { afterEach, beforeEach, expect, test } from "bun:test";
import { createEventLog } from "../integrations/events";
import { createMemorySecretStore } from "../integrations/memory-secret-store";
import { createRedactor } from "../integrations/redact";
import { createFakeHost, type FakeHost } from "../integrations/testing/fake-host";
import { createMcpGate } from "./component-gate";
import { createMcpHub, type McpHub } from "./hub";

let host: FakeHost;
let hub: McpHub;
beforeEach(() => {
  host = createFakeHost();
  hub = createMcpHub({
    host,
    secrets: createMemorySecretStore(createRedactor()),
    events: createEventLog(host.db, createRedactor(), host.now),
    redact: (t) => t,
  });
});
afterEach(async () => {
  await hub.stop();
  host.close();
});

test("components never reach a reserved server", async () => {
  const gate = createMcpGate(hub, host);
  const ctx = { projectId: host.projectId, instanceId: "i1" };
  await expect(gate.call(ctx, "figma", "get_metadata", {})).rejects.toThrow("PERMISSION_DENIED");
  await expect(gate.read(ctx, "figma", "x://y")).rejects.toThrow("PERMISSION_DENIED");
});

test("importing an item twice returns the same ticket", async () => {
  const gate = createMcpGate(hub, host);
  const ctx = { projectId: host.projectId, instanceId: "i1" };
  const item = { itemId: "a1", title: "Premier", url: "https://example.com/a1" };
  const a = await gate.importItem(ctx, "ctx", item);
  const b = await gate.importItem(ctx, "ctx", item);
  expect(b.id).toBe(a.id);
  expect(a.externalRefs).toEqual([
    { kind: "mcp_item", server: "ctx", itemId: "a1", url: "https://example.com/a1", title: "Premier" },
  ]);
});
