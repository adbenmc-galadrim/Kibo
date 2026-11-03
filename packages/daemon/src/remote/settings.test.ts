import { afterEach, beforeEach, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openStore, type Store } from "../store";
import { openRemoteSettings } from "./settings";

let home: string;
let store: Store;
beforeEach(() => {
  home = mkdtempSync(join(tmpdir(), "kibo-remote-settings-"));
  store = openStore(home);
});
afterEach(() => {
  store.close();
  rmSync(home, { recursive: true, force: true });
});

test("defaults are disabled, no projects, epoch 0", () => {
  expect(openRemoteSettings(store).read()).toEqual({
    enabled: false,
    serverUrl: null,
    accountId: null,
    keyEpoch: 0,
    projects: [],
    phonePaired: false,
    pendingRevoke: false,
  });
});

test("setProjects persists a sorted unique list", () => {
  const settings = openRemoteSettings(store);
  expect(settings.setProjects(["silo-b", "silo-a", "silo-b"])).toEqual(["silo-a", "silo-b"]);
  store.close();
  store = openStore(home);
  expect(openRemoteSettings(store).read().projects).toEqual(["silo-a", "silo-b"]);
});

test("write keeps the other keys and clear returns to the defaults", () => {
  const settings = openRemoteSettings(store);
  settings.write({ enabled: true, serverUrl: "https://kibo.shinseo.fr", accountId: "acc", keyEpoch: 2 });
  settings.setProjects(["silo"]);
  expect(settings.write({ phonePaired: true })).toMatchObject({
    enabled: true,
    keyEpoch: 2,
    phonePaired: true,
  });
  settings.clear();
  expect(settings.read()).toMatchObject({ enabled: false, serverUrl: null, projects: [], keyEpoch: 0 });
  expect(store.db.query("SELECT key FROM local_state WHERE key LIKE 'remote.%'").all()).toEqual([]);
});
