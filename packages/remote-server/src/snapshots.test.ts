import { describe, expect, test } from "bun:test";
import { type Sealed, SNAPSHOT_MAX_BYTES } from "@kibo/remote/protocol";
import { KiboError, type KiboErrorCode } from "@kibo/schema";
import { openDb } from "./db";
import { createSnapshotStore } from "./snapshots";

const bytes = (length: number, first = 0xff) => {
  const out = new Uint8Array(length);
  crypto.getRandomValues(out);
  out[0] = first;
  return out;
};
const b64 = (data: Uint8Array) => Buffer.from(data).toString("base64url");

const sealed = (projectId: string, kind: string, seq: number, ciphertext = bytes(32)): Sealed => ({
  header: { v: 1, projectId, kind, seq, builtAt: 1_700_000_000_000, keyEpoch: 1 },
  nonce: b64(bytes(12)),
  ciphertext: b64(ciphertext),
});

const setup = (limits: { maxTotalBytes?: number } = {}) => {
  let now = 1_000;
  const db = openDb(":memory:");
  const store = createSnapshotStore(db, { now: () => now, ...limits });
  return {
    db,
    store,
    tick: (ms: number) => {
      now += ms;
    },
  };
};

const rejectsWith = (work: () => unknown, code: KiboErrorCode) => {
  try {
    work();
  } catch (e) {
    if (!(e instanceof KiboError)) throw e;
    expect(e.code).toBe(code);
    return;
  }
  throw new Error("expected a KiboError");
};

describe("snapshot store", () => {
  test("put stores header, nonce and ciphertext verbatim and bumps updated_at", () => {
    const { db, store, tick } = setup();
    const first = sealed("p1", "project", 1);
    expect(store.put(first)).toBe(true);
    const row = () =>
      db
        .query<{ header: string; nonce: Uint8Array; ciphertext: Uint8Array; updated_at: number }, []>(
          "SELECT header, nonce, ciphertext, updated_at FROM snapshots",
        )
        .get();
    expect(JSON.parse(row()?.header ?? "null")).toEqual(first.header);
    expect(b64(row()?.nonce ?? new Uint8Array())).toBe(first.nonce);
    expect(b64(row()?.ciphertext ?? new Uint8Array())).toBe(first.ciphertext);
    expect(row()?.updated_at).toBe(1_000);
    tick(500);
    const second = sealed("p1", "project", 2);
    store.put(second);
    expect(row()?.updated_at).toBe(1_500);
    expect(store.get("p1", "project")).toEqual(second);
  });

  test("the stored block is the received ciphertext byte for byte and is not JSON", () => {
    const { db, store } = setup();
    const ciphertext = bytes(64);
    store.put(sealed("p1", "events", 1, ciphertext));
    const blob = db
      .query<{ ciphertext: Uint8Array }, []>("SELECT ciphertext FROM snapshots")
      .get()?.ciphertext;
    expect(new Uint8Array(blob ?? [])).toEqual(ciphertext);
    expect(() => JSON.parse(new TextDecoder().decode(blob))).toThrow();
  });

  test("put with a lower seq than stored is ignored", () => {
    const { store } = setup();
    const latest = sealed("p1", "project", 5);
    store.put(latest);
    expect(store.put(sealed("p1", "project", 4))).toBe(false);
    expect(store.get("p1", "project")).toEqual(latest);
  });

  test("headers by project returns the latest header per kind, without the block", () => {
    const { store } = setup();
    store.put(sealed("p1", "project", 1));
    const project = sealed("p1", "project", 2);
    const events = sealed("p1", "events", 1);
    store.put(project);
    store.put(events);
    store.put(sealed("p2", "project", 9));
    expect(store.headers("p1")).toEqual([events.header, project.header]);
  });

  test("remove deletes one kind, removeProject deletes all kinds", () => {
    const { store } = setup();
    store.put(sealed("p1", "project", 1));
    store.put(sealed("p1", "events", 1));
    store.put(sealed("p2", "project", 1));
    expect(store.remove("p1", "events")).toBe(true);
    expect(store.headers("p1").map((h) => h.kind)).toEqual(["project"]);
    expect(store.removeProject("p1")).toEqual(["project"]);
    expect(store.headers("p1")).toEqual([]);
    expect(store.headers("p2")).toHaveLength(1);
    expect(store.get("p1", "project")).toBeNull();
  });

  test("put over SNAPSHOT_MAX_BYTES throws REMOTE_TOO_LARGE", () => {
    const { store } = setup();
    rejectsWith(
      () => store.put(sealed("p1", "project", 1, bytes(SNAPSHOT_MAX_BYTES + 1))),
      "REMOTE_TOO_LARGE",
    );
    expect(store.headers("p1")).toEqual([]);
  });

  test("total over 1 GiB throws REMOTE_TOO_LARGE", () => {
    const { store } = setup({ maxTotalBytes: 1_024 });
    store.put(sealed("p1", "project", 1, bytes(600)));
    rejectsWith(() => store.put(sealed("p1", "events", 1, bytes(600))), "REMOTE_TOO_LARGE");
    expect(store.put(sealed("p1", "project", 2, bytes(900)))).toBe(true);
  });

  test("a ciphertext that is not canonical base64url is refused", () => {
    const { store } = setup();
    rejectsWith(
      () => store.put({ ...sealed("p1", "project", 1), ciphertext: "q83vEjRWeJB" }),
      "INVALID_INPUT",
    );
  });
});
