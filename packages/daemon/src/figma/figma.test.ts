import { afterEach, beforeEach, expect, test } from "bun:test";
import { statSync } from "node:fs";
import { createEventLog } from "../integrations/events";
import { createMemorySecretStore } from "../integrations/memory-secret-store";
import { createRedactor } from "../integrations/redact";
import { createSettings } from "../integrations/settings";
import { createFakeHost, type FakeHost } from "../integrations/testing/fake-host";
import { createMcpHub, type McpHub } from "../mcp/hub";
import { FAKE_PNG_BASE64, startFakeMcpHttp } from "../testing/fake-mcp";
import { createFigma, type Figma } from "./figma";

let host: FakeHost;
let hub: McpHub;
let figma: Figma;
let server: Awaited<ReturnType<typeof startFakeMcpHttp>>;
const USER = { origin: "user" as const, instanceId: null };

beforeEach(async () => {
  server = await startFakeMcpHttp();
  host = createFakeHost();
  const events = createEventLog(host.db, createRedactor(), host.now);
  hub = createMcpHub({ host, secrets: createMemorySecretStore(createRedactor()), events, redact: (t) => t });
  figma = createFigma({ host, hub, settings: createSettings(host.db), events });
});
afterEach(async () => {
  await hub.stop();
  await server.stop();
  host.close();
});

const calls = () =>
  (host.db.query("SELECT tool FROM mcp_calls WHERE server = 'figma'").all() as { tool: string }[]).map(
    (r) => r.tool,
  );

test("configuring checks reachability and the expected tools", async () => {
  await expect(figma.configure("http://127.0.0.1:1/mcp")).rejects.toThrow("MCP_UNAVAILABLE");
  expect(figma.status().state).toBe("disconnected");
  const partial = await startFakeMcpHttp({ omit: ["get_screenshot"] });
  await expect(figma.configure(partial.url)).rejects.toThrow("MCP_FAILED");
  await partial.stop();
  expect(figma.status().state).toBe("disconnected");
  expect((await figma.configure(server.url)).state).toBe("connected");
  expect(host.db.query("SELECT value FROM integration_settings WHERE key = 'figma.url'").get()).toEqual({
    value: server.url,
  });
});

test("linking a node stores its name and URL on the ticket", async () => {
  await figma.configure(server.url);
  const t = host.command(host.projectId, { method: "createTicket", title: "Arbre" }, USER);
  await expect(figma.link(host.projectId, t.id, "https://example.com/x")).rejects.toThrow("INVALID_INPUT");
  const ref = await figma.link(
    host.projectId,
    t.id,
    "https://www.figma.com/design/AbC123xyz/Kibo?node-id=12-34",
  );
  expect(ref).toMatchObject({
    kind: "figma_node",
    fileKey: "AbC123xyz",
    nodeId: "12:34",
    name: "Kibo › Tickets / Arbre",
  });
  expect(host.snapshot(host.projectId).tickets[0]?.externalRefs).toEqual([ref]);
});

test("linking without Figma configured says so", async () => {
  const t = host.command(host.projectId, { method: "createTicket", title: "Arbre" }, USER);
  await expect(
    figma.link(host.projectId, t.id, "https://www.figma.com/design/AbC123xyz/Kibo?node-id=12-34"),
  ).rejects.toThrow("NOT_CONNECTED");
});

test("previews are cached 7 days, 0600, and served from cache when Figma is closed", async () => {
  await figma.configure(server.url);
  const first = await figma.preview("AbC123xyz", "12:34");
  expect(first).toMatchObject({ png: FAKE_PNG_BASE64, reachable: true, available: true });
  const row = host.db.query("SELECT png_path FROM figma_cache").get() as { png_path: string };
  expect(statSync(row.png_path).mode & 0o777).toBe(0o600);
  await figma.preview("AbC123xyz", "12:34");
  expect(calls().filter((c) => c === "get_screenshot")).toHaveLength(1);
  await server.stop();
  await hub.setReserved("figma", server.url);
  host.clock.now += 8 * 24 * 3_600_000;
  expect(await figma.preview("AbC123xyz", "12:34")).toMatchObject({ png: FAKE_PNG_BASE64, reachable: false });
  server = await startFakeMcpHttp();
});

test("a server without a screenshot tool gives 'preview unavailable'", async () => {
  await figma.configure(server.url);
  const partial = await startFakeMcpHttp({ omit: ["get_screenshot"] });
  await hub.setReserved("figma", partial.url);
  expect(await figma.preview("AbC123xyz", "56:78")).toMatchObject({
    png: null,
    reachable: true,
    available: false,
  });
  await partial.stop();
});

test("disconnecting forgets the address, never the links", async () => {
  await figma.configure(server.url);
  const t = host.command(host.projectId, { method: "createTicket", title: "Arbre" }, USER);
  await figma.link(host.projectId, t.id, "https://www.figma.com/design/AbC123xyz/Kibo?node-id=12-34");
  await figma.disconnect();
  expect(figma.status().state).toBe("disconnected");
  expect(host.snapshot(host.projectId).tickets[0]?.externalRefs).toHaveLength(1);
});
