import { afterEach, beforeEach, expect, test } from "bun:test";
import type { McpServerInput } from "@kibo/schema";
import { createEventLog } from "../integrations/events";
import { createMemorySecretStore } from "../integrations/memory-secret-store";
import { createRedactor } from "../integrations/redact";
import { createFakeHost, type FakeHost } from "../integrations/testing/fake-host";
import { startFakeMcpHttp } from "../testing/fake-mcp";
import { commandLineOf } from "./command-line";
import { createMcpHub, type McpHub } from "./hub";
import { mcpModule } from "./module";

let host: FakeHost;
let hub: McpHub;
const make = () => {
  const redactor = createRedactor();
  return createMcpHub({
    host,
    secrets: createMemorySecretStore(redactor),
    events: createEventLog(host.db, redactor, host.now),
    redact: redactor.redact,
  });
};
beforeEach(() => {
  host = createFakeHost();
  hub = make();
});
afterEach(async () => {
  await hub.stop();
  host.close();
});

test("the mcp row names the failing servers only, without raw details", async () => {
  const doomed = await startFakeMcpHttp();
  const dead: McpServerInput = {
    transport: "http",
    id: "sentry-staging",
    name: "S",
    url: doomed.url,
    bearer: false,
  };
  await hub.add(dead, commandLineOf(dead), {});
  await doomed.stop();
  await hub.stop();
  hub = make();
  const probe = mcpModule({ host }, hub).probes?.[0];
  expect(await probe?.status()).toMatchObject({
    state: "error",
    servers: ["sentry-staging"],
    error: { code: "MCP_UNAVAILABLE", message: "sentry-staging" },
  });
});

test("disconnecting the mcp row disables every server and keeps their config", async () => {
  const server = await startFakeMcpHttp();
  const input: McpServerInput = {
    transport: "http",
    id: "sentry",
    name: "Sentry",
    url: server.url,
    bearer: false,
  };
  await hub.add(input, commandLineOf(input), {});
  const probe = mcpModule({ host }, hub).probes?.[0];
  await probe?.disconnect?.();
  expect(await hub.views()).toMatchObject([{ id: "sentry", enabled: false }]);
  expect(await probe?.status()).toMatchObject({ state: "disconnected" });
  expect(host.events).toContainEqual({ type: "integrations" });
  await server.stop();
});
