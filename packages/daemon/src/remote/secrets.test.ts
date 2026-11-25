import { afterEach, beforeEach, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createMemorySecretStore, type MemorySecretStore } from "../integrations/memory-secret-store";
import { createRedactor } from "../integrations/redact";
import { openStore, type Store } from "../store";
import { newMacToken, openRemoteSecrets } from "./secrets";
import { openRemoteSettings } from "./settings";

const LONG_BASE64URL = /^[A-Za-z0-9_-]{32,}$/;

let home: string;
let store: Store;
let keychain: MemorySecretStore;
beforeEach(() => {
  home = mkdtempSync(join(tmpdir(), "kibo-remote-secrets-"));
  store = openStore(home);
  keychain = createMemorySecretStore(createRedactor());
});
afterEach(() => {
  store.close();
  rmSync(home, { recursive: true, force: true });
});

test('the root key is stored under "remote" and the mac token under "remote:server", never in local_state', async () => {
  const secrets = openRemoteSecrets(keychain);
  const rootKey = crypto.getRandomValues(new Uint8Array(32));
  const macToken = newMacToken();
  await secrets.save({ rootKey, macToken });
  openRemoteSettings(store).write({ enabled: true, serverUrl: "https://kibo.shinseo.fr", keyEpoch: 1 });
  openRemoteSettings(store).setProjects(["silo"]);

  expect(keychain.dump().get("remote")).toBe(Buffer.from(rootKey).toString("base64url"));
  expect(keychain.dump().get("remote:server")).toBe(macToken);
  expect(await secrets.load()).toEqual({ rootKey, macToken });
  const values = store.db.query<{ value: string }, []>("SELECT value FROM local_state").all();
  expect(values.length).toBeGreaterThan(0);
  expect(values.filter(({ value }) => LONG_BASE64URL.test(value))).toEqual([]);
});

test("a mac token holds 256 bits and clear forgets both secrets", async () => {
  expect(newMacToken()).toMatch(/^[A-Za-z0-9_-]{43}$/);
  const secrets = openRemoteSecrets(keychain);
  await secrets.save({ rootKey: new Uint8Array(32).fill(7), macToken: newMacToken() });
  await secrets.clear();
  expect(await secrets.load()).toBeNull();
  expect([...keychain.dump().keys()]).toEqual([]);
});
