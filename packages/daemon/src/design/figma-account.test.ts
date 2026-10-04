import { afterEach, beforeEach, expect, test } from "bun:test";
import { createEventLog } from "../integrations/events";
import {
  createMemorySecretStore,
  type MemorySecretStore,
  unavailableSecretStore,
} from "../integrations/memory-secret-store";
import { createIntegrationFetch } from "../integrations/net";
import { createRedactor } from "../integrations/redact";
import { createSettings, type Settings } from "../integrations/settings";
import { createFakeHost, type FakeHost } from "../integrations/testing/fake-host";
import type { SecretStore } from "../integrations/types";
import { createMcpHub, type McpHub } from "../mcp/hub";
import { FAKE_FIGMA_IMAGE_HOST, type FakeFigma, startFakeFigma } from "../testing/fake-figma";
import { startFakeMcpHttp } from "../testing/fake-mcp";
import { createFigmaAccount, type FigmaAccount } from "./figma-account";
import { createFigmaMcp } from "./providers/figma-mcp";
import { createFigmaRest } from "./providers/figma-rest";

const SECRET = "figd_TESTSECRET";
let host: FakeHost;
let hub: McpHub;
let figma: FakeFigma;
let server: Awaited<ReturnType<typeof startFakeMcpHttp>>;
let settings: Settings;
let secrets: MemorySecretStore;

function build(store: SecretStore): FigmaAccount {
  const redactor = createRedactor();
  const events = createEventLog(host.db, redactor, host.now);
  const aliases = new Map([
    ["api.figma.com", new URL(`${figma.url}/`)],
    [FAKE_FIGMA_IMAGE_HOST, new URL(`${figma.url}/`)],
  ]);
  let account: FigmaAccount | null = null;
  const rest = createFigmaRest({
    fetch: createIntegrationFetch({ aliases }),
    token: async () => (account ? account.token() : null),
    redactor,
    now: host.now,
  });
  const mcp = createFigmaMcp({ hub, configured: () => account?.mode() === "mcp" });
  account = createFigmaAccount({ settings, secrets: store, redactor, hub, rest, mcp, events });
  return account;
}

beforeEach(async () => {
  host = createFakeHost();
  server = await startFakeMcpHttp();
  figma = startFakeFigma({ token: SECRET, handle: "adam" });
  const events = createEventLog(host.db, createRedactor(), host.now);
  hub = createMcpHub({ host, secrets: createMemorySecretStore(createRedactor()), events, redact: (t) => t });
  settings = createSettings(host.db);
  secrets = createMemorySecretStore(createRedactor());
});
afterEach(async () => {
  await hub.stop();
  await server.stop();
  figma.stop();
  host.close();
});

test("a personal token is verified, then kept in the keychain only", async () => {
  const account = build(secrets);
  expect((await account.status()).state).toBe("disconnected");
  const status = await account.connect({ mode: "token", token: SECRET });
  expect(status).toMatchObject({ id: "figma", state: "connected", account: "adam", error: null });
  expect(secrets.dump().get("figma")).toBe(SECRET);
  expect(settings.get("figma.mode")).toBe("token");
  expect(settings.get("figma.account")).toBe("adam");
  expect(await account.token()).toBe(SECRET);
  expect(JSON.stringify(host.db.query("SELECT * FROM integration_settings").all())).not.toContain(SECRET);
});

test("a refused token writes nothing", async () => {
  const account = build(secrets);
  await expect(account.connect({ mode: "token", token: "figd_WRONGTOKEN" })).rejects.toThrow(
    "REMOTE_REJECTED",
  );
  expect(secrets.dump().size).toBe(0);
  expect(settings.get("figma.mode")).toBeNull();
  expect((await account.status()).state).toBe("disconnected");
});

test("the mcp mode replaces the token", async () => {
  const account = build(secrets);
  await account.connect({ mode: "token", token: SECRET });
  const status = await account.connect({ mode: "mcp", url: server.url });
  expect(status).toMatchObject({ state: "connected", account: null });
  expect(secrets.dump().has("figma")).toBe(false);
  expect(settings.get("figma.url")).toBe(server.url);
  expect(settings.get("figma.mode")).toBe("mcp");
  expect(settings.get("figma.account")).toBeNull();
  expect(await account.token()).toBeNull();
  expect(account.mcpUrl()).toBe(server.url);
});

