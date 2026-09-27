import { Database } from "bun:sqlite";
import { beforeEach, describe, expect, test } from "bun:test";
import { hashSessionId, openSessionStore, SESSION_TTL_MS, type SessionStore } from "./session-store";

const DAY = 24 * 3600_000;
let db: Database;
let store: SessionStore;

beforeEach(() => {
  db = new Database(":memory:", { strict: true });
  store = openSessionStore(db);
});

describe("session store", () => {
  test("creates a random id and stores only its SHA-256", () => {
    const { id, hash } = store.create({ deviceName: "Chrome · macOS", remote: false }, 1_000);
    expect(id).toMatch(/^[0-9a-f]{64}$/);
    expect(hash).toBe(hashSessionId(id));
    expect(hash).not.toBe(id);
    const rows = db.query("SELECT * FROM remote_sessions").all();
    expect(JSON.stringify(rows)).not.toContain(id);
    expect(Buffer.from(db.serialize()).includes(Buffer.from(id))).toBe(false);
  });

  test("validates a known id and refuses an unknown one", () => {
    const { id, hash } = store.create({ deviceName: "Firefox · Linux", remote: true }, 1_000);
    expect(store.validate(id, 2_000)).toEqual({ hash, remote: true, renewed: false });
    expect(store.validate("f".repeat(64), 2_000)).toBeNull();
    expect(store.validate(hash, 2_000)).toBeNull();
  });

  test("expires 30 days after the last activity", () => {
    const { id } = store.create({ deviceName: "Chrome · macOS", remote: false }, 0);
    expect(store.validate(id, SESSION_TTL_MS - 1)).not.toBeNull();
    const other = store.create({ deviceName: "Chrome · macOS", remote: false }, 0);
    expect(store.validate(other.id, SESSION_TTL_MS)).toBeNull();
  });

  test("activity slides the expiry forward", () => {
    const { id } = store.create({ deviceName: "Chrome · macOS", remote: false }, 0);
    expect(store.validate(id, 20 * DAY)).not.toBeNull();
    expect(store.validate(id, 45 * DAY)).not.toBeNull();
    expect(store.validate(id, 45 * DAY + SESSION_TTL_MS)).toBeNull();
  });

  test("writes lastSeenAt at most once a minute", () => {
    const { id, hash } = store.create({ deviceName: "Chrome · macOS", remote: false }, 0);
    store.validate(id, 30_000);
    const seen = () =>
      (
        db.query("SELECT lastSeenAt FROM remote_sessions WHERE idHash = $h").get({ h: hash }) as {
          lastSeenAt: number;
        }
      ).lastSeenAt;
    expect(seen()).toBe(0);
    store.validate(id, 61_000);
    expect(seen()).toBe(61_000);
  });

  test("revocation is immediate, notified, and listed sessions exclude it", () => {
    const a = store.create({ deviceName: "Chrome · macOS", remote: false }, 0);
    const b = store.create({ deviceName: "Application Kibo", remote: false }, 10);
    const revoked: string[] = [];
    store.onRevoke((h) => revoked.push(h));
    store.revoke(a.hash, 100);
    expect(store.validate(a.id, 200)).toBeNull();
    expect(revoked).toEqual([a.hash]);
    expect(store.list(200).map((s) => s.id)).toEqual([b.hash]);
    expect(store.list(200)[0]).toEqual({
      id: b.hash,
      deviceName: "Application Kibo",
      remote: false,
      createdAt: 10,
      lastSeenAt: 10,
      expiresAt: 10 + SESSION_TTL_MS,
    });
  });

  test("revoking an unknown session is a NOT_FOUND error", () => {
    expect(() => store.revoke("0".repeat(64), 1)).toThrow("NOT_FOUND");
  });

  test("reports when a validation slides the expiry, so the cookie can be renewed", () => {
    const { id } = store.create({ deviceName: "Chrome · macOS", remote: false }, 0);
    expect(store.validate(id, 30_000)?.renewed).toBe(false);
    expect(store.validate(id, 61_000)?.renewed).toBe(true);
    expect(store.validate(id, 62_000)?.renewed).toBe(false);
  });

  test("tells whether a session hash is still active", () => {
    const a = store.create({ deviceName: "Chrome · macOS", remote: false }, 0);
    const b = store.create({ deviceName: "Chrome · macOS", remote: false }, 0);
    expect(store.isActive(a.hash, 1)).toBe(true);
    store.revoke(a.hash, 2);
    expect(store.isActive(a.hash, 3)).toBe(false);
    expect(store.isActive(b.hash, SESSION_TTL_MS)).toBe(false);
    expect(store.isActive("0".repeat(64), 1)).toBe(false);
  });

  test("purge deletes expired and revoked sessions only", () => {
    const expired = store.create({ deviceName: "Chrome · macOS", remote: false }, 0);
    const revoked = store.create({ deviceName: "Chrome · macOS", remote: true }, 10 * DAY);
    const alive = store.create({ deviceName: "Application Kibo", remote: false }, 10 * DAY);
    store.revoke(revoked.hash, 11 * DAY);
    store.purge(SESSION_TTL_MS + DAY);
    const rows = db.query<{ idHash: string }, []>("SELECT idHash FROM remote_sessions").all();
    expect(rows.map((r) => r.idHash)).toEqual([alive.hash]);
    expect(expired.hash).not.toBe(alive.hash);
  });
});
