import { Database } from "bun:sqlite";
import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { holdWriteLock } from "@kibo/sync-server/testing/hold-write-lock";
import { LoroDoc } from "loro-crdt";
import { kiboHome } from "./paths";
import { loadDoc, openStore } from "./store";

const dirs: string[] = [];
const tmp = () => {
  const d = mkdtempSync(join(tmpdir(), "kibo-store-"));
  dirs.push(d);
  return d;
};
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

describe("store", () => {
  test("snapshots survive a reopen", () => {
    const home = tmp();
    const doc = new LoroDoc();
    doc.getMap("meta").set("name", "Kibo");
    const s1 = openStore(home);
    s1.save("workspace", doc.export({ mode: "snapshot" }));
    s1.close();
    const s2 = openStore(home);
    expect(s2.ids()).toEqual(["workspace"]);
    expect(loadDoc(s2, "workspace")?.getMap("meta").get("name")).toBe("Kibo");
    expect(loadDoc(s2, "missing")).toBeNull();
    s2.close();
  });

  test("data files are private to the user", () => {
    const home = join(tmp(), "home");
    openStore(home).close();
    expect(statSync(home).mode & 0o777).toBe(0o700);
    expect(statSync(join(home, "kibo.db")).mode & 0o777).toBe(0o600);
  });

  test("a write waits for another process to release its lock", async () => {
    const home = tmp();
    const store = openStore(home);
    const lock = await holdWriteLock(join(home, "kibo.db"), 300);
    store.save("workspace", new Uint8Array([1]));
    expect(await lock.released).toBe(0);
    expect(store.load("workspace")).toEqual(new Uint8Array([1]));
    store.close();
  });

  test("a read-then-write transaction waits for another process too", async () => {
    const home = tmp();
    const store = openStore(home);
    store.save("workspace", new Uint8Array([1]));
    const lock = await holdWriteLock(join(home, "kibo.db"), 300);
    store.transaction(() => {
      const current = store.load("workspace") ?? new Uint8Array();
      store.save("workspace", new Uint8Array([...current, 2]));
    });
    expect(await lock.released).toBe(0);
    expect(store.load("workspace")).toEqual(new Uint8Array([1, 2]));
    store.close();
  });

  test("an unreadable database stops the start instead of starting empty", () => {
    const home = tmp();
    writeFileSync(join(home, "kibo.db"), "this is not a sqlite file, this is not a sqlite file");
    expect(() => openStore(home)).toThrow("STORE_CORRUPT");
  });

  test("an unreadable snapshot is reported", () => {
    const store = openStore(tmp());
    store.save("workspace", new Uint8Array([1, 2, 3, 4]));
    expect(() => loadDoc(store, "workspace")).toThrow("STORE_CORRUPT");
    store.close();
  });

  test("local state survives a reopen and never touches the docs table", () => {
    const home = tmp();
    const first = openStore(home);
    first.setLocal("tabs:workspace", '{"a":1}');
    first.setLocal("tabs:workspace", '{"a":2}');
    first.close();
    const again = openStore(home);
    expect(again.getLocal("tabs:workspace")).toBe('{"a":2}');
    expect(again.getLocal("missing")).toBeNull();
    expect(again.ids()).toEqual([]);
    again.close();
  });

  test("delete removes a doc and ignores an unknown id", () => {
    const store = openStore(tmp());
    store.save("project:x", new Uint8Array([1, 2, 3]));
    store.save("project:y", new Uint8Array([4]));
    store.delete("project:x");
    expect(store.load("project:x")).toBeNull();
    expect(store.ids()).toEqual(["project:y"]);
    store.delete("project:x");
    expect(store.ids()).toEqual(["project:y"]);
    store.close();
  });

  test("KIBO_HOME overrides the default home", () => {
    expect(kiboHome({ KIBO_HOME: "/tmp/k" })).toBe("/tmp/k");
    expect(kiboHome({})).toEndWith(".kibo");
  });
  test("vacuumInto writes a consistent snapshot even while a write transaction is open", () => {
    const home = tmp();
    const store = openStore(home);
    store.setLocal("a", "1");
    store.db.exec("BEGIN IMMEDIATE");
    store.setLocal("b", "2");
    const target = join(home, "copy.db");
    store.vacuumInto(target);
    store.db.exec("COMMIT");
    store.close();
    const copy = new Database(target, { readonly: true });
    expect(copy.query("SELECT key FROM local_state ORDER BY key").all()).toEqual([{ key: "a" }]);
    expect(copy.query("PRAGMA integrity_check").get()).toEqual({ integrity_check: "ok" });
    copy.close();
  });
});