test("an mcp server without get_screenshot is refused and the previous one restored", async () => {
  const account = build(secrets);
  await account.connect({ mode: "mcp", url: server.url });
  const partial = await startFakeMcpHttp({ omit: ["get_screenshot"] });
  await expect(account.connect({ mode: "mcp", url: partial.url })).rejects.toThrow("MCP_FAILED");
  await partial.stop();
  expect(settings.get("figma.url")).toBe(server.url);
  expect((await hub.tools("figma")).map((t) => t.name)).toContain("get_screenshot");
});

test("the token mode leaves the mcp server", async () => {
  const account = build(secrets);
  await account.connect({ mode: "mcp", url: server.url });
  await account.connect({ mode: "token", token: SECRET });
  expect(settings.get("figma.url")).toBeNull();
  expect(account.mcpUrl()).toBeNull();
  await expect(hub.tools("figma")).rejects.toThrow();
});

test("testing calls /v1/me and records a refusal", async () => {
  const account = build(secrets);
  await account.connect({ mode: "token", token: SECRET });
  const before = figma.requests.filter((r) => r.path === "/v1/me").length;
  expect((await account.test()).state).toBe("connected");
  expect(figma.requests.filter((r) => r.path === "/v1/me").length).toBe(before + 1);
  figma.failNext(401, JSON.stringify({ err: `bad ${SECRET}` }));
  const failed = await account.test();
  expect(failed).toMatchObject({ state: "error", error: { code: "REMOTE_REJECTED" } });
  expect(JSON.stringify(failed)).not.toContain(SECRET);
  expect((await account.test()).state).toBe("connected");
});

test("testing in mcp mode checks the tools", async () => {
  const account = build(secrets);
  await account.connect({ mode: "mcp", url: server.url });
  expect((await account.test()).state).toBe("connected");
  await hub.setReserved("figma", "http://127.0.0.1:1/mcp");
  expect(await account.test()).toMatchObject({ state: "error", error: { code: "MCP_UNAVAILABLE" } });
});

test("disconnecting forgets the token, the settings and the server", async () => {
  const account = build(secrets);
  await account.connect({ mode: "mcp", url: server.url });
  await account.disconnect();
  expect(settings.get("figma.url")).toBeNull();
  expect(settings.get("figma.mode")).toBeNull();
  await expect(hub.tools("figma")).rejects.toThrow();
  await account.connect({ mode: "token", token: SECRET });
  await account.disconnect();
  expect(secrets.dump().has("figma")).toBe(false);
  expect(settings.get("figma.account")).toBeNull();
  expect((await account.status()).state).toBe("disconnected");
});

test("start reopens the mcp server, including a phase 5 setting without a mode", async () => {
  settings.set("figma.url", server.url);
  const account = build(secrets);
  expect(account.mode()).toBe("mcp");
  await account.start();
  expect((await hub.tools("figma")).map((t) => t.name)).toContain("get_metadata");
  expect((await account.status()).state).toBe("connected");
});

test("a token mode without its secret is an error, never a silent connection", async () => {
  const account = build(secrets);
  await account.connect({ mode: "token", token: SECRET });
  await secrets.delete("figma");
  expect(await account.status()).toMatchObject({ state: "error", error: { code: "NOT_CONNECTED" } });
});

test("an unavailable keychain puts the token mode in error", async () => {
  settings.set("figma.mode", "token");
  settings.set("figma.account", "adam");
  const account = build(unavailableSecretStore("locked"));
  expect(await account.status()).toMatchObject({
    state: "error",
    error: { code: "SECRET_STORE_UNAVAILABLE" },
  });
  await expect(account.connect({ mode: "token", token: SECRET })).rejects.toThrow("SECRET_STORE_UNAVAILABLE");
});

test("a keychain failure on disconnect keeps the settings, so the token is never orphaned", async () => {
  settings.set("figma.mode", "token");
  settings.set("figma.account", "adam");
  const account = build(unavailableSecretStore("locked"));
  await expect(account.disconnect()).rejects.toThrow("SECRET_STORE_UNAVAILABLE");
  expect(settings.get("figma.mode")).toBe("token");
  expect(settings.get("figma.account")).toBe("adam");
});
