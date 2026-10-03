import { KiboError } from "@kibo/schema";
import { immediateTransaction, type ServerDb } from "../db";
import type { IndexedPackage } from "./index-builder";

export type MarketRole = "owner" | "publisher";
export type PublisherRow = { publicKey: string; userId: string; name: string; nameKey: string };
export type NewPackageRow = IndexedPackage & { userId: string; bytes: Uint8Array };
export type RevokedRow = { hash: string; reason: string };

const TABLES = [
  "CREATE TABLE IF NOT EXISTS market_packages (id TEXT NOT NULL, version TEXT NOT NULL, hash TEXT NOT NULL, publisherKey TEXT NOT NULL, userId TEXT NOT NULL REFERENCES users(id), manifestJson TEXT NOT NULL, bytes BLOB NOT NULL, size INTEGER NOT NULL, publishedAt TEXT NOT NULL, PRIMARY KEY (id, version))",
  "CREATE UNIQUE INDEX IF NOT EXISTS market_packages_by_hash ON market_packages(hash)",
  "CREATE TABLE IF NOT EXISTS market_revoked (hash TEXT PRIMARY KEY, reason TEXT NOT NULL, at INTEGER NOT NULL, by TEXT NOT NULL)",
  "CREATE TABLE IF NOT EXISTS market_roles (userId TEXT PRIMARY KEY REFERENCES users(id), role TEXT NOT NULL CHECK (role IN ('owner', 'publisher')))",
  "CREATE TABLE IF NOT EXISTS market_publishers (publicKey TEXT PRIMARY KEY, userId TEXT NOT NULL REFERENCES users(id), name TEXT NOT NULL, nameKey TEXT NOT NULL)",
  "CREATE INDEX IF NOT EXISTS market_publishers_by_name ON market_publishers(nameKey)",
  "CREATE TABLE IF NOT EXISTS market_state (id INTEGER PRIMARY KEY CHECK (id = 1), serial INTEGER NOT NULL, indexJson TEXT NOT NULL, sig TEXT NOT NULL)",
];

export class MarketStore {
  constructor(private readonly sdb: ServerDb) {
    for (const statement of TABLES) sdb.db.exec(statement);
  }

  userExists(userId: string): boolean {
    return this.sdb.db.query("SELECT 1 FROM users WHERE id = $id").get({ id: userId }) !== null;
  }

  role(userId: string): MarketRole | null {
    const row = this.sdb.db
      .query<{ role: MarketRole }, { userId: string }>("SELECT role FROM market_roles WHERE userId = $userId")
      .get({ userId });
    return row?.role ?? null;
  }

  setRole(userId: string, role: MarketRole | null): void {
    if (role === null) {
      this.sdb.db.query("DELETE FROM market_roles WHERE userId = $userId").run({ userId });
      return;
    }
    this.sdb.db
      .query(
        "INSERT INTO market_roles (userId, role) VALUES ($userId, $role) ON CONFLICT(userId) DO UPDATE SET role = excluded.role",
      )
      .run({ userId, role });
  }

  serial(): number {
    const row = this.sdb.db
      .query<{ serial: number }, []>("SELECT serial FROM market_state WHERE id = 1")
      .get();
    return row?.serial ?? 0;
  }

  signedIndex(): { indexJson: string; sig: string } | null {
    return this.sdb.db
      .query<{ indexJson: string; sig: string }, []>("SELECT indexJson, sig FROM market_state WHERE id = 1")
      .get();
  }

  packages(): IndexedPackage[] {
    return this.sdb.db
      .query<IndexedPackage, []>(
        "SELECT id, version, hash, publisherKey, manifestJson, size, publishedAt FROM market_packages ORDER BY id, version",
      )
      .all();
  }

  publishers(): PublisherRow[] {
    return this.sdb.db
      .query<PublisherRow, []>(
        "SELECT publicKey, userId, name, nameKey FROM market_publishers ORDER BY publicKey",
      )
      .all();
  }

  revoked(): RevokedRow[] {
    return this.sdb.db
      .query<RevokedRow, []>("SELECT hash, reason FROM market_revoked ORDER BY at, hash")
      .all();
  }

  isRevoked(hash: string): boolean {
    return this.sdb.db.query("SELECT 1 FROM market_revoked WHERE hash = $hash").get({ hash }) !== null;
  }

  hasVersion(id: string, version: string): boolean {
    return (
      this.sdb.db
        .query("SELECT 1 FROM market_packages WHERE id = $id AND version = $version")
        .get({ id, version }) !== null
    );
  }

  publisherKeysOf(id: string): string[] {
    return this.sdb.db
      .query<{ publisherKey: string }, { id: string }>(
        "SELECT DISTINCT publisherKey FROM market_packages WHERE id = $id",
      )
      .all({ id })
      .map((r) => r.publisherKey);
  }

  publisher(publicKey: string): PublisherRow | null {
    return this.sdb.db
      .query<PublisherRow, { publicKey: string }>(
        "SELECT publicKey, userId, name, nameKey FROM market_publishers WHERE publicKey = $publicKey",
      )
      .get({ publicKey });
  }

  nameTakenByOther(nameKey: string, userId: string): boolean {
    return (
      this.sdb.db
        .query("SELECT 1 FROM market_publishers WHERE nameKey = $nameKey AND userId != $userId")
        .get({ nameKey, userId }) !== null
    );
  }

  packageOwner(hash: string): string | null {
    const row = this.sdb.db
      .query<{ userId: string }, { hash: string }>("SELECT userId FROM market_packages WHERE hash = $hash")
      .get({ hash });
    return row?.userId ?? null;
  }

  packageBytes(id: string, version: string): Uint8Array<ArrayBuffer> | null {
    const row = this.sdb.db
      .query<{ bytes: Uint8Array }, { id: string; version: string }>(
        "SELECT bytes FROM market_packages WHERE id = $id AND version = $version",
      )
      .get({ id, version });
    return row ? new Uint8Array(row.bytes) : null;
  }

  insertPublisher(row: PublisherRow): void {
    this.sdb.db
      .query(
        "INSERT INTO market_publishers (publicKey, userId, name, nameKey) VALUES ($publicKey, $userId, $name, $nameKey) ON CONFLICT(publicKey) DO NOTHING",
      )
      .run(row);
  }

  insertPackage(row: NewPackageRow): void {
    this.sdb.db
      .query(
        "INSERT INTO market_packages (id, version, hash, publisherKey, userId, manifestJson, bytes, size, publishedAt) " +
          "VALUES ($id, $version, $hash, $publisherKey, $userId, $manifestJson, $bytes, $size, $publishedAt)",
      )
      .run(row);
  }

  insertRevoked(row: RevokedRow & { at: number; by: string }): void {
    this.sdb.db
      .query("INSERT INTO market_revoked (hash, reason, at, by) VALUES ($hash, $reason, $at, $by)")
      .run(row);
  }

  writeIndex(previousSerial: number, next: { serial: number; indexJson: string; sig: string }): void {
    if (this.serial() !== previousSerial || next.serial <= previousSerial) {
      throw new KiboError("CONFLICT", "market index changed while it was being signed");
    }
    this.sdb.db
      .query(
        "INSERT INTO market_state (id, serial, indexJson, sig) VALUES (1, $serial, $indexJson, $sig) " +
          "ON CONFLICT(id) DO UPDATE SET serial = excluded.serial, indexJson = excluded.indexJson, sig = excluded.sig",
      )
      .run(next);
  }

  transaction(apply: () => void): void {
    immediateTransaction(this.sdb.db, apply)();
  }
}
