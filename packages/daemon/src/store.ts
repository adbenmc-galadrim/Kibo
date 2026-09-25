import { Database } from "bun:sqlite";
import { chmodSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { KiboError } from "@kibo/schema";
import { LoroDoc } from "loro-crdt";

export type Store = {
  load(id: string): Uint8Array | null;
  save(id: string, snapshot: Uint8Array): void;
  ids(): string[];
  close(): void;
};

export function openStore(home: string): Store {
  mkdirSync(home, { recursive: true, mode: 0o700 });
  chmodSync(home, 0o700);
  const file = join(home, "kibo.db");
  let db: Database;
  try {
    db = new Database(file, { create: true, strict: true });
    db.exec("PRAGMA journal_mode = WAL");
    db.exec("PRAGMA synchronous = FULL");
    db.exec(
      "CREATE TABLE IF NOT EXISTS docs (id TEXT PRIMARY KEY, snapshot BLOB NOT NULL, updated_at INTEGER NOT NULL)",
    );
    const check = db.query("PRAGMA integrity_check").get() as { integrity_check: string } | null;
    if (check?.integrity_check !== "ok") throw new Error(check?.integrity_check ?? "integrity_check failed");
  } catch (e) {
    throw new KiboError("STORE_CORRUPT", `cannot open ${file}: ${String(e)}`);
  }
  for (const f of [file, `${file}-wal`, `${file}-shm`]) if (existsSync(f)) chmodSync(f, 0o600);

  const upsert = db.query(
    "INSERT INTO docs (id, snapshot, updated_at) VALUES ($id, $snapshot, $at) " +
      "ON CONFLICT(id) DO UPDATE SET snapshot = excluded.snapshot, updated_at = excluded.updated_at",
  );
  const select = db.query("SELECT snapshot FROM docs WHERE id = $id");
  return {
    load: (id) => {
      const row = select.get({ id }) as { snapshot: Uint8Array } | null;
      return row ? new Uint8Array(row.snapshot) : null;
    },
    save: (id, snapshot) => {
      upsert.run({ id, snapshot, at: Date.now() });
    },
    ids: () => (db.query("SELECT id FROM docs ORDER BY id").all() as { id: string }[]).map((r) => r.id),
    close: () => db.close(),
  };
}

export function loadDoc(store: Store, id: string): LoroDoc | null {
  const bytes = store.load(id);
  if (!bytes) return null;
  try {
    return LoroDoc.fromSnapshot(bytes);
  } catch (e) {
    throw new KiboError("STORE_CORRUPT", `snapshot ${id} is unreadable: ${String(e)}`);
  }
}
