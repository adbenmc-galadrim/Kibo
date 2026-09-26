import type { Database } from "bun:sqlite";

export type MarketSourceRow = {
  id: string;
  url: string;
  name: string;
  publicKey: string;
  fingerprint: string;
  lastSerial: number | null;
  lastFetchedAt: number | null;
  enabled: boolean;
  lastError: string | null;
};

export type MarketDb = {
  sources(): MarketSourceRow[];
  source(id: string): MarketSourceRow | null;
  addSource(row: MarketSourceRow): boolean;
  removeSource(id: string): void;
  setFetched(id: string, input: { serial: number; bytes: Uint8Array; sig: string; at: number }): boolean;
  setError(id: string, message: string | null): void;
  cachedIndex(id: string): { bytes: Uint8Array; sig: string } | null;
  pin(sourceId: string, componentId: string): string | null;
  setPin(sourceId: string, componentId: string, publisherKey: string, at: number): void;
  unpin(sourceId: string, componentId: string): void;
};

type SourceRecord = Omit<MarketSourceRow, "enabled"> & { enabled: number };

export function openMarketDb(db: Database): MarketDb {
  db.exec(
    "CREATE TABLE IF NOT EXISTS market_sources (id TEXT PRIMARY KEY, url TEXT NOT NULL, name TEXT NOT NULL, " +
      "publicKey TEXT NOT NULL, fingerprint TEXT NOT NULL, lastSerial INTEGER, lastFetchedAt INTEGER, " +
      "enabled INTEGER NOT NULL DEFAULT 1, lastError TEXT)",
  );
  db.exec(
    "CREATE TABLE IF NOT EXISTS market_pins (sourceId TEXT NOT NULL, componentId TEXT NOT NULL, " +
      "publisherKey TEXT NOT NULL, pinnedAt INTEGER NOT NULL, PRIMARY KEY (sourceId, componentId))",
  );
  db.exec(
    "CREATE TABLE IF NOT EXISTS market_index_cache (sourceId TEXT PRIMARY KEY, bytes BLOB NOT NULL, " +
      "sig TEXT NOT NULL, fetchedAt INTEGER NOT NULL)",
  );
  const toRow = (r: SourceRecord): MarketSourceRow => ({ ...r, enabled: r.enabled === 1 });
  return {
    sources: () => db.query<SourceRecord, []>("SELECT * FROM market_sources ORDER BY name").all().map(toRow),
    source: (id) => {
      const r = db.query<SourceRecord, [string]>("SELECT * FROM market_sources WHERE id = ?").get(id);
      return r ? toRow(r) : null;
    },
    addSource: (row) => {
      const inserted = db
        .query(
          "INSERT INTO market_sources (id, url, name, publicKey, fingerprint, lastSerial, lastFetchedAt, enabled, lastError) " +
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO NOTHING",
        )
        .run(
          row.id,
          row.url,
          row.name,
          row.publicKey,
          row.fingerprint,
          row.lastSerial,
          row.lastFetchedAt,
          row.enabled ? 1 : 0,
          row.lastError,
        );
      return inserted.changes === 1;
    },
    removeSource: (id) => {
      db.query("DELETE FROM market_sources WHERE id = ?").run(id);
      db.query("DELETE FROM market_index_cache WHERE sourceId = ?").run(id);
    },
    setFetched: (id, { serial, bytes, sig, at }) =>
      db.transaction(() => {
        const touched = db
          .query(
            "UPDATE market_sources SET lastSerial = ?1, lastFetchedAt = ?2, lastError = NULL " +
              "WHERE id = ?3 AND (lastSerial IS NULL OR lastSerial <= ?1)",
          )
          .run(serial, at, id);
        if (touched.changes !== 1) return false;
        db.query(
          "INSERT INTO market_index_cache (sourceId, bytes, sig, fetchedAt) VALUES (?, ?, ?, ?) " +
            "ON CONFLICT(sourceId) DO UPDATE SET bytes = excluded.bytes, sig = excluded.sig, fetchedAt = excluded.fetchedAt",
        ).run(id, bytes, sig, at);
        return true;
      })(),
    setError: (id, message) => {
      db.query("UPDATE market_sources SET lastError = ? WHERE id = ?").run(message, id);
    },
    cachedIndex: (id) => {
      const r = db
        .query<{ bytes: Uint8Array; sig: string }, [string]>(
          "SELECT bytes, sig FROM market_index_cache WHERE sourceId = ?",
        )
        .get(id);
      return r ? { bytes: new Uint8Array(r.bytes), sig: r.sig } : null;
    },
    pin: (sourceId, componentId) => {
      const r = db
        .query<{ publisherKey: string }, [string, string]>(
          "SELECT publisherKey FROM market_pins WHERE sourceId = ? AND componentId = ?",
        )
        .get(sourceId, componentId);
      return r?.publisherKey ?? null;
    },
    setPin: (sourceId, componentId, publisherKey, at) => {
      db.query(
        "INSERT INTO market_pins (sourceId, componentId, publisherKey, pinnedAt) VALUES (?, ?, ?, ?) " +
          "ON CONFLICT(sourceId, componentId) DO UPDATE SET publisherKey = excluded.publisherKey, pinnedAt = excluded.pinnedAt",
      ).run(sourceId, componentId, publisherKey, at);
    },
    unpin: (sourceId, componentId) => {
      db.query("DELETE FROM market_pins WHERE sourceId = ? AND componentId = ?").run(sourceId, componentId);
    },
  };
}
