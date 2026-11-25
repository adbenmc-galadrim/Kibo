import { expect, test } from "bun:test";
import { openSnapshot } from "@kibo/remote";
import { createKeyStore } from "./key-store";
import { memoryStorage } from "./storage";
import { ACCOUNT_ID, rootKey, sealJson, testKeys } from "./test-kit";

test("save then load returns non-extractable keys for the account", async () => {
  const store = createKeyStore(memoryStorage().keys);
  await store.save(ACCOUNT_ID, rootKey(7), 3);
  const loaded = await store.load();
  expect(loaded?.accountId).toBe(ACCOUNT_ID);
  expect(loaded?.keys.epoch).toBe(3);
  expect(loaded?.keys.snapshot.extractable).toBe(false);
  expect(loaded?.keys.request.extractable).toBe(false);
  const sealed = await sealJson(await testKeys(7, 3), "silo", "project", { ok: true });
  if (!loaded) throw new Error("keys missing");
  expect(new TextDecoder().decode(await openSnapshot(loaded.keys, sealed))).toBe('{"ok":true}');
});

test("the stored record never holds the root key", async () => {
  const storage = memoryStorage();
  await createKeyStore(storage.keys).save(ACCOUNT_ID, rootKey(7), 1);
  const values = await Promise.all((await storage.keys.keys()).map((key) => storage.keys.get(key)));
  expect(JSON.stringify(values)).not.toContain("7,7,7");
  expect(values.flatMap((v) => Object.values(v ?? {})).some((v) => v instanceof Uint8Array)).toBe(false);
});

test("clear forgets everything", async () => {
  const storage = memoryStorage();
  const store = createKeyStore(storage.keys);
  await store.save(ACCOUNT_ID, rootKey(7), 1);
  await store.clear();
  expect(await store.load()).toBeNull();
  expect(await storage.keys.keys()).toEqual([]);
});
