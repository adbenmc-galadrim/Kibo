import type { Database } from "bun:sqlite";
import { IconMime, KiboError } from "@kibo/schema";

export type StoredIcon = { mime: IconMime; bytes: Uint8Array; sha256: string };
export type IconStore = {
  get(owner: string): StoredIcon | null;
  version(owner: string): string | null;
  set(owner: string, mime: IconMime, bytes: Uint8Array): string;
  remove(owner: string): void;
};

type Row = { mime: string; bytes: Uint8Array; sha256: string };
type Owner = { owner: string };

export const sha256Hex = (bytes: Uint8Array): string =>
  new Bun.CryptoHasher("sha256").update(bytes).digest("hex");

export function ensureIconsTable(db: Database): void {
  db.exec(
    "CREATE TABLE IF NOT EXISTS icons (owner TEXT PRIMARY KEY, mime TEXT NOT NULL, bytes BLOB NOT NULL, sha256 TEXT NOT NULL)",
  );
}

export function createIconStore(db: Database): IconStore {
  const select = db.query<Row, Owner>("SELECT mime, bytes, sha256 FROM icons WHERE owner = $owner");
  const selectVersion = db.query<{ sha256: string }, Owner>("SELECT sha256 FROM icons WHERE owner = $owner");
  const upsert = db.query<never, Row & Owner>(
    "INSERT INTO icons (owner, mime, bytes, sha256) VALUES ($owner, $mime, $bytes, $sha256) " +
      "ON CONFLICT(owner) DO UPDATE SET mime = excluded.mime, bytes = excluded.bytes, sha256 = excluded.sha256",
  );
  const deleteRow = db.query<never, Owner>("DELETE FROM icons WHERE owner = $owner");
  return {
    get(owner) {
      const row = select.get({ owner });
      if (!row) return null;
      const mime = IconMime.safeParse(row.mime);
      if (!mime.success) throw new KiboError("STORE_CORRUPT", `icon ${owner} has mime ${row.mime}`);
      return { mime: mime.data, bytes: new Uint8Array(row.bytes), sha256: row.sha256 };
    },
    version: (owner) => selectVersion.get({ owner })?.sha256 ?? null,
    set(owner, mime, bytes) {
      const sha256 = sha256Hex(bytes);
      upsert.run({ owner, mime, bytes, sha256 });
      return sha256;
    },
    remove(owner) {
      deleteRow.run({ owner });
    },
  };
}
