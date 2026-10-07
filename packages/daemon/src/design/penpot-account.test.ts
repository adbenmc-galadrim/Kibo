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
import { type FakePenpot, startFakePenpot } from "../testing/fake-penpot";
import { ANONYMOUS_FULLNAME, createPenpotAccount, type PenpotAccount } from "./penpot-account";
import { createPenpot } from "./providers/penpot";

const SECRET = "penpot-TESTSECRET-0123456789";
let host: FakeHost;
let penpot: FakePenpot;
let settings: Settings;
let secrets: MemorySecretStore;

function build(store: SecretStore): PenpotAccount {
  const redactor = createRedactor();
  const events = createEventLog(host.db, redactor, host.now);
  let account: PenpotAccount | null = null;
  const client = createPenpot({
    fetch: createIntegrationFetch({ aliases: new Map() }),
    instance: () => account?.instance() ?? null,
    token: async () => (account ? account.token() : null),
    redactor,
    now: host.now,
  });
  account = createPenpotAccount({ settings, secrets: store, redactor, penpot: client, events });
  return account;
}

beforeEach(() => {
  host = createFakeHost();
  penpot = startFakePenpot({ token: SECRET });
  settings = createSettings(host.db);
  secrets = createMemorySecretStore(createRedactor());
});
afterEach(() => {
  penpot.stop();
  host.close();
});

const host$ = () => new URL(penpot.url).host;

test("connecting verifies the profile and keeps the token in the keychain only", async () => {
  const account = build(secrets);
  expect((await account.status()).state).toBe("disconnected");
  const status = await account.connect(`${penpot.url}/some/path/`, SECRET);
  expect(status).toMatchObject({ id: "penpot", state: "connected", account: `Adam · ${host$()}` });
  expect(settings.get("penpot.url")).toBe(penpot.url);
  expect(settings.get("penpot.account")).toBe("Adam");
  expect(secrets.dump().get("penpot")).toBe(SECRET);
  expect(account.instance()).toBe(penpot.url);
  expect(await account.token()).toBe(SECRET);
  expect(JSON.stringify(host.db.query("SELECT * FROM integration_settings").all())).not.toContain(SECRET);
});

test("refused addresses fail clearly without any request", async () => {
  const account = build(secrets);
  await expect(account.connect("http://192.168.1.2:9010", SECRET)).rejects.toThrow("INVALID_INPUT");
  await expect(account.connect(`https://localhost:${new URL(penpot.url).port}`, SECRET)).rejects.toThrow(
    "https on a loopback instance is not supported",
  );
  await expect(account.connect("https://127.0.0.1:9010", SECRET)).rejects.toThrow("INVALID_INPUT");
  await expect(account.connect("pas une url", SECRET)).rejects.toThrow("INVALID_INPUT");
  expect(penpot.requests).toHaveLength(0);
  expect(settings.get("penpot.url")).toBeNull();
});

test("a refused token writes nothing", async () => {
  const account = build(secrets);
  await expect(account.connect(penpot.url, "penpot-WRONG-0123456789")).rejects.toThrow("REMOTE_REJECTED");
  expect(secrets.dump().size).toBe(0);
  expect(settings.get("penpot.url")).toBeNull();
});

test("testing calls get-profile and records a refusal", async () => {
  const account = build(secrets);
  await account.connect(penpot.url, SECRET);
  expect((await account.test()).state).toBe("connected");
  expect(penpot.requests.at(-1)?.path).toBe("/api/rpc/command/get-profile");
  penpot.failNext(401, `invalid token ${SECRET}`);
  const failed = await account.test();
  expect(failed).toMatchObject({ state: "error", error: { code: "REMOTE_REJECTED" } });
  expect(JSON.stringify(failed)).not.toContain(SECRET);
  expect((await account.test()).state).toBe("connected");
});

test("disconnecting forgets the token and the settings", async () => {
  const account = build(secrets);
  await account.connect(penpot.url, SECRET);
  await account.disconnect();
  expect(secrets.dump().has("penpot")).toBe(false);
  expect(settings.get("penpot.url")).toBeNull();
  expect(settings.get("penpot.account")).toBeNull();
  expect(account.instance()).toBeNull();
  expect(await account.token()).toBeNull();
  expect((await account.status()).state).toBe("disconnected");
});

test("a missing secret is an error", async () => {
  const account = build(secrets);
  await account.connect(penpot.url, SECRET);
  await secrets.delete("penpot");
  expect(await account.status()).toMatchObject({ state: "error", error: { code: "NOT_CONNECTED" } });
});

test("an unavailable keychain is an error", async () => {
  settings.set("penpot.url", penpot.url);
  settings.set("penpot.account", "Adam");
  const account = build(unavailableSecretStore("locked"));
  expect(await account.status()).toMatchObject({
    state: "error",
    error: { code: "SECRET_STORE_UNAVAILABLE" },
  });
  await expect(account.connect(penpot.url, SECRET)).rejects.toThrow("SECRET_STORE_UNAVAILABLE");
});

test("a keychain failure on disconnect keeps the settings, so the token is never orphaned", async () => {
  settings.set("penpot.url", penpot.url);
  settings.set("penpot.account", "Adam");
  const account = build(unavailableSecretStore("locked"));
  await expect(account.disconnect()).rejects.toThrow("SECRET_STORE_UNAVAILABLE");
  expect(settings.get("penpot.url")).toBe(penpot.url);
  expect(settings.get("penpot.account")).toBe("Adam");
});

test("an ignored token is refused and nothing is written", async () => {
  penpot.ignoreTokens = true;
  const account = build(secrets);
  await expect(account.connect(penpot.url, SECRET)).rejects.toThrow("TOKEN_IGNORED");
  expect(secrets.dump().size).toBe(0);
  expect(settings.get("penpot.url")).toBeNull();
  expect(settings.get("penpot.account")).toBeNull();
});

test("an account stored as anonymous asks to reconnect until a real token is accepted", async () => {
  const account = build(secrets);
  await account.connect(penpot.url, SECRET);
  settings.set("penpot.account", ANONYMOUS_FULLNAME);
  expect(await account.status()).toMatchObject({ state: "error", error: { code: "TOKEN_IGNORED" } });
  penpot.ignoreTokens = true;
  expect((await account.test()).error?.code).toBe("TOKEN_IGNORED");
  penpot.ignoreTokens = false;
  expect(await account.test()).toMatchObject({ state: "connected", account: `Adam · ${host$()}` });
  expect(settings.get("penpot.account")).toBe("Adam");
});
