import { expect, test } from "bun:test";
import { createSnapshotStore } from "./snapshot-store";
import { memoryStorage } from "./storage";
import { sealJson, testKeys } from "./test-kit";

test("snapshot-store keeps the sealed blob and returns the decrypted value through open", async () => {
  const storage = memoryStorage();
  const keys = await testKeys();
  const sealed = await sealJson(keys, "silo", "project", { name: "Silo" }, { builtAt: 1_000 });
  const store = createSnapshotStore(storage.snapshots);
  await store.put(sealed);
  expect(await storage.snapshots.get("silo/project")).toEqual(sealed);
  expect(await store.open(keys, "silo", "project")).toEqual({
    ok: true,
    value: { name: "Silo" },
    builtAt: 1_000,
  });
  const reloaded = createSnapshotStore(storage.snapshots);
  await reloaded.load();
  expect(reloaded.get("silo", "project")).toEqual(sealed);
  expect(reloaded.lastBuiltAt()).toBe(1_000);
});

test("an older seq never replaces a newer blob", async () => {
  const keys = await testKeys();
  const store = createSnapshotStore(memoryStorage().snapshots);
  await store.put(await sealJson(keys, "silo", "project", { v: 2 }, { seq: 2 }));
  await store.put(await sealJson(keys, "silo", "project", { v: 1 }, { seq: 1 }));
  expect(await store.open(keys, "silo", "project")).toMatchObject({ ok: true, value: { v: 2 } });
});

test("an undecryptable blob reports needsPairing instead of throwing", async () => {
  const store = createSnapshotStore(memoryStorage().snapshots);
  await store.put(await sealJson(await testKeys(9, 2), "silo", "project", { name: "Silo" }));
  expect(await store.open(await testKeys(7, 1), "silo", "project")).toEqual({
    ok: false,
    reason: "needsPairing",
  });
  expect(await store.open(await testKeys(7, 1), "silo", "events")).toEqual({ ok: false, reason: "missing" });
});

test("removing a project forgets its blobs and nothing else", async () => {
  const keys = await testKeys();
  const store = createSnapshotStore(memoryStorage().snapshots);
  await store.put(await sealJson(keys, "silo", "project", {}));
  await store.put(await sealJson(keys, "silo", "events", []));
  await store.put(await sealJson(keys, "atelier", "project", {}));
  await store.removeProject("silo");
  expect(store.projects()).toEqual(["atelier"]);
  await store.remove("atelier", "project");
  expect(store.projects()).toEqual([]);
});
