import type { Database } from "bun:sqlite";
import { createHash, randomBytes } from "node:crypto";
import { KiboError, type SessionInfo } from "@kibo/schema";

export const SESSION_TTL_MS = 30 * 24 * 3600_000;
const TOUCH_EVERY_MS = 60_000;
const SESSION_ID = /^[0-9a-f]{64}$/;

export type SessionStore = {
  create(input: { deviceName: string; remote: boolean }, now: number): { id: string; hash: string };
  validate(id: string, now: number): SessionCheck | null;
  isActive(hash: string, now: number): boolean;
  purge(now: number): void;
  list(now: number): Omit<SessionInfo, "current">[];
  revoke(hash: string, now: number): void;
  onRevoke(listener: (hash: string) => void): () => void;
};

export type SessionCheck = { hash: string; remote: boolean; renewed: boolean };

type Row = {
  idHash: string;
  deviceName: string;
  remote: number;
  createdAt: number;
  expiresAt: number;
  lastSeenAt: number;
  revokedAt: number | null;
};

export function hashSessionId(id: string): string {
  return createHash("sha256").update(id).digest("hex");
}

const toInfo = (r: Row): Omit<SessionInfo, "current"> => ({
  id: r.idHash,
  deviceName: r.deviceName,
  remote: r.remote === 1,
  createdAt: r.createdAt,
  lastSeenAt: r.lastSeenAt,
  expiresAt: r.expiresAt,
});

export function openSessionStore(db: Database): SessionStore {
  db.exec(
    "CREATE TABLE IF NOT EXISTS remote_sessions (idHash TEXT PRIMARY KEY, deviceName TEXT NOT NULL, " +
      "remote INTEGER NOT NULL, createdAt INTEGER NOT NULL, expiresAt INTEGER NOT NULL, " +
      "lastSeenAt INTEGER NOT NULL, revokedAt INTEGER)",
  );
  const insert = db.query<
    null,
    { idHash: string; deviceName: string; remote: number; at: number; expiresAt: number }
  >(
    "INSERT INTO remote_sessions (idHash, deviceName, remote, createdAt, expiresAt, lastSeenAt, revokedAt) " +
      "VALUES ($idHash, $deviceName, $remote, $at, $expiresAt, $at, NULL)",
  );
  const byHash = db.query<Row, { idHash: string }>("SELECT * FROM remote_sessions WHERE idHash = $idHash");
  const touch = db.query<null, { idHash: string; at: number; expiresAt: number }>(
    "UPDATE remote_sessions SET lastSeenAt = $at, expiresAt = $expiresAt WHERE idHash = $idHash",
  );
  const active = db.query<Row, { now: number }>(
    "SELECT * FROM remote_sessions WHERE revokedAt IS NULL AND expiresAt > $now ORDER BY createdAt DESC",
  );
  const markRevoked = db.query<null, { idHash: string; at: number }>(
    "UPDATE remote_sessions SET revokedAt = $at WHERE idHash = $idHash AND revokedAt IS NULL",
  );
  const removeStale = db.query<null, { now: number }>(
    "DELETE FROM remote_sessions WHERE revokedAt IS NOT NULL OR expiresAt <= $now",
  );
  const listeners = new Set<(hash: string) => void>();

  return {
    create({ deviceName, remote }, now) {
      const id = randomBytes(32).toString("hex");
      const hash = hashSessionId(id);
      insert.run({
        idHash: hash,
        deviceName,
        remote: remote ? 1 : 0,
        at: now,
        expiresAt: now + SESSION_TTL_MS,
      });
      return { id, hash };
    },
    validate(id, now) {
      if (!SESSION_ID.test(id)) return null;
      const hash = hashSessionId(id);
      const row = byHash.get({ idHash: hash });
      if (!row || row.revokedAt !== null || row.expiresAt <= now) return null;
      const renewed = now - row.lastSeenAt >= TOUCH_EVERY_MS;
      if (renewed) touch.run({ idHash: hash, at: now, expiresAt: now + SESSION_TTL_MS });
      return { hash, remote: row.remote === 1, renewed };
    },
    isActive(hash, now) {
      const row = byHash.get({ idHash: hash });
      return row !== null && row.revokedAt === null && row.expiresAt > now;
    },
    purge(now) {
      removeStale.run({ now });
    },
    list(now) {
      return active.all({ now }).map(toInfo);
    },
    revoke(hash, now) {
      if (!byHash.get({ idHash: hash })) throw new KiboError("NOT_FOUND", "session not found");
      markRevoked.run({ idHash: hash, at: now });
      for (const listener of listeners) listener(hash);
    },
    onRevoke(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
