import { afterEach, beforeEach, expect, test } from "bun:test";
import { createEventLog } from "../../integrations/events";
import { createMemorySecretStore } from "../../integrations/memory-secret-store";
import { createRedactor } from "../../integrations/redact";
import { createFakeHost, type FakeHost } from "../../integrations/testing/fake-host";
import { createMcpHub, type McpHub } from "../../mcp/hub";
import { FAKE_PNG_BASE64, startFakeMcpHttp } from "../../testing/fake-mcp";
import { createFigmaMcp, nameFromMetadata } from "./figma-mcp";

const KEY = { provider: "figma", fileKey: "AbC123xyz", nodeId: "12:34" } as const;
let host: FakeHost;
let hub: McpHub;
let server: Awaited<ReturnType<typeof startFakeMcpHttp>>;
let configured = true;
let mcp: ReturnType<typeof createFigmaMcp>;

beforeEach(async () => {
  configured = true;
  server = await startFakeMcpHttp();
  host = createFakeHost();
  const events = createEventLog(host.db, createRedactor(), host.now);
  hub = createMcpHub({ host, secrets: createMemorySecretStore(createRedactor()), events, redact: (t) => t });
  await hub.setReserved("figma", server.url);
  mcp = createFigmaMcp({ hub, configured: () => configured });
});
afterEach(async () => {
  await hub.stop();
  await server.stop();
  host.close();
});

test("metadata comes from get_metadata, the version is always unknown", async () => {
  expect(await mcp.metadata(KEY)).toEqual({ name: "Kibo › Tickets / Arbre", width: null, height: null });
  expect(await mcp.version(KEY)).toBeNull();
  expect(await mcp.connected()).toBe(true);
  configured = false;
  expect(await mcp.connected()).toBe(false);
});

test("render goes through get_screenshot and yields a png", async () => {
  const render = await mcp.render(KEY);
  expect(render).toMatchObject({
    meta: { name: "Kibo › Tickets / Arbre" },
    mime: "image/png",
    version: null,
  });
  expect(Buffer.from(render.body).toString("base64")).toBe(FAKE_PNG_BASE64);
});

test("a server without the expected tools fails checkTools", async () => {
  await mcp.checkTools();
  const partial = await startFakeMcpHttp({ omit: ["get_screenshot"] });
  await hub.setReserved("figma", partial.url);
  await expect(mcp.checkTools()).rejects.toThrow("MCP_FAILED");
  await partial.stop();
});

test("a closed server is unavailable", async () => {
  await hub.setReserved("figma", "http://127.0.0.1:1/mcp");
  await expect(mcp.metadata(KEY)).rejects.toThrow("MCP_UNAVAILABLE");
});

test("not configured means not connected, without calling the hub", async () => {
  configured = false;
  await expect(mcp.render(KEY)).rejects.toThrow("NOT_CONNECTED");
});

test("the node name comes from the metadata tool", () => {
  expect(nameFromMetadata('<frame id="12:34" name="Kibo › Tickets &amp; Arbre" x="0" />')).toBe(
    "Kibo › Tickets & Arbre",
  );
  expect(nameFromMetadata("no attributes here")).toBeNull();
});
