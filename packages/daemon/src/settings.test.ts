import { afterEach, beforeEach, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { z } from "zod";
import { openLocalSettings } from "./settings";
import { openStore, type Store } from "./store";

let home: string;
let store: Store;
beforeEach(() => {
  home = mkdtempSync(join(tmpdir(), "kibo-settings-"));
  store = openStore(home);
});
afterEach(() => {
  store.close();
  rmSync(home, { recursive: true, force: true });
});

const Remote = z.object({ enabled: z.boolean(), port: z.number().int() });

test("returns the fallback when the key is absent", () => {
  expect(openLocalSettings(store).get("remoteAccess", Remote, { enabled: false, port: 47832 })).toEqual({
    enabled: false,
    port: 47832,
  });
});

test("stores JSON values, overwrites them and survives a reopen", () => {
  const settings = openLocalSettings(store);
  settings.set("remoteAccess", { enabled: true, port: 50000 });
  settings.set("sandbox.allowUnsandboxed", true);
  settings.set("sandbox.allowUnsandboxed", false);
  store.close();
  store = openStore(home);
  const again = openLocalSettings(store);
  expect(again.get("remoteAccess", Remote, { enabled: false, port: 1 })).toEqual({
    enabled: true,
    port: 50000,
  });
  expect(again.get("sandbox.allowUnsandboxed", z.boolean(), true)).toBe(false);
});

test("settings never collide with other local_state keys", () => {
  store.setLocal("tabs:workspace", "{}");
  openLocalSettings(store).set("tabs:workspace", 1);
  expect(store.getLocal("tabs:workspace")).toBe("{}");
});

test("a value that does not match its schema is reported, not replaced", () => {
  const settings = openLocalSettings(store);
  settings.set("remoteAccess", { enabled: "yes" });
  expect(() => settings.get("remoteAccess", Remote, { enabled: false, port: 1 })).toThrow("STORE_CORRUPT");
});

test("unparsable JSON is reported", () => {
  store.setLocal("setting:broken", "{");
  expect(() => openLocalSettings(store).get("broken", z.number(), 0)).toThrow("STORE_CORRUPT");
});
